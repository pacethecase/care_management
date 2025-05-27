const pool = require("../models/db");
const { DateTime } = require('luxon');

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

    const task = taskRes.rows[0];

    // 🔒 Check if missed reason is missing
    if (task.status === 'Missed') {
      const historyCheck = await pool.query(`
        SELECT jsonb_array_elements(status_history) AS entry FROM patient_tasks WHERE id = $1
      `, [taskId]);

      const hasMissedWithReason = historyCheck.rows.some(row => {
        const entry = row.entry;
        return entry.status === "Missed" && entry.reason;
      });

      if (!hasMissedWithReason) {
        return res.status(400).json({ error: "Cannot start a missed task without a missed reason." });
      }
    }

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
    const timezone = req.headers['x-timezone'] || 'America/New_York';
    console.log("Completing task with ID:", taskId);

    // Step 1: Fetch task from patient_tasks
    const taskRes = await pool.query(`SELECT * FROM patient_tasks WHERE id = $1`, [taskId]);
    if (taskRes.rows.length === 0) {
      console.log("❌ Task not found");
      return res.status(404).json({ error: "Task not found" });
    }

    const task = taskRes.rows[0];
    const completedAt = new Date(); 


    if (task.status === 'Missed') {
      const latestStatus = task.status_history?.slice(-1)[0];
      const missedReason = latestStatus?.reason;
    
      if (!missedReason || missedReason.trim() === "") {
        return res.status(400).json({ error: "Task was missed. Please provide a reason before completing." });
      }
    }
    
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
      const utcString = new Date(
        new Date(court_date).toLocaleString("en-US", { timeZone: timezone })
      ).toISOString();
      
      const courtDateUTC = new Date(utcString);
      

      await pool.query(`UPDATE patients SET guardianship_court_datetime = $1 WHERE id = $2`, [courtDateUTC, patient.id]);
    }
    if (taskDetails.name === "Confirm date/time of States initial steps including Intake Interview: if not scheduled, follow-up with State") {
      console.log("Court date check required for task:", taskDetails.name);
      if (!court_date) {
        return res.status(400).json({ error: "Court date is required to complete this task." });
      }
      const utcString = new Date(
        new Date(court_date).toLocaleString("en-US", { timeZone: timezone })
      ).toISOString();
      
      const courtDateUTC = new Date(utcString);

      await pool.query(`UPDATE patients SET ltc_court_datetime = $1 WHERE id = $2`, [courtDateUTC, patient.id]);
    }

          // Step 2: Mark as completed in DB and update local object
  // ✅ Determine final status
let finalStatus = "Completed";

if (task.ideal_due_date) {
  const cutoff = new Date(
    new Date(task.ideal_due_date).getFullYear(),
    new Date(task.ideal_due_date).getMonth(),
    new Date(task.ideal_due_date).getDate(),
    23, 59, 0
  );

  if (completedAt > cutoff) {
    finalStatus = "Delayed Completed";
  }
}

// ✅ Update task in DB
await pool.query(`
  UPDATE patient_tasks 
  SET status = $1, completed_at = $2
  WHERE id = $3
`, [finalStatus, completedAt, taskId]);

// ✅ ALSO update your in-memory `task` object!
task.completed_at = completedAt;

