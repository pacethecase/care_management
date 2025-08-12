const pool = require("../models/db");
const { DateTime } = require('luxon');

const appendStatusHistory = async (taskId, newEntry, client) => {
   const timezone = "America/New_York"; 
  const timestamp = DateTime.local().setZone(timezone).toFormat("yyyy-MM-dd HH:mm:ssZZ");

  await client.query(`
    UPDATE patient_tasks
    SET status_history = status_history || $2::jsonb
    WHERE id = $1
  `, [taskId, JSON.stringify([{
    ...newEntry,
    timestamp
  }])]);
};



const startTask = async (req, res) => {
  const client = await pool.connect();
  try {
    const { taskId } = req.params;
    const staffId = req.user.id;
    const hospitalId = req.user.hospital_id;

    if (!req.user?.is_approved) {
      return res.status(403).json({ error: "Access denied: user not approved" });
    }

    await client.query("BEGIN");

    // 🔐 Step 1: Lock task row & validate hospital
    const { rows } = await client.query(`
      SELECT pt.*, p.hospital_id
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      WHERE pt.id = $1
      FOR UPDATE
    `, [taskId]);

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Task not found" });
    }

    const task = rows[0];

    if (task.hospital_id !== hospitalId) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Unauthorized: Task not in your hospital" });
    }

    if (task.status !== 'Pending' && task.status !== 'Missed' && task.status !== 'Follow Up') {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Task already in progress or completed." });
    }

    // ⛔ Missed Task: Check for valid reason
    if (task.status === 'Missed') {
      const { rows: historyRows } = await client.query(`
        SELECT jsonb_array_elements(status_history) AS entry
        FROM patient_tasks WHERE id = $1
      `, [taskId]);

      const hasReason = historyRows.some(row => {
        const entry = row.entry;
        return entry.status === "Missed" && entry.reason;
      });

      if (!hasReason) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Cannot start a missed task without a missed reason." });
      }
    }

    // 🟢 Step 2: Update status to In Progress
    await client.query(`
      UPDATE patient_tasks 
      SET status = 'In Progress', started_at = NOW()
      WHERE id = $1
    `, [taskId]);

    await appendStatusHistory(taskId, {
      status: "In Progress",
      staff_id: staffId
    }, client);

    await client.query("COMMIT");
    return res.status(200).json({ message: "✅ Task started successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error starting task:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};



// ✅ Complete Task (handle repeat + dependency)
const completeTask = async (req, res) => {
   const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { taskId } = req.params;
    const { court_date, override_date,reason,missed_reason } = req.body;
    
  
    if (!req.user?.is_approved) {
      return res.status(403).json({ error: "Access denied: user not approved" });
    }


    const timezone = req.headers['x-timezone'] || 'America/New_York';
    console.log("Completing task with ID:", taskId);

    // Step 1: Fetch task from patient_tasks
const hospitalId = req.user.hospital_id;

const taskRes = await client.query(`
  SELECT pt.*, p.hospital_id 
  FROM patient_tasks pt
  JOIN patients p ON pt.patient_id = p.id
  WHERE pt.id = $1
  FOR UPDATE
`, [taskId]);

    if (taskRes.rows.length === 0) {
       await client.query("ROLLBACK");
      console.log("❌ Task not found");
      return res.status(404).json({ error: "Task not found" });
    }

    const task = taskRes.rows[0];
  const completionReason = reason?.trim();
  const missedReason = missed_reason?.trim();
  let updatedMissed = false;

   
    if (task.status !== "Missed" && !completionReason) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Reason is required to complete this task." });
    }
      if (['Completed', 'Delayed Completed'].includes(task.status)) {
    await client.query("ROLLBACK");
    return res.status(409).json({ error: "Task has already been completed." });
  }

    if (task.hospital_id !== hospitalId) {
        await client.query("ROLLBACK");
      return res.status(403).json({ error: "Unauthorized: Task does not belong to your hospital." });
    }

    const completedAt = new Date(); 


    if (task.status === 'Missed') {
  let history = [];

  try {
    const historyRes = await client.query(
      `SELECT status_history FROM patient_tasks WHERE id = $1`,
      [taskId]
    );
    history = historyRes.rows[0]?.status_history || [];
  } catch (e) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "Failed to fetch task history." });
  }




try {
  const historyRes = await client.query(
    `SELECT status_history FROM patient_tasks WHERE id = $1`,
    [taskId]
  );
  history = historyRes.rows[0]?.status_history || [];
} catch (e) {
  await client.query("ROLLBACK");
  return res.status(500).json({ error: "Failed to fetch task history." });
}

