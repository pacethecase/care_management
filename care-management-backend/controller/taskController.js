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

    const taskRes = await pool.query(`SELECT * FROM patient_tasks WHERE id = $1`, [taskId]);
    if (taskRes.rows.length === 0) return res.status(404).json({ error: "Task not found" });

    const task = taskRes.rows[0];

    await pool.query(`
      UPDATE patient_tasks 
      SET status = 'Completed', completed_at = NOW()
      WHERE id = $1
    `, [taskId]);

    await appendStatusHistory(taskId, {
      status: "Completed",
      timestamp: new Date().toISOString()
    });

    // 📌 Get task details + patient status
    const [taskDetailsRes, patientStatusRes] = await Promise.all([
      pool.query(`SELECT * FROM tasks WHERE id = $1`, [task.task_id]),
      pool.query(`SELECT status FROM patients WHERE id = $1`, [task.patient_id])
    ]);

    const taskDetails = taskDetailsRes.rows[0];
    const patientStatus = patientStatusRes.rows[0]?.status;

    // 🔁 Schedule next if repeating
    if (
      taskDetails.is_repeating &&
      taskDetails.recurrence_interval &&
      patientStatus !== "Discharged"
    ) {
      const nextDue = new Date(task.due_date);
      nextDue.setDate(nextDue.getDate() + taskDetails.recurrence_interval);
      nextDue.setHours(0, 0, 0, 0);

      await pool.query(
        `INSERT INTO patient_tasks (patient_id, task_id, assigned_staff_id, status, due_date)
         VALUES ($1, $2, $3, 'Pending', $4)`,
        [task.patient_id, taskDetails.id, task.assigned_staff_id, nextDue]
      );

      console.log(`🔁 Repeating task scheduled for ${nextDue.toDateString()}`);
    }

    // 🔗 Trigger dependent task
    const depRes = await pool.query(
      `SELECT * FROM tasks WHERE dependency_task_id = $1`,
      [task.task_id]
    );

    for (const dep of depRes.rows) {
      const exists = await pool.query(
        `SELECT 1 FROM patient_tasks
         WHERE patient_id = $1 AND task_id = $2 AND status IN ('Pending', 'In Progress')`,
        [task.patient_id, dep.id]
      );
      if (exists.rows.length > 0) continue;

      const due = new Date();
      due.setDate(due.getDate() + (dep.recurrence_interval || 0));
      due.setHours(0, 0, 0, 0);

      await pool.query(
        `INSERT INTO patient_tasks (patient_id, task_id, assigned_staff_id, status, due_date)
         VALUES ($1, $2, $3, 'Pending', $4)`,
        [task.patient_id, dep.id, task.assigned_staff_id, due]
      );

      console.log(`📌 Dependent task '${dep.name}' scheduled for ${due.toDateString()}`);
    }

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

// 🕒 Get Missed Tasks Without Reasons
const getMissedTasks = async (req, res) => {
  try {
    const staffId = req.user.id;

    const result = await pool.query(`
      SELECT pt.id AS task_id, pt.due_date, p.name AS patient_name, t.name AS task_name
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      JOIN patients p ON pt.patient_id = p.id
      WHERE pt.assigned_staff_id = $1
        AND pt.status = 'Missed'
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(pt.status_history) elem
          WHERE elem->>'status' = 'Missed' AND elem ? 'reason'
        )
      ORDER BY pt.due_date ASC
    `, [staffId]);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching missed tasks:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 🚨 Get Priority Tasks (due today/tomorrow)
const getPriorityTasks = async (req, res) => {
  try {
    const staffId = req.user.id;

    const result = await pool.query(`
      SELECT pt.id AS task_id, pt.due_date, pt.status, p.name AS patient_name, t.name AS task_name
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      JOIN patients p ON pt.patient_id = p.id
      WHERE pt.assigned_staff_id = $1
        AND pt.status IN ('Pending', 'In Progress', 'Missed')
        AND pt.due_date <= CURRENT_DATE + INTERVAL '1 day'
      ORDER BY pt.due_date ASC
    `, [staffId]);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching priority tasks:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ✍️ Add Reason for Missed Task
const addMissedReason = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { missed_reason } = req.body;

    const { rows } = await pool.query(
      `SELECT status_history FROM patient_tasks WHERE id = $1`,
      [taskId]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Task not found" });

    const history = rows[0].status_history || [];
    const updated = history.map(entry =>
      entry.status === "Missed" && !entry.reason
        ? { ...entry, reason: missed_reason }
        : entry
    );

    await pool.query(
      `UPDATE patient_tasks SET status_history = $1 WHERE id = $2`,
      [JSON.stringify(updated), taskId]
    );

    res.status(200).json({ message: "Missed reason added successfully" });

  } catch (err) {
    console.error("❌ Error adding missed reason:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  startTask,
  completeTask,
  markTaskAsMissed,
  getMissedTasks,
  getPriorityTasks,
  addMissedReason
};
