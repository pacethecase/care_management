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
    const hospitalId = req.user.hospital_id;

    // ✅ Step 1: Check if the task belongs to this hospital
    const authCheck = await pool.query(`
      SELECT pt.*, p.hospital_id
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      WHERE pt.id = $1
    `, [taskId]);

    if (authCheck.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = authCheck.rows[0];

    if (task.hospital_id !== hospitalId) {
      return res.status(403).json({ error: "Unauthorized: Task not in your hospital" });
    }

    // 🔒 Step 2: Check if task is missed without a reason
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

    // ✅ Step 3: Start task
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
    const { court_date, override_date } = req.body;
    

    const timezone = req.headers['x-timezone'] || 'America/New_York';
    console.log("Completing task with ID:", taskId);

    // Step 1: Fetch task from patient_tasks
const hospitalId = req.user.hospital_id;

const taskRes = await pool.query(`
  SELECT pt.*, p.hospital_id 
  FROM patient_tasks pt
  JOIN patients p ON pt.patient_id = p.id
  WHERE pt.id = $1
`, [taskId]);

    if (taskRes.rows.length === 0) {
      console.log("❌ Task not found");
      return res.status(404).json({ error: "Task not found" });
    }

    const task = taskRes.rows[0];

    if (task.hospital_id !== hospitalId) {
      return res.status(403).json({ error: "Unauthorized: Task does not belong to your hospital." });
    }

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
console.log(taskDetails);
    // 👇 Unified court date handler
if (taskDetails.is_court_date) {
  console.log("Court date check required for task:", taskDetails.name);

  if (!court_date) {
    return res.status(400).json({ error: "Court date is required to complete this task." });
  }

  // Convert to UTC using timezone
  const utcString = new Date(
    new Date(court_date).toLocaleString("en-US", { timeZone: timezone })
  ).toISOString();
  const courtDateUTC = new Date(utcString);

  // Determine which field to update
  const fieldToUpdate = taskDetails.name.includes("State")
    ? "ltc_court_datetime"
    : "guardianship_court_datetime";

  await pool.query(
    `UPDATE patients SET ${fieldToUpdate} = $1 WHERE id = $2`,
    [courtDateUTC, patient.id]
  );

  console.log(`✅ Updated ${fieldToUpdate} for task '${taskDetails.name}'`);
}


          // Step 2: Mark as completed in DB and update local object
  // ✅ Determine final status
let finalStatus = "Completed";
const overrideDate = override_date
  ? DateTime.fromISO(override_date, { zone: timezone })
      .set({ hour: 23, minute: 59, second: 0, millisecond: 0 })
      .toUTC()
      .toJSDate()
  : null;

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
  SET status = $1, completed_at = $2, override_due_date = $3
  WHERE id = $4
`, [finalStatus, completedAt, overrideDate, taskId]);


// ✅ ALSO update your in-memory `task` object!
task.completed_at = completedAt;
task.override_due_date = overrideDate; 
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
   
if (
  taskDetails.is_repeating &&
  taskDetails.recurrence_interval &&
  patientStatus !== "Discharged" &&
  !isManualFollowUpTask
) {
  let nextDue, ideal_due_date;

  if (task.override_due_date) {
    // ✅ Use override date directly as next due and ideal
    const override = new Date(task.override_due_date);
    const overrideAt1159 = DateTime.fromJSDate(override)
      .setZone(timezone)
      .set({ hour: 23, minute: 59, second: 0, millisecond: 0 })
      .toUTC()
      .toJSDate();

    nextDue = overrideAt1159;
    ideal_due_date = overrideAt1159;

    console.log(`⏱ Using override date directly for next recurrence: ${overrideAt1159.toISOString()}`);
  } else {
    const completedAt = task.completed_at ? new Date(task.completed_at) : new Date();
    const previousIdealDue = task.ideal_due_date ? new Date(task.ideal_due_date) : new Date();

    const dueLocal = DateTime.fromJSDate(completedAt)
      .setZone(timezone)
      .plus({ days: taskDetails.recurrence_interval })
      .set({ hour: 23, minute: 59, second: 0, millisecond: 0 });

    const idealLocal = DateTime.fromJSDate(previousIdealDue)
      .setZone(timezone)
      .plus({ days: taskDetails.recurrence_interval })
      .set({ hour: 23, minute: 59, second: 0, millisecond: 0 });

    nextDue = dueLocal.toUTC().toJSDate();
    ideal_due_date = idealLocal.toUTC().toJSDate();
  }

  await pool.query(
    `INSERT INTO patient_tasks (patient_id, task_id, status, due_date, ideal_due_date)
     VALUES ($1, $2, 'Pending', $3, $4)`,
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
      
      if (dep.name === "LTC - Begin compiling needed financial/legal information"){
        if(patient.is_ltc_medical && !patient.is_ltc_financial){
          console.log("⏭ Skipping 'compiling needed financial/legal information...' based on flow conditions.");
          continue;
        }
      }
      if (dep.name === "LTC - Follow up with state on Medical Application status"){
        if(patient.is_ltc_financial){
          console.log("⏭ Skipping 'compiling needed financial/legal information...' based on flow conditions.");
          continue;
        }
      }
      if (dep.name === "Guardianship - Confirm Guardianship Appointed" && !patient.is_guardianship_emergency) {
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
    let due, idealBaseDate;

if (task.override_due_date) {
  // ✅ If override_due_date exists, use it directly for both due and ideal
  const override = DateTime.fromJSDate(new Date(task.override_due_date))
    .setZone(timezone)
    .set({ hour: 23, minute: 59, second: 0, millisecond: 0 });

  due = override.toUTC().toJSDate();
  idealBaseDate = override.toUTC().toJSDate();

  console.log(`⏱ Using override due date for dependent task '${dep.name}' → ${due.toDateString()}`);

} else {
  // 🧠 Use regular logic if no override
  const idealBaseDateLocal = DateTime.fromJSDate(task.ideal_due_date).setZone(timezone);
  const dueBaseLocal = DateTime.fromJSDate(task.completed_at).setZone(timezone);

  if (dep.is_repeating && dep.recurrence_interval != null && dep.due_in_days_after_dependency == null) {
    const dueDate = dueBaseLocal.plus({ days: dep.recurrence_interval }).set({ hour: 23, minute: 59, second: 0, millisecond: 0 });
    const idealDate = idealBaseDateLocal.plus({ days: dep.recurrence_interval }).set({ hour: 23, minute: 59, second: 0, millisecond: 0 });
    due = dueDate.toUTC().toJSDate();
    idealBaseDate = idealDate.toUTC().toJSDate();
  } else if (dep.due_in_days_after_dependency != null) {
    const dueDate = dueBaseLocal.plus({ days: dep.due_in_days_after_dependency }).set({ hour: 23, minute: 59, second: 0, millisecond: 0 });
    const idealDate = idealBaseDateLocal.plus({ days: dep.due_in_days_after_dependency }).set({ hour: 23, minute: 59, second: 0, millisecond: 0 });
    due = dueDate.toUTC().toJSDate();
    idealBaseDate = idealDate.toUTC().toJSDate();
  }
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

 const hospitalId = req.user.hospital_id;

const taskRes = await pool.query(`
  SELECT pt.*, p.hospital_id 
  FROM patient_tasks pt
  JOIN patients p ON pt.patient_id = p.id
  WHERE pt.id = $1
`, [taskId]);

if (taskRes.rows.length === 0) return res.status(404).json({ error: "Task not found" });

const task = taskRes.rows[0];
if (task.hospital_id !== hospitalId) {
  return res.status(403).json({ error: "Unauthorized: Task does not belong to your hospital." });
}

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
    const { id: staffId, hospital_id } = req.user;
    const { patientId } = req.query;

    let query = `
      SELECT 
        pt.id AS patient_task_id,
        pt.task_id AS task_id, 
        pt.due_date, 
        pt.status,
        p.last_name || ', ' || p.first_name AS patient_name,
        t.name AS task_name, 
        pt.patient_id, 
        t.is_repeating,
         t.is_court_date,
        t.due_in_days_after_dependency, 
        t.is_non_blocking
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      JOIN patients p ON pt.patient_id = p.id AND p.hospital_id = $2
      JOIN patient_staff ps ON ps.patient_id = p.id
      WHERE ps.staff_id = $1
        AND pt.status IN ('Pending', 'In Progress', 'Missed')
        AND pt.due_date <= CURRENT_DATE + INTERVAL '2 day'
        AND p.status != 'Discharged'
        AND pt.is_visible = TRUE
    `;

    const queryParams = [staffId, hospital_id];

    if (patientId) {
      query += ` AND pt.patient_id = $3`;
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
    const { id: staffId, hospital_id } = req.user;
    const { patientId } = req.query;

    let query = `
      SELECT   pt.id AS patient_task_id,
        pt.task_id AS task_id, pt.due_date,
             p.last_name || ', ' || p.first_name AS patient_name,
             t.name AS task_name
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      JOIN patients p ON pt.patient_id = p.id AND p.hospital_id = $2
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

    const queryParams = [staffId, hospital_id];

    if (patientId) {
      query += ` AND pt.patient_id = $3`;
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
    const { followUpReason } = req.body;
    const { id: staffId, hospital_id } = req.user;
    const timezone = req.headers['x-timezone'] || 'America/New_York';

    if (!followUpReason || followUpReason.trim() === "") {
      return res.status(400).json({ error: "Follow-up reason is required." });
    }

    // Step 1: Fetch task from patient_tasks with hospital check
    const taskRes = await pool.query(`
      SELECT pt.*, p.hospital_id AS patient_hospital_id
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      WHERE pt.id = $1 AND p.hospital_id = $2
    `, [taskId, hospital_id]);

    if (taskRes.rows.length === 0) {
      return res.status(404).json({ error: "Task not found or unauthorized hospital access" });
    }

    const task = taskRes.rows[0];

    // Step 2: Fetch task details
    const taskDetailsRes = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [task.task_id]);
    const taskDetails = taskDetailsRes.rows[0];

    const isManualFollowUpTask =
      taskDetails.is_repeating === true &&
      taskDetails.due_in_days_after_dependency !== null;

    if (!isManualFollowUpTask) {
      return res.status(400).json({
        error: "This task is not eligible for manual follow-up based on properties.",
      });
    }

    const nowLocal = DateTime.local().setZone(timezone);
    const nextDueLocal = nowLocal.plus({ days: taskDetails.recurrence_interval }).set({
      hour: 23, minute: 59, second: 0, millisecond: 0
    });
    const nextDue = nextDueLocal.toUTC().toJSDate();

    await pool.query(`
      UPDATE patient_tasks
      SET status = 'Follow Up', due_date = $1
      WHERE id = $2
    `, [nextDue, taskId]);

    await appendStatusHistory(taskId, {
      status: "Follow Up",
      timestamp: nowLocal.toUTC().toJSDate().toISOString(),
      note: followUpReason,
      staff_id: staffId
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
    const { task_note, include_note_in_report, contact_info } = req.body;
    const { hospital_id } = req.user;

    // ✅ Fetch task and validate hospital ownership
    const taskRes = await pool.query(`
      SELECT pt.*, p.hospital_id
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      WHERE pt.id = $1 AND p.hospital_id = $2
    `, [taskId, hospital_id]);

    if (taskRes.rows.length === 0) {
      return res.status(404).json({ error: "Task not found or unauthorized hospital access" });
    }

    const current = taskRes.rows[0];

    // ✅ Proceed with update
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

const acknowledgeTask = async (req, res) => {
  const taskId = parseInt(req.params.id, 10); 
  const userId = parseInt(req.user.id, 10); 
 const nowUTC = new Date().toISOString();
  try {
    const result = await pool.query(
      `
      UPDATE patient_tasks
      SET status = 'Acknowledged',
          status_history = status_history || jsonb_build_object(
            'status', 'Acknowledged',
            'timestamp',  $1::timestamptz,
            'staff_id', $2::INT
          )::jsonb
      WHERE id = $3::INT
      RETURNING *
      `,
      [nowUTC,userId, taskId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found or already acknowledged' });
    }

    res.json({ message: 'Task acknowledged successfully', task: result.rows[0] });
  } catch (err) {
    console.error('❌ Error acknowledging task:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};



module.exports = {
  startTask,
  completeTask,
  markTaskAsMissed,
  getMissedTasks,
  getPriorityTasks,
  followUpCourtTask,
  updateTaskNote,
  acknowledgeTask,

};