// ✅ Append to history with the same status
await appendStatusHistory(taskId, {
  status: finalStatus,
  timestamp: completedAt.toISOString(),
  staff_id: req.user.id,
});

    // Skip recurrence and dependency handling for non-blocking tasks
    if (taskDetails.is_non_blocking) {
      console.log("Non-blocking task completed, skipping recurrence and dependency handling.");
      return res.status(200).json({ message: "Non-blocking task completed successfully" });
    }

    const isManualFollowUpTask = taskDetails.is_repeating && taskDetails.due_in_days_after_dependency !== null;

    // Step 4: Handle repeating task
    if (taskDetails.is_repeating && taskDetails.recurrence_interval && patientStatus !== "Discharged" && !isManualFollowUpTask) {      
      const completedAt = task.completed_at ? new Date(task.completed_at) : new Date();
      const previousIdealDue = task.ideal_due_date ? new Date(task.ideal_due_date) : new Date();
    
      const dueLocal = DateTime.fromJSDate(completedAt).setZone(timezone).plus({ days: taskDetails.recurrence_interval }).set({ hour: 23, minute: 59, second: 0, millisecond: 0 });
      const idealLocal = DateTime.fromJSDate(previousIdealDue).setZone(timezone).plus({ days: taskDetails.recurrence_interval }).set({ hour: 23, minute: 59, second: 0, millisecond: 0 });
    
      const nextDue = dueLocal.toUTC().toJSDate();
      const ideal_due_date = idealLocal.toUTC().toJSDate();

    
      await pool.query(
        `INSERT INTO patient_tasks (patient_id, task_id, status, due_date, ideal_due_date)
         VALUES ($1, $2, 'Pending', $3,$4)`,
        [task.patient_id, taskDetails.id, nextDue, ideal_due_date]
      );
    
      console.log(
        `🔁 Repeating task '${taskDetails.name}' scheduled for ${nextDue.toDateString()} (Ideal: ${ideal_due_date.toDateString()})`
      );
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
      
      if (dep.name === "Begin compiling needed financial/legal information"){
        if(patient.is_ltc_medical && !patient.is_ltc_financial){
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
          `INSERT INTO patient_tasks (patient_id, task_id, status)
           VALUES ($1, $2, 'Pending')`,
          [task.patient_id, dep.id]
        );
        console.log(`📌 Non-blocking dependent task '${dep.name}' scheduled without a due date`);
        continue;
      }
      const idealBaseDateLocal = DateTime.fromJSDate(task.ideal_due_date).setZone(timezone);
      const dueBaseLocal = DateTime.fromJSDate(task.completed_at).setZone(timezone);

      let due, idealBaseDate;

if (dep.is_repeating && dep.recurrence_interval != null && dep.due_in_days_after_dependency == null) {
  const dueDate = dueBaseLocal.plus({ days: dep.recurrence_interval }).set({ hour: 23, minute: 59, second: 0, millisecond: 0 });
  const idealDate = idealBaseDateLocal.plus({ days: dep.recurrence_interval }).set({ hour: 23, minute: 59, second: 0, millisecond: 0 });
  due = dueDate.toUTC().toJSDate();
  idealBaseDate = idealDate.toUTC().toJSDate();
} else if (dep.due_in_days_after_dependency != null) {
  const dueDate = dueBaseLocal.plus({ days: dep.due_in_days_after_dependency }).set({  hour: 23, minute: 59, second: 0, millisecond: 0 });
  const idealDate = idealBaseDateLocal.plus({ days: dep.due_in_days_after_dependency }).set({ hour: 23, minute: 59, second: 0, millisecond: 0});
  due = dueDate.toUTC().toJSDate();
  idealBaseDate = idealDate.toUTC().toJSDate();
}

if (!due || !idealBaseDate) {
  console.warn(`⚠️ Skipping '${dep.name}' due to missing date calculations`);
  continue;
}


await pool.query(
  `INSERT INTO patient_tasks (patient_id, task_id, status, due_date, ideal_due_date)
   VALUES ($1, $2, 'Pending', $3, $4)`,
  [task.patient_id, dep.id, due, idealBaseDate]
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
      SELECT pt.id AS task_id, pt.due_date, pt.status, p.last_name || ', ' || p.first_name AS patient_name, t.name AS task_name, pt.patient_id, t.is_repeating, t.due_in_days_after_dependency, t.is_non_blocking
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      JOIN patients p ON pt.patient_id = p.id
     JOIN patient_staff ps ON ps.patient_id = p.id
        WHERE ps.staff_id = $1
        AND pt.status IN ('Pending', 'In Progress', 'Missed')
        AND pt.due_date <= CURRENT_DATE + INTERVAL '2 day'
        AND p.status != 'Discharged'
         AND pt.is_visible = TRUE
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
      SELECT pt.id AS task_id, pt.due_date, p.last_name || ', ' || p.first_name AS patient_name
, t.name AS task_name
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      JOIN patients p ON pt.patient_id = p.id
     JOIN patient_staff ps ON ps.patient_id = p.id
      WHERE ps.staff_id = $1

        AND pt.status = 'Missed'
        AND p.status != 'Discharged'
        AND pt.is_visible = TRUE
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
    const timezone = req.headers['x-timezone'] || 'America/New_York';
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

    const nowLocal = DateTime.local().setZone(timezone);
    const nextDueLocal = nowLocal.plus({ days: taskDetails.recurrence_interval }).set({  hour: 23, minute: 59, second: 0, millisecond: 0 });
    const nextDue = nextDueLocal.toUTC().toJSDate();

    await pool.query(
      `UPDATE patient_tasks
       SET status = 'Follow Up', due_date = $1
       WHERE id = $2`,
      [nextDue, taskId]
    );

    // Step 4: Append the follow-up reason to the task status history
    await appendStatusHistory(taskId, {
      status: "Follow Up",
      timestamp: nowLocal.toUTC().toJSDate().toISOString(),
      note: followUpReason, // Use the provided follow-up reason
      staff_id: req.user.id
    });

    console.log(`🔁 Updated task '${taskDetails.name}' to follow up for ${nextDue.toDateString()}`);
    res.status(200).json({ message: "Follow-up date extended on same task with reason." });

  } catch (err) {
    console.error("❌ Error in followUpCourtTask:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const updateTaskNote = async (req, res) => {
  try {
    const { taskId } = req.params;
    const {
      task_note,
      include_note_in_report,
      contact_info,
    } = req.body;

    const existingRes = await pool.query(`SELECT * FROM patient_tasks WHERE id = $1`, [taskId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const current = existingRes.rows[0];

    const result = await pool.query(
      `UPDATE patient_tasks
       SET task_note = $1::text,
           include_note_in_report = $2::boolean,
           contact_info = $3::text
       WHERE id = $4
       RETURNING *`,
      [
        task_note ?? current.task_note,
        include_note_in_report ?? current.include_note_in_report,
        contact_info ?? current.contact_info,
        taskId
      ]
    );

    res.status(200).json({ message: "Task metadata updated", task: result.rows[0] });
  } catch (err) {
    console.error("❌ Error updating task note/contact:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};


module.exports = {
  startTask,
  completeTask,
  markTaskAsMissed,
  getMissedTasks,
  getPriorityTasks,
  followUpCourtTask,
  updateTaskNote
};