if (task.status === "Missed") {
  const missedWithoutReason = [...history].reverse().find(
    h => h.status === "Missed" && !h.reason
  );

  if (missedWithoutReason && missedReason) {
    const index = history.findIndex(
      h => h.status === "Missed" && !h.reason
    );
    if (index !== -1) {
      history[index].reason = missedReason;
      history[index].staff_id = req.user.id;
      updatedMissed = true;

      await client.query(
        `UPDATE patient_tasks SET status_history = $1 WHERE id = $2`,
        [JSON.stringify(history), taskId]
      );
    }
  } else if (missedWithoutReason && !missedReason) {
    await client.query("ROLLBACK");
    return res.status(400).json({
      error: "This task was marked as missed, but no reason was provided. Please provide a reason first."
    });
  }
} 
}

    
    // Step 3: Fetch metadata
    const [taskDetailsRes, patientRes, patientStatusRes] = await Promise.all([
      client.query(`SELECT * FROM tasks WHERE id = $1`, [task.task_id]),
      client.query(`SELECT * FROM patients WHERE id = $1`, [task.patient_id]),
      client.query(`SELECT status FROM patients WHERE id = $1`, [task.patient_id]),
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
  const courtDateUTC = DateTime.fromISO(court_date, { zone: timezone }).toUTC().toISO();

  // Determine which field to update
  const fieldToUpdate = taskDetails.name.includes("State")
    ? "ltc_court_datetime"
    : "guardianship_court_datetime";

  await client.query(
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

if (task.due_date) {
  const dueCutoffUTC = DateTime.fromJSDate(task.ideal_due_date)
  .setZone(timezone)
  .set({ hour: 23, minute: 59, second: 0, millisecond: 0 })
  .toUTC()
  .toJSDate();

  if (completedAt > dueCutoffUTC) {
    finalStatus = "Delayed Completed";
  }
}

// ✅ Update task in DB
await client.query(`
  UPDATE patient_tasks 
  SET status = $1, completed_at = $2, override_due_date = $3
  WHERE id = $4
`, [finalStatus, completedAt, overrideDate, taskId]);


    task.completed_at = completedAt;
    task.override_due_date = overrideDate; 

      await appendStatusHistory(taskId, {
        status: finalStatus,
        staff_id: req.user.id,
        ...(completionReason && { reason: completionReason }),
      }, client);


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

  await client.query(
    `INSERT INTO patient_tasks (patient_id, task_id, status, due_date)
     VALUES ($1, $2, 'Pending', $3)`,
    [task.patient_id, taskDetails.id, nextDue]
  );

  console.log(
    `🔁 Repeating task '${taskDetails.name}' scheduled for ${nextDue.toDateString()} (Ideal: ${ideal_due_date.toDateString()})`
  );
}


    // Step 5: Handle dependent tasks
    const depRes = await client.query(`
      SELECT t.*
      FROM tasks t
      JOIN task_dependencies td ON t.id = td.task_id
      WHERE td.depends_on_task_id = $1
    `, [task.task_id]);

    for (const dep of depRes.rows) {
      console.log(`Checking dependent task: ${dep.name}`);

      const exists = await client.query(
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
        await client.query(
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



await client.query(
  `INSERT INTO patient_tasks (patient_id, task_id, status, due_date, ideal_due_date)
   VALUES ($1, $2, 'Pending', $3, $4)`,
  [task.patient_id, dep.id, due, idealBaseDate]
);

console.log(`📌 Dependent task '${dep.name}' scheduled for ${due.toDateString()}`);

    }
    await client.query("COMMIT");

    res.status(200).json({ message: "Task completed successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error completing task:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }finally {
    client.release();
  }
};



// 🟥 Mark a Task as Missed
const markTaskAsMissed = async (req, res) => {
  const client = await pool.connect();
  try {
    const { taskId } = req.params;
    const { missed_reason } = req.body;
    const staffId = req.user.id;

    if (!req.user?.is_approved) {
      return res.status(403).json({ error: "Access denied: user not approved" });
    }

    if (!missed_reason || missed_reason.trim() === "") {
      return res.status(400).json({ error: "Missed reason is required." });
    }

    const hospitalId = req.user.hospital_id;
    await client.query("BEGIN");

    // ✅ Use client.query here
    const taskRes = await client.query(`
      SELECT pt.*, p.hospital_id 
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      WHERE pt.id = $1
      FOR UPDATE
    `, [taskId]);

    if (taskRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Task not found" });
    }

    const task = taskRes.rows[0];

    if (task.hospital_id !== hospitalId) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Unauthorized: Task does not belong to your hospital." });
    }

      if (task.status === "Missed") {
  // Allow reason update if not already provided
  const historyRes = await client.query(`SELECT status_history FROM patient_tasks WHERE id = $1`, [taskId]);
  const history = historyRes.rows[0]?.status_history || [];

  const hasReason = history.some(h => h.status === 'Missed' && h.reason?.trim());
  
  if (hasReason) {
    await client.query("ROLLBACK");
    return res.status(409).json({ error: "This task has already been marked as missed." });
  }

  // ✅ Add missing reason to history
  await appendStatusHistory(taskId, {
    status: "Missed",
    reason: missed_reason,
    staff_id: staffId
  }, client);

  await client.query("COMMIT");
  return res.status(200).json({ message: "Missed reason updated." });
}


      if (task.status === "Completed") {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "This task is already completed and cannot be marked as missed." });
      }

      

    // ✅ Update status
    await client.query(`
      UPDATE patient_tasks 
      SET status = 'Missed'
      WHERE id = $1
    `, [taskId]);

    // ✅ Append to status_history
    await appendStatusHistory(taskId, {
      status: "Missed",
      reason: missed_reason,
      staff_id: staffId
    }, client);

    await client.query("COMMIT");

    return res.status(200).json({ message: "Task marked as missed." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error marking task missed:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};

// 🚨 Get Priority Tasks (due today/tomorrow)
const getPriorityTasks = async (req, res) => {
  try {
    const { id: staffId, hospital_id } = req.user;
    const { patientId } = req.query;
if (!req.user?.is_approved) {
  return res.status(403).json({ error: "Access denied: user not approved" });
}
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
if (!req.user?.is_approved) {
  return res.status(403).json({ error: "Access denied: user not approved" });
}
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
  const client = await pool.connect();
  try {
    const { taskId } = req.params;
    const { followUpReason } = req.body;
    const { id: staffId, hospital_id } = req.user;
    const timezone = req.headers["x-timezone"] || "America/New_York";

    if (!req.user?.is_approved) {
      return res.status(403).json({ error: "Access denied: user not approved" });
    }

    if (!followUpReason || followUpReason.trim() === "") {
      return res.status(400).json({ error: "Follow-up reason is required." });
    }

    await client.query("BEGIN");

    // 🔐 Lock task row
   const taskRes = await client.query(`
  SELECT 
    pt.*, 
    p.hospital_id AS patient_hospital_id,
    t.is_non_blocking
  FROM patient_tasks pt
  JOIN patients p ON pt.patient_id = p.id
  JOIN tasks t ON pt.task_id = t.id
  WHERE pt.id = $1 AND p.hospital_id = $2
  FOR UPDATE
`, [taskId, hospital_id]);


    if (taskRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Task not found or unauthorized hospital access" });
    }

    const task = taskRes.rows[0];



    // Step 2: Check if task is eligible
    const taskDetailsRes = await client.query(`SELECT * FROM tasks WHERE id = $1`, [task.task_id]);
    const taskDetails = taskDetailsRes.rows[0];
    console.log(task);

   const isManualFollowUpTask =
        taskDetails.is_repeating === true &&
        taskDetails.due_in_days_after_dependency !== null;

      const isNonBlocking = task.is_non_blocking === true;
console.log(isNonBlocking);
      if (!isManualFollowUpTask && !isNonBlocking) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "This task is not eligible for follow-up.",
        });
      }


    // ⛔ If Missed: update missed entry with reason if not set
    if (task.status === "Missed") {
      const statusHistory = Array.isArray(task.status_history) ? task.status_history : [];
      const missedIndex = [...statusHistory].reverse().findIndex(entry => entry.status === "Missed");
      if (missedIndex !== -1) {
        const realIndex = statusHistory.length - 1 - missedIndex;
        if (!statusHistory[realIndex].note) {
          statusHistory[realIndex].note = followUpReason;
          await client.query(
            `UPDATE patient_tasks SET status_history = $1 WHERE id = $2`,
            [JSON.stringify(statusHistory), taskId]
          );
        }
      }
    }
if (isNonBlocking) {
  const newStatusHistory = [
    {
      status: "Follow Up",
      timestamp: new Date().toISOString(),
      reason: followUpReason,
      staff_id: staffId
    }
  ];
const insertRes = await client.query(`
  INSERT INTO patient_tasks (
    patient_id,
    task_id,
    status,
    status_history
  )
  VALUES ($1, $2, 'Pending', $3)
  RETURNING id
`, [
  task.patient_id,
  task.task_id,
  JSON.stringify(newStatusHistory)
]);

  await client.query("COMMIT");

  console.log(`🆕 Follow-up non-blocking task inserted with ID ${insertRes.rows[0].id}`);
  return res.status(200).json({ message: "Non-blocking follow-up task created." });
}
    // 🗓 Calculate new due date
    const nowLocal = DateTime.local().setZone(timezone);
    const nextDueLocal = nowLocal.plus({ days: taskDetails.recurrence_interval }).set({
      hour: 23, minute: 59, second: 0, millisecond: 0
    });
    const nextDue = nextDueLocal.toUTC().toJSDate();

    // ✅ Update status and due date
    await client.query(`
      UPDATE patient_tasks
      SET status = 'Follow Up', due_date = $1
      WHERE id = $2
    `, [nextDue, taskId]);

    // ✅ Add to status_history
    await appendStatusHistory(taskId, {
      status: "Follow Up",
      reason: followUpReason,
      staff_id: staffId,
    }, client);

    await client.query("COMMIT");

    console.log(`🔁 Follow-up for '${taskDetails.name}' set for ${nextDue.toDateString()}`);
    res.status(200).json({ message: "Follow-up scheduled successfully." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error in followUpCourtTask:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};


const updateTaskNote = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { task_note, include_note_in_report, contact_info } = req.body;
    const { hospital_id } = req.user;
      if (!req.user?.is_approved) {
        return res.status(403).json({ error: "Access denied: user not approved" });
      }
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
  const client = await pool.connect();
  try {
    const taskId = parseInt(req.params.id, 10);
    const staffId = parseInt(req.user.id, 10);
    const { reason } = req.body;
  

    if (!req.user?.is_approved) {
      return res.status(403).json({ error: "Access denied: user not approved" });
    }

    if (!reason || reason.trim() === "") {
      return res.status(400).json({ error: "Reason is required to acknowledge this task." });
    }

    if (isNaN(taskId)) {
      return res.status(400).json({ error: "Invalid task ID." });
    }

    await client.query("BEGIN");

    // ✅ Lock and fetch the task
    const taskRes = await client.query(`
      SELECT pt.*, p.hospital_id
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      WHERE pt.id = $1
      FOR UPDATE
    `, [taskId]);

    if (taskRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Task not found" });
    }

    const task = taskRes.rows[0];
    const hospitalId = req.user.hospital_id;

    if (task.hospital_id !== hospitalId) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Unauthorized: Task does not belong to your hospital." });
    }

    if (task.status === "Acknowledged") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "This task is already acknowledged." });
    }

    // ✅ Update task status
    await client.query(`
      UPDATE patient_tasks
      SET status = 'Acknowledged',
       completed_at = NOW()
      WHERE id = $1
    `, [taskId]);

    // ✅ Append to status history
    await appendStatusHistory(taskId, {
      status: "Acknowledged",
      staff_id: staffId,
      reason: reason.trim(),
    }, client);

    await client.query("COMMIT");

    res.status(200).json({ message: "Task acknowledged successfully." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error acknowledging task:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const addManualTaskForPatient = async (req, res) => {
  const patientId = Number(req.params.id);
  const timezone = req.headers["x-timezone"] || "America/New_York";

  const {
    name,
    description,
    is_repeating = false,
    recurrence_interval = null,
    is_overridable = false,
    is_non_blocking = false, // ✅ NEW FIELD
    algorithm = null,
  } = req.body;

  if (!name || !description) {
    return res.status(400).json({ error: "Name and description are required." });
  }

  try {
  
    const taskInsertRes = await pool.query(
      `INSERT INTO tasks (
        name, description, is_repeating, recurrence_interval, 
        is_overridable, is_non_blocking, algorithm, is_manual
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
      RETURNING id`,
      [
        name,
        description,
        is_repeating,
        recurrence_interval,
        is_overridable,
        is_non_blocking,
        algorithm,
      ]
    );

    const taskId = taskInsertRes.rows[0].id;

    
    const dueLocal = DateTime.now().setZone(timezone).set({
      hour: 23,
      minute: 59,
      second: 0,
      millisecond: 0,
    });

    const dueDateUTC = dueLocal.toUTC().toJSDate();


    await pool.query(
      `INSERT INTO patient_tasks (
        patient_id, task_id, status, due_date, ideal_due_date, is_visible
      ) VALUES ($1, $2, 'Pending', $3, $3, TRUE)`,
      [patientId, taskId, dueDateUTC]
    );

    res.status(201).json({ message: "✅ Manual task created and assigned successfully." });
  } catch (err) {
    console.error("❌ Error creating manual task:", err);
    res.status(500).json({ error: "Failed to create manual task." });
  }
};

const getTaskNames = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT t.name AS task_name
       FROM tasks t
       WHERE t.is_manual IS NOT TRUE
       ORDER BY t.name`,
    );

    const taskNames = result.rows.map(row => row.task_name);
    res.json(taskNames);
  } catch (err) {
    console.error("❌ Error fetching task names:", err);
    res.status(500).json({ error: "Failed to fetch task names" });
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
  addManualTaskForPatient,
  getTaskNames

};
