const pool = require("../models/db");

const appendStatusHistory = async (taskId, newEntry) => {
  await pool.query(`
    UPDATE patient_tasks
    SET status_history = status_history || $2::jsonb
    WHERE id = $1
  `, [taskId, JSON.stringify([newEntry])]);
};

// 🚀 Start a Task
const startTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const staffId = req.user.id;

    const taskRes = await pool.query(`SELECT * FROM patient_tasks WHERE id = $1`, [taskId]);
    if (taskRes.rows.length === 0) return res.status(404).json({ error: "Task not found" });

    await pool.query(`
      UPDATE patient_tasks 
      SET status = 'In Progress', started_at = NOW()
      WHERE id = $1
    `, [taskId]);

    await appendStatusHistory(taskId, {
      status: "In Progress",
      timestamp: new Date().toISOString(),
      staff_id: staffId
    });

    res.status(200).json({ message: "Task started successfully" });

  } catch (err) {
    console.error("❌ Error starting task:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ✅ Complete Task (handle repeat + dependency)
const completeTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { court_date } = req.body;

    console.log("Completing task with ID:", taskId);

    // Step 1: Fetch task from patient_tasks
    const taskRes = await pool.query(`SELECT * FROM patient_tasks WHERE id = $1`, [taskId]);
    if (taskRes.rows.length === 0) {
      console.log("❌ Task not found");
      return res.status(404).json({ error: "Task not found" });
    }

    const task = taskRes.rows[0];
    const completedAt = new Date();
    completedAt.setHours(0, 0, 0, 0);

    // Step 2: Mark as completed in DB and update local object
    await pool.query(`
      UPDATE patient_tasks 
      SET status = 'Completed', completed_at = $1
      WHERE id = $2
    `, [completedAt, taskId]);

    task.completed_at = completedAt;
    await appendStatusHistory(taskId, { status: "Completed", timestamp: completedAt.toISOString() });

    // Step 3: Fetch metadata
    const [taskDetailsRes, patientRes, patientStatusRes] = await Promise.all([
      pool.query(`SELECT * FROM tasks WHERE id = $1`, [task.task_id]),
      pool.query(`SELECT * FROM patients WHERE id = $1`, [task.patient_id]),
      pool.query(`SELECT status FROM patients WHERE id = $1`, [task.patient_id]),
    ]);

    const taskDetails = taskDetailsRes.rows[0];
    const patient = patientRes.rows[0];
    const patientStatus = patientStatusRes.rows[0]?.status;

    // 👇 Update court_date if needed
    if (taskDetails.name === "Court date confirmed" || taskDetails.name === "Court Hearing Date Received if not follow up completed") {
      console.log("Court date check required for task:", taskDetails.name);
      if (!court_date) {
        return res.status(400).json({ error: "Court date is required to complete this task." });
      }

      await pool.query(`UPDATE patients SET court_date = $1 WHERE id = $2`, [court_date, patient.id]);
      console.log("Court date updated:", court_date);
    }

    // Skip recurrence and dependency handling for non-blocking tasks
    if (taskDetails.is_non_blocking) {
      console.log("Non-blocking task completed, skipping recurrence and dependency handling.");
      return res.status(200).json({ message: "Non-blocking task completed successfully" });
    }

    const isManualFollowUpTask = taskDetails.is_repeating && taskDetails.due_in_days_after_dependency !== null;

    // Step 4: Handle repeating task
    if (taskDetails.is_repeating && taskDetails.recurrence_interval && patientStatus !== "Discharged" && !isManualFollowUpTask) {
      const nextDue = new Date(task.completed_at);
      nextDue.setDate(nextDue.getDate() + taskDetails.recurrence_interval);
      nextDue.setHours(0, 0, 0, 0);

      await pool.query(
        `INSERT INTO patient_tasks (patient_id, task_id, assigned_staff_id, status, due_date)
         VALUES ($1, $2, $3, 'Pending', $4)`,
        [task.patient_id, taskDetails.id, task.assigned_staff_id, nextDue]
      );
      console.log(`🔁 Repeating task '${taskDetails.name}' scheduled for ${nextDue.toDateString()}`);
    }

    // Step 5: Handle dependent tasks
    const depRes = await pool.query(`
      SELECT t.*
      FROM tasks t
      JOIN task_dependencies td ON t.id = td.task_id
      WHERE td.depends_on_task_id = $1
    `, [task.task_id]);

    for (const dep of depRes.rows) {
      console.log(`Checking dependent task: ${dep.name}`);

      const exists = await pool.query(
        `SELECT 1 FROM patient_tasks WHERE patient_id = $1 AND task_id = $2 AND status IN ('Pending', 'In Progress')`,
        [task.patient_id, dep.id]
      );

      if (exists.rows.length > 0) {
        console.log(`Dependent task '${dep.name}' already exists.`);
        continue;
      }

      // Handling specific tasks based on conditions
      if (dep.name === "Court Hearing Date Received if not follow up completed") {
        const isEmergency = patient.is_guardianship_emergency;
        const isEmergencyValid = isEmergency && taskDetails.name === "Court Petition Filed-after Court Date is Received" && !!patient.court_date;
        const isNormalValid = !isEmergency && taskDetails.name === "Court Petition Filed";

        if (!isEmergencyValid && !isNormalValid) {
          console.log("⏭ Skipping 'Court Hearing Date Received...' based on flow conditions.");
          continue;
        }
      }
      if (dep.name === "Begin compiling needed financial/legal information"){
        if(patient.is_ltc_medical){
          console.log("⏭ Skipping 'compiling needed financial/legal information...' based on flow conditions.");
          continue;
        }
      }
      if (dep.name === "Follow up with state on application status"){
        if(patient.is_ltc_financial){
          console.log("⏭ Skipping 'compiling needed financial/legal information...' based on flow conditions.");
          continue;
        }
      }
      if (dep.name === "Confirm Guardianship Appointed" && !patient.is_guardianship_emergency) {
        console.log("⏭ Skipping 'Confirm Guardianship Appointed' for normal flow.");
        continue;
      }

      if (dep.is_non_blocking) {
        console.log("⏭ Skipping due date for non-blocking dependent task.");
        // Insert dependent task without a due date
        await pool.query(
          `INSERT INTO patient_tasks (patient_id, task_id, assigned_staff_id, status)
           VALUES ($1, $2, $3, 'Pending')`,
          [task.patient_id, dep.id, task.assigned_staff_id]
        );
        console.log(`📌 Non-blocking dependent task '${dep.name}' scheduled without a due date`);
        continue;
      }
    
      const baseDate = new Date(task.completed_at);
      baseDate.setHours(0, 0, 0, 0);

      const due = new Date(baseDate);
      if (dep.is_repeating && dep.recurrence_interval != null && dep.due_in_days_after_dependency == null) {
        due.setDate(baseDate.getDate() + dep.recurrence_interval);
      } else if (dep.due_in_days_after_dependency != null) {
        due.setDate(baseDate.getDate() + dep.due_in_days_after_dependency);
      }

      await pool.query(
        `INSERT INTO patient_tasks (patient_id, task_id, assigned_staff_id, status, due_date)
         VALUES ($1, $2, $3, 'Pending', $4)`,
        [task.patient_id, dep.id, task.assigned_staff_id, due]
      );

      console.log(`📌 Dependent task '${dep.name}' scheduled for ${due.toDateString()}`);
    }
    console.log("DOne")
    res.status(200).json({ message: "Task completed successfully" });
  } catch (err) {
    console.error("❌ Error completing task:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};



// 🟥 Mark a Task as Missed
const markTaskAsMissed = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { missed_reason } = req.body;
    const staffId = req.user.id;

    const taskRes = await pool.query(`SELECT * FROM patient_tasks WHERE id = $1`, [taskId]);
    if (taskRes.rows.length === 0) return res.status(404).json({ error: "Task not found" });

    const task = taskRes.rows[0];
    if (task.status === "Completed") {
      return res.status(400).json({ error: "Only pending/in-progress tasks can be missed" });
    }

    await pool.query(`
      UPDATE patient_tasks 
      SET status = 'Missed'
      WHERE id = $1
    `, [taskId]);

    await appendStatusHistory(taskId, {
      status: "Missed",
      timestamp: new Date().toISOString(),
      reason: missed_reason,
      staff_id: staffId
    });

    res.status(200).json({ message: "Task marked as missed" });

  } catch (err) {
    console.error("❌ Error marking task missed:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
// 🚨 Get Priority Tasks (due today/tomorrow)
const getPriorityTasks = async (req, res) => {
  try {
    const staffId = req.user.id;
    const { patientId } = req.query; // Get the patientId from the query

    let query = `
      SELECT pt.id AS task_id, pt.due_date, pt.status, p.name AS patient_name, t.name AS task_name, pt.patient_id, t.is_repeating, t.due_in_days_after_dependency, t.is_non_blocking
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      JOIN patients p ON pt.patient_id = p.id
      WHERE pt.assigned_staff_id = $1
        AND pt.status IN ('Pending', 'In Progress', 'Missed')
        AND pt.due_date <= CURRENT_DATE + INTERVAL '1 day'
        AND p.status != 'Discharged'
    `;
    const queryParams = [staffId];

    if (patientId) {
      query += ` AND pt.patient_id = $2`;  // Add the patient filter if patientId is provided
      queryParams.push(patientId);
    }

    query += ` ORDER BY pt.due_date ASC`;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching priority tasks:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 🕒 Get Missed Tasks Without Reasons
const getMissedTasks = async (req, res) => {
  try {
    const staffId = req.user.id;
    const { patientId } = req.query; // Get the patientId from the query

    let query = `
      SELECT pt.id AS task_id, pt.due_date, p.name AS patient_name, t.name AS task_name
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      JOIN patients p ON pt.patient_id = p.id
      WHERE pt.assigned_staff_id = $1
        AND pt.status = 'Missed'
        AND p.status != 'Discharged'
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(pt.status_history) elem
          WHERE elem->>'status' = 'Missed' AND elem ? 'reason'
          
        )
    `;
    const queryParams = [staffId];

    if (patientId) {
      query += ` AND pt.patient_id = $2`; // Add the patient filter if patientId is provided
      queryParams.push(patientId);
    }

    query += ` ORDER BY pt.due_date ASC`;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching missed tasks:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const followUpCourtTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { followUpReason } = req.body; // Get follow-up reason from the request body

    // Check if the reason was provided
    if (!followUpReason || followUpReason.trim() === "") {
      return res.status(400).json({ error: "Follow-up reason is required." });
    }

    // Step 1: Fetch task from patient_tasks
    const taskRes = await pool.query(`SELECT * FROM patient_tasks WHERE id = $1`, [taskId]);
    if (taskRes.rows.length === 0) return res.status(404).json({ error: "Task not found" });

    const task = taskRes.rows[0];

    // Step 2: Fetch task details
    const taskDetailsRes = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [task.task_id]);
    const taskDetails = taskDetailsRes.rows[0];

    // Check if this is a repeatable task with dependency-based recurrence
    const isManualFollowUpTask =
      taskDetails.is_repeating === true &&
      taskDetails.due_in_days_after_dependency !== null;

    if (!isManualFollowUpTask) {
      return res.status(400).json({
        error: "This task is not eligible for manual follow-up based on properties.",
      });
    }

    // Step 3: Update the task with the new due date for follow-up
    const now = new Date();
    const nextDue = new Date(now);
    nextDue.setDate(nextDue.getDate() + taskDetails.recurrence_interval); // Add recurrence interval (e.g., 7 days later)
    nextDue.setHours(0, 0, 0, 0); // Set time to 00:00:00

    await pool.query(
      `UPDATE patient_tasks
       SET status = 'Follow Up', due_date = $1
       WHERE id = $2`,
      [nextDue, taskId]
    );

    // Step 4: Append the follow-up reason to the task status history
    await appendStatusHistory(taskId, {
      status: "Follow Up",
      timestamp: now.toISOString(),
      note: followUpReason, // Use the provided follow-up reason
    });

    console.log(`🔁 Updated task '${taskDetails.name}' to follow up for ${nextDue.toDateString()}`);
    res.status(200).json({ message: "Follow-up date extended on same task with reason." });

  } catch (err) {
    console.error("❌ Error in followUpCourtTask:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


module.exports = {
  startTask,
  completeTask,
  markTaskAsMissed,
  getMissedTasks,
  getPriorityTasks,
  followUpCourtTask
};
