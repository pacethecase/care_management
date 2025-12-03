const pool = require("../models/db");
const { DateTime } = require('luxon');

const appendStatusHistory = async (taskId, newEntry, client) => {
   const timezone = "America/New_York"; 
 const timestamp = DateTime.local().setZone(timezone).toISO(); 

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
    const { version } = req.body;
    if (version == null) {
      return res.status(400).json({ error: "Missing version." });
    }

    if (req.user?.is_super_admin || req.user?.has_global_access) {
      return res.status(403).json({ error: "Access denied" });
    }


    if (!req.user?.is_approved) {
      return res.status(403).json({ error: "Access denied" });
    }

    await client.query("BEGIN");


    const { rows } = await client.query(`
      SELECT 
        pt.id,
        pt.status,
        pt.started_at,
        pt.patient_id,
        pt.version,
        p.hospital_id
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      WHERE pt.id = $1
      FOR UPDATE
    `, [taskId]);

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Not found" });
    }

    const task = rows[0];
    if (task.version !== Number(version)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Task was updated by someone else." });
    }


    if (task.hospital_id !== hospitalId) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Access denied" });
    }

    if (req.user.is_staff) {
      const { rowCount } = await client.query(`
        SELECT 1 FROM patient_staff
        WHERE staff_id = $1 AND patient_id = $2
      `, [staffId, task.patient_id]);

      if (rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Access denied" });
      }
    }

    if (task.started_at) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Already started" });
    }

    const validStates = ["Pending", "Missed", "Follow Up"];
    if (!validStates.includes(task.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Invalid state" });
    }


    if (task.status === "Missed") {
      const { rows: historyRows } = await client.query(`
        SELECT jsonb_array_elements(status_history) AS entry
        FROM patient_tasks
        WHERE id = $1
      `, [taskId]);

      const hasReason = historyRows.some(row =>
        row.entry?.status === "Missed" && row.entry?.reason
      );

      if (!hasReason) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Missed reason required" });
      }
    }

    // 🟢 Step 2: Start task
    const updateRes = await client.query(`
      UPDATE patient_tasks
      SET status = 'In Progress',
          started_at = NOW(),
          version = version + 1
      WHERE id = $1 AND version = $2
      RETURNING id, version, status, started_at
    `, [taskId, version]);

    if (updateRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Task already started by another user." });
    }


    // 🧾 Audit trail
    await appendStatusHistory(taskId, {
      status: "In Progress",
      staff_id: staffId,
    }, client);

    await client.query("COMMIT");
    const updated = updateRes.rows[0];

    return res.status(200).json({
      taskId: updated.id,
      version: updated.version,
      status: updated.status,
      started_at: updated.started_at
    });



  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ startTask error:", err);
    return res.status(500).json({ error: "Internal error" });
  } finally {
    client.release();
  }
};



const completeTask = async (req, res) => {
  const client = await pool.connect();

  try {
    const { taskId } = req.params;
    const { court_date, reason, missed_reason,version } = req.body;

    if (version == null) {
      return res.status(400).json({ error: "Missing version." });
    }

    const user = req.user;
    const timezone = req.headers["x-timezone"] || "America/New_York";
    console.log(timezone);
    if (user?.is_super_admin || user?.has_global_access) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!user?.is_approved) {
      return res.status(403).json({ error: "Access denied: user not approved" });
    }

    const hospitalId = user.hospital_id;
    const staffId = user.id;

    await client.query("BEGIN");

    // Step 1: Fetch + lock task
    const taskRes = await client.query(
      `
      SELECT pt.*, p.hospital_id 
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      WHERE pt.id = $1
      FOR UPDATE
    `,
      [taskId]
    );

    if (taskRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Task not found" });
    }

    const task = taskRes.rows[0];
    if (task.version !== Number(version)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Task was already updated by someone else." });
    }

    const completionReason = reason?.trim();
    const missedReason = missed_reason?.trim();

    if (task.hospital_id !== hospitalId) {
      await client.query("ROLLBACK");
      return res
        .status(403)
        .json({ error: "Unauthorized: Task does not belong to your hospital." });
    }

    // Staff must be assigned to this patient
    if (user.is_staff) {
      const { rowCount } = await client.query(
        `
        SELECT 1 FROM patient_staff
        WHERE staff_id = $1 AND patient_id = $2
      `,
        [staffId, task.patient_id]
      );

      if (rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Access denied" });
      }
    }

    if (["Completed", "Delayed Completed"].includes(task.status)) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ error: "Task has already been completed." });
    }

    if (task.status !== "Missed" && !completionReason) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Reason is required to complete this task.",
      });
    }

    const completedAt = new Date();

    // Missed handling + history
    if (task.status === "Missed") {
      let history = [];

      try {
        const historyRes = await client.query(
          `SELECT status_history FROM patient_tasks WHERE id = $1`,
          [taskId]
        );
        history = historyRes.rows[0]?.status_history || [];
      } catch (e) {
        await client.query("ROLLBACK");
        return res
          .status(500)
          .json({ error: "Failed to fetch task history." });
      }

      const latestMissed = [...history].reverse().find(
        (h) => h.status === "Missed"
      );

      if (latestMissed && !latestMissed.reason) {
        if (missedReason) {
          const index = history.findIndex(
            (h) =>
              h.timestamp === latestMissed.timestamp &&
              h.status === "Missed"
          );

          if (index !== -1) {
            history[index].reason = missedReason;
            history[index].staff_id = staffId;

            await client.query(
              `UPDATE patient_tasks SET status_history = $1 WHERE id = $2`,
              [JSON.stringify(history), taskId]
            );
          }
        } else {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error:
              "This task was marked as missed, but no reason was provided. Please provide a reason first.",
          });
        }
      }
    }

    const [taskDetailsRes, patientRes, patientStatusRes] = await Promise.all([
      client.query(`SELECT * FROM tasks WHERE id = $1`, [task.task_id]),
      client.query(`SELECT * FROM patients WHERE id = $1`, [task.patient_id]),
      client.query(`SELECT status FROM patients WHERE id = $1`, [task.patient_id]),
    ]);

    const taskDetails = taskDetailsRes.rows[0];
    const patient = patientRes.rows[0];
    const patientStatus = patientStatusRes.rows[0]?.status;

    if (!taskDetails || !patient) {
      await client.query("ROLLBACK");
      return res
        .status(500)
        .json({ error: "Task metadata or patient not found." });
    }

    if (taskDetails.is_court_date) {
      console.log("Court date check required for task:", taskDetails.name);

      if (!court_date) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Court date is required to complete this task.",
        });
      }

      const courtDateUTC = DateTime.fromISO(court_date, { zone: timezone })
        .toUTC()
        .toISO();

      const fieldToUpdate = taskDetails.name.includes("State")
        ? "ltc_court_datetime"
        : "guardianship_court_datetime";

      await client.query(
        `UPDATE patients SET ${fieldToUpdate} = $1 WHERE id = $2`,
        [courtDateUTC, patient.id]
      );
    }

    let finalStatus = "Completed";

    if (task.due_date || task.ideal_due_date) {
      const dueCutoffUTC = DateTime.fromJSDate(
        task.ideal_due_date || task.due_date
      )
        .setZone(timezone)
        .set({ hour: 23, minute: 59, second: 0, millisecond: 0 })
        .toUTC()
        .toJSDate();

      if (completedAt > dueCutoffUTC) {
        finalStatus = "Delayed Completed";
      }
    }

    await client.query(
      `
      UPDATE patient_tasks 
      SET status = $1, completed_at = $2,
      version = version + 1
      WHERE id = $3 
    `,
      [finalStatus, completedAt, taskId]
    );

    task.completed_at = completedAt;

    await appendStatusHistory(
      taskId,
      {
        status: finalStatus,
        staff_id: staffId,
        ...(completionReason && { reason: completionReason }),
      },
      client
    );
    if (taskDetails.is_non_blocking) {
      console.log(
        "Non-blocking task completed, skipping recurrence and dependency handling."
      );
      await client.query("COMMIT");
      return res
        .status(200)
        .json({ message: "Non-blocking task completed successfully" });
    }

    const isManualFollowUpTask =
      taskDetails.is_repeating &&
      taskDetails.due_in_days_after_dependency !== null;

  
    if (
      taskDetails.is_repeating &&
      taskDetails.recurrence_interval &&
      patientStatus !== "Discharged" &&
      !isManualFollowUpTask
    ) {
      const completedBase = task.completed_at
        ? new Date(task.completed_at)
        : new Date();
      const previousIdealDue = task.ideal_due_date
        ? new Date(task.ideal_due_date)
        : new Date();

      const dueLocal = DateTime.fromJSDate(completedBase)
        .setZone(timezone)
        .plus({ days: taskDetails.recurrence_interval })
        .set({ hour: 23, minute: 59, second: 0, millisecond: 0 });

      const idealLocal = DateTime.fromJSDate(previousIdealDue)
        .setZone(timezone)
        .plus({ days: taskDetails.recurrence_interval })
        .set({ hour: 23, minute: 59, second: 0, millisecond: 0 });

      const nextDue = dueLocal.toUTC().toJSDate();
      const ideal_due_date = idealLocal.toUTC().toJSDate();

      await client.query(
        `
        INSERT INTO patient_tasks (patient_id, task_id, status, due_date, ideal_due_date)
        VALUES ($1, $2, 'Pending', $3, $4)
      `,
        [task.patient_id, taskDetails.id, nextDue, ideal_due_date]
      );
    }
    const depRes = await client.query(
      `
      SELECT t.*
      FROM tasks t
      JOIN task_dependencies td ON t.id = td.task_id
      WHERE td.depends_on_task_id = $1
    `,
      [task.task_id]
    );

    for (const dep of depRes.rows) {
      const exists = await client.query(
        `
        SELECT 1
        FROM patient_tasks
        WHERE patient_id = $1
          AND task_id = $2
          AND status IN ('Pending', 'In Progress')
      `,
        [task.patient_id, dep.id]
      );

      if (exists.rows.length > 0) {
        continue;
      }

      // Flow-based skips
      if (
        dep.name === "LTC - Begin compiling needed financial/legal information" &&
        patient.is_ltc_medical &&
        !patient.is_ltc_financial
      ) {
        continue;
      }

      if (
        dep.name === "LTC - Follow up with state on Medical Application status" &&
        patient.is_ltc_financial
      ) {
        continue;
      }

      if (
        dep.name === "Guardianship - Confirm Guardianship Appointed" &&
        !patient.is_guardianship_emergency
      ) {
        continue;
      }

      if (dep.is_non_blocking) {
        await client.query(
          `
          INSERT INTO patient_tasks (patient_id, task_id, status)
          VALUES ($1, $2, 'Pending')
        `,
          [task.patient_id, dep.id]
        );
        continue;
      }

      let due, idealBaseDate;

      if (task.override_due_date) {
        const override = DateTime.fromJSDate(new Date(task.override_due_date))
          .setZone(timezone)
          .set({ hour: 23, minute: 59, second: 0, millisecond: 0 });

        due = override.toUTC().toJSDate();
        idealBaseDate = override.toUTC().toJSDate();
      } else {
        const idealBaseDateLocal = DateTime.fromJSDate(
          task.ideal_due_date || task.due_date || task.completed_at || new Date()
        ).setZone(timezone);

        const dueBaseLocal = DateTime.fromJSDate(
          task.completed_at || new Date()
        ).setZone(timezone);

        if (
          dep.is_repeating &&
          dep.recurrence_interval != null &&
          dep.due_in_days_after_dependency == null
        ) {
          const dueDate = dueBaseLocal
            .plus({ days: dep.recurrence_interval })
            .set({ hour: 23, minute: 59, second: 0, millisecond: 0 });

          const idealDate = idealBaseDateLocal
            .plus({ days: dep.recurrence_interval })
            .set({ hour: 23, minute: 59, second: 0, millisecond: 0 });

          due = dueDate.toUTC().toJSDate();
          idealBaseDate = idealDate.toUTC().toJSDate();
        } else if (dep.due_in_days_after_dependency != null) {
          const dueDate = dueBaseLocal
            .plus({ days: dep.due_in_days_after_dependency })
            .set({ hour: 23, minute: 59, second: 0, millisecond: 0 });

          const idealDate = idealBaseDateLocal
            .plus({ days: dep.due_in_days_after_dependency })
            .set({ hour: 23, minute: 59, second: 0, millisecond: 0 });

          due = dueDate.toUTC().toJSDate();
          idealBaseDate = idealDate.toUTC().toJSDate();
        }
      }

      if (!due || !idealBaseDate) {
        console.warn(
          `⚠️ Skipping '${dep.name}' due to missing date calculations`
        );
        continue;
      }

      await client.query(
        `
        INSERT INTO patient_tasks (patient_id, task_id, status, due_date, ideal_due_date)
        VALUES ($1, $2, 'Pending', $3, $4)
      `,
        [task.patient_id, dep.id, due, idealBaseDate]
      );
    }

    await client.query("COMMIT");
    return res.status(200).json({ message: "Task completed successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error completing task:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};




const markTaskAsMissed = async (req, res) => {
  const client = await pool.connect();
  try {
    const { taskId } = req.params;
    const { missed_reason,version } = req.body;
    if (version == null) {
      return res.status(400).json({ error: "Missing version." });
    }
    const staffId = req.user?.id;
    const hospitalId = req.user?.hospital_id;
    if (!req.user?.is_approved) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!missed_reason || missed_reason.trim() === "") {
      return res.status(400).json({ error: "Missed reason is required." });
    }
    await client.query("BEGIN");


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
    if (task.version !== Number(version)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Task has been modified by another user." });
    }


    if (task.hospital_id !== hospitalId) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Unauthorized: Task does not belong to your hospital." });
    }

     if (req.user?.is_staff) {
      const { rowCount } = await client.query(`
        SELECT 1 FROM patient_staff
        WHERE staff_id = $1 AND patient_id = $2
      `, [staffId, task.patient_id]);

      if (rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Access denied" });
      }
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
        await appendStatusHistory(taskId, {
          status: "Missed",
          reason: missed_reason,
          staff_id: staffId
        }, client);

        await client.query("COMMIT");
        return res.status(200).json({ message: "Missed reason updated." });
      }


      if (task.status === "Completed" || task.status === "Delayed Completed") {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "This task is already completed and cannot be marked as missed." });
      }

  
    await client.query(`
      UPDATE patient_tasks 
      SET status = 'Missed',
      version = version + 1
      WHERE id = $1
    `, [taskId]);


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
        pt.version,
        pt.updated_at,
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
        AND p.status = 'Admitted'
        AND COALESCE(p.is_archived, false) = false
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

const getMissedTasks = async (req, res) => {
  try {
    const { id: staffId, hospital_id } = req.user;
    const { patientId } = req.query;
if (!req.user?.is_approved) {
  return res.status(403).json({ error: "Access denied: user not approved" });
}
    let query = `
      SELECT   pt.id AS patient_task_id,
      pt.version,
      pt.updated_at,
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
        AND p.status = 'Admitted'
        AND COALESCE(p.is_archived, false) = false
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
    const { followUpReason,version } = req.body;
    const { id: staffId, hospital_id } = req.user;
    const timezone = req.headers["x-timezone"] || "America/New_York";

    if (version == null) {
      return res.status(400).json({ error: "Missing version." });
    }

    if (!req.user?.is_approved) {
      return res.status(403).json({ error: "Access denied: user not approved" });
    }
    if (req.user?.is_super_admin || req.user?.has_global_access) {
      return res.status(403).json({ error: "Access denied: org-level role" });
    }

    if (!followUpReason || followUpReason.trim() === "") {
      return res.status(400).json({ error: "Follow-up reason is required." });
    }

    await client.query("BEGIN");


    const taskRes = await client.query(
      `
      SELECT 
        pt.*,
        p.hospital_id AS patient_hospital_id,
        t.is_non_blocking
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      JOIN tasks t ON pt.task_id = t.id
      WHERE pt.id = $1 AND p.hospital_id = $2
      FOR UPDATE
    `,
      [taskId, hospital_id]
    );

    if (taskRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ error: "Task not found or unauthorized hospital access" });
    }

    const task = taskRes.rows[0];
    if (task.version !== Number(version)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Task already modified by someone else." });
    }


    if (req.user?.is_staff) {
      const { rowCount } = await client.query(
        `
        SELECT 1 FROM patient_staff
        WHERE staff_id = $1 AND patient_id = $2
      `,
        [staffId, task.patient_id]
      );

      if (rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Access denied: patient not assigned" });
      }
    }

   
    const taskDetailsRes = await client.query(
      `SELECT * FROM tasks WHERE id = $1`,
      [task.task_id]
    );
    const taskDetails = taskDetailsRes.rows[0];

    if (!taskDetails) {
      await client.query("ROLLBACK");
      return res.status(500).json({ error: "Task metadata missing" });
    }


    const isManualFollowUpTask =
      taskDetails.is_repeating === true &&
      taskDetails.due_in_days_after_dependency !== null;

    const isNonBlocking = task.is_non_blocking === true;

    if (!isManualFollowUpTask && !isNonBlocking) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "This task is not eligible for follow-up.",
      });
    }

    
    if (task.status === "Missed") {
      const statusHistory = Array.isArray(task.status_history)
        ? task.status_history
        : [];

      const missedIndex = [...statusHistory]
        .reverse()
        .findIndex((entry) => entry.status === "Missed");

      if (missedIndex !== -1) {
        const realIndex = statusHistory.length - 1 - missedIndex;

        if (!statusHistory[realIndex].note) {
          statusHistory[realIndex].note = followUpReason;
          statusHistory[realIndex].staff_id = staffId;

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
          staff_id: staffId,
        },
      ];

      const insertRes = await client.query(
        `
        INSERT INTO patient_tasks (
          patient_id,
          task_id,
          status,
          status_history
        )
        VALUES ($1, $2, 'Pending', $3)
        RETURNING id
      `,
        [
          task.patient_id,
          task.task_id,
          JSON.stringify(newStatusHistory),
        ]
      );

      await client.query("COMMIT");

      console.log(`🆕 Follow-up non-blocking task created: ${insertRes.rows[0].id}`);
      return res
        .status(200)
        .json({ message: "Non-blocking follow-up task created." });
    }


    const nextDueLocal = DateTime.now()
      .setZone(timezone)
      .plus({ days: taskDetails.recurrence_interval })
      .set({ hour: 23, minute: 59, second: 0, millisecond: 0 });

    const nextDue = nextDueLocal.toUTC().toJSDate();

    await client.query(
      `
      UPDATE patient_tasks
      SET status = 'Follow Up',
          due_date = $1,
          version = version + 1
      WHERE id = $2
    `,
      [nextDue, taskId]
    );

  
    await appendStatusHistory(
      taskId,
      {
        status: "Follow Up",
        reason: followUpReason,
        staff_id: staffId,
      },
      client
    );

    await client.query("COMMIT");

    console.log(`🔁 Follow-up scheduled for '${taskDetails.name}' at ${nextDue.toISOString()}`);

    return res.status(200).json({ message: "Follow-up scheduled successfully." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error in followUpCourtTask:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};


const updateTaskNote = async (req, res) => {
  const client = await pool.connect();

  try {
    const { taskId } = req.params;
    const { task_note, include_note_in_report, contact_info,version } = req.body;
    const { id: staffId, hospital_id } = req.user;
    if (version == null) {
      return res.status(400).json({ error: "Missing version." });
    }

    if (!req.user?.is_approved) {
      return res.status(403).json({ error: "Access denied: user not approved" });
    }

    if (req.user?.is_super_admin || req.user?.has_global_access) {
      return res.status(403).json({ error: "Access denied: org-level role" });
    }

    await client.query("BEGIN");
    const taskRes = await client.query(
      `
      SELECT pt.*, p.hospital_id
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      WHERE pt.id = $1 AND p.hospital_id = $2
      FOR UPDATE
      `,
      [taskId, hospital_id]
    );

    if (taskRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Task not found or unauthorized hospital access" });
    }

    const task = taskRes.rows[0];

    if (task.version !== Number(version)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Task was updated by another user." });
    }

    if (req.user?.is_staff) {
      const { rowCount } = await client.query(
        `
        SELECT 1 FROM patient_staff
        WHERE patient_id = $1 AND staff_id = $2
        `,
        [task.patient_id, staffId]
      );

      if (rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Access denied: patient not assigned" });
      }
    }

    // ✅ Update always allowed (overwrite permitted)
    const result = await client.query(
      `
      UPDATE patient_tasks
      SET task_note = COALESCE($1, task_note),
          include_note_in_report = COALESCE($2, include_note_in_report),
          contact_info = COALESCE($3, contact_info),
          updated_at = NOW(),
          version = version + 1
      WHERE id = $4
      RETURNING *
      `,
      [task_note, include_note_in_report, contact_info, taskId]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Task metadata updated",
      task: result.rows[0],
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error updating task note/contact:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
};

const acknowledgeTask = async (req, res) => {
  const client = await pool.connect();

  try {
    const taskId = parseInt(req.params.id, 10);
    const staffId = parseInt(req.user.id, 10);
    const hospitalId = req.user.hospital_id;
    const { reason,version } = req.body;
    if (version == null) {
      return res.status(400).json({ error: "Missing version." });
    }

    if (!req.user?.is_approved) {
      return res.status(403).json({ error: "Access denied: user not approved" });
    }
    if (req.user?.is_super_admin || req.user?.has_global_access) {
      return res.status(403).json({ error: "Access denied: org-level role" });
    }

    if (isNaN(taskId)) {
      return res.status(400).json({ error: "Invalid task ID." });
    }

    if (!reason || reason.trim() === "") {
      return res.status(400).json({ error: "Reason is required to acknowledge this task." });
    }

    await client.query("BEGIN");

    // 🔒 Lock task + validate hospital
    const taskRes = await client.query(
      `
      SELECT pt.*, p.hospital_id
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      WHERE pt.id = $1 AND p.hospital_id = $2
      FOR UPDATE
      `,
      [taskId, hospitalId]
    );

    if (taskRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Task not found or unauthorized hospital access" });
    }

    const task = taskRes.rows[0];

    if (task.version !== Number(version)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Task already updated by someone else." });
    }

    if (req.user?.is_staff) {
      const { rowCount } = await client.query(
        `
        SELECT 1 FROM patient_staff
        WHERE patient_id = $1 AND staff_id = $2
        `,
        [task.patient_id, staffId]
      );

      if (rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Access denied: patient not assigned" });
      }
    }

    if (task.status === "Acknowledged") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "This task is already acknowledged." });
    }

    await client.query(
      `
      UPDATE patient_tasks
      SET status = 'Acknowledged',
          version = version + 1,
          completed_at = NOW()
      WHERE id = $1
      `,
      [taskId]
    );

    await appendStatusHistory(
      taskId,
      {
        status: "Acknowledged",
        staff_id: staffId,
        reason: reason.trim(),
      },
      client
    );

    await client.query("COMMIT");

    return res.status(200).json({ message: "Task acknowledged successfully." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error acknowledging task:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};


const addManualTaskForPatient = async (req, res) => {
  const client = await pool.connect();

  try {
    const patientId = Number(req.params.id);
    const timezone = req.headers["x-timezone"] || "America/New_York";

    const {
      name,
      description,
      is_repeating = false,
      recurrence_interval = null,
      is_overridable = false,
      is_non_blocking = false,
      algorithm = null,
      due_date = null,
    } = req.body;

    const { id: staffId, hospital_id } = req.user;

    // ✅ Approved users only
    if (!req.user?.is_approved) {
      return res.status(403).json({ error: "Access denied: user not approved" });
    }

    // ❌ Org-level roles cannot create patient tasks
    if (req.user?.is_super_admin || req.user?.has_global_access) {
      return res.status(403).json({ error: "Access denied: org-level role" });
    }

    if (!name || !description) {
      return res.status(400).json({ error: "Name and description are required." });
    }

    if (isNaN(patientId)) {
      return res.status(400).json({ error: "Invalid patient ID." });
    }

    await client.query("BEGIN");

    // ✅ Validate patient + hospital
    const patientRes = await client.query(
      `SELECT id, hospital_id FROM patients WHERE id = $1 AND hospital_id = $2`,
      [patientId, hospital_id]
    );

    if (patientRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Patient not found or unauthorized hospital access." });
    }

    // ✅ Staff must be assigned to patient
    if (req.user?.is_staff) {
      const { rowCount } = await client.query(
        `SELECT 1 FROM patient_staff WHERE patient_id = $1 AND staff_id = $2`,
        [patientId, staffId]
      );

      if (rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Access denied: patient not assigned" });
      }
    }

    // ✅ Create task definition
    const taskInsertRes = await client.query(
      `INSERT INTO tasks (
        name,
        description,
        is_repeating,
        recurrence_interval,
        is_overridable,
        is_non_blocking,
        algorithm,
        is_manual
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
      RETURNING id`,
      [
        name.trim(),
        description.trim(),
        is_repeating,
        recurrence_interval,
        is_overridable,
        is_non_blocking,
        algorithm,
      ]
    );

    const taskId = taskInsertRes.rows[0].id;

    // 🗓 Compute due date in hospital timezone → convert to UTC
    let dueDateUTC;

    if (due_date) {
      const dueLocal = DateTime.fromISO(due_date, { zone: timezone }).set({
        hour: 23,
        minute: 59,
        second: 0,
        millisecond: 0,
      });
      dueDateUTC = dueLocal.toUTC().toJSDate();
    } else {
      const dueLocal = DateTime.now().setZone(timezone).set({
        hour: 23,
        minute: 59,
        second: 0,
        millisecond: 0,
      });
      dueDateUTC = dueLocal.toUTC().toJSDate();
    }

    // ✅ Assign to patient
    const patientTaskRes = await client.query(
      `INSERT INTO patient_tasks (
        patient_id,
        task_id,
        status,
        due_date,
        ideal_due_date,
        is_visible
      )
      VALUES ($1, $2, 'Pending', $3, $3, TRUE)
      RETURNING id`,
      [patientId, taskId, dueDateUTC]
    );

    // ✅ Write status history
    await appendStatusHistory(
      patientTaskRes.rows[0].id,
      {
        status: "Pending",
        staff_id: staffId,
        reason: "Manual task created",
      },
      client
    );

    await client.query("COMMIT");

    return res.status(201).json({ message: "✅ Manual task created successfully." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error creating manual task:", err);
    return res.status(500).json({ error: "Failed to create manual task." });

  } finally {
    client.release();
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

const overrideTask = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(taskId)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Invalid patient_task_id: ${req.params.taskId}` });
    }

    const { override_date, reason,version } = req.body;

    if (version == null) {
      return res.status(400).json({ error: "Missing version." });
    }
    if (!req.user?.is_approved) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Access denied: user not approved" });
    }


    if (req.user?.is_super_admin || req.user?.has_global_access) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Access denied: org-level role" });
    }


    if (!reason?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Override reason is required." });
    }

    if (!override_date || typeof override_date !== "string") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Override date (YYYY-MM-DD) is required." });
    }

    const timezone = req.headers["x-timezone"] || "America/New_York";
    const parsed = DateTime.fromISO(override_date, { zone: timezone });
    if (!parsed.isValid) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Invalid override_date. Use YYYY-MM-DD." });
    }

    const newDueDate = parsed.set({ hour: 23, minute: 59 }).toUTC().toJSDate();

    const { rows: [task] } = await client.query(
      `
      SELECT pt.*, p.hospital_id, p.added_by_user_id, p.id AS patient_id,
             t.name AS task_name, p.first_name, p.last_name
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      JOIN tasks t ON t.id = pt.task_id
      WHERE pt.id = $1
      FOR UPDATE
      `,
      [taskId]
    );

    if (!task) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Task not found" });
    }
    if (task.version !== Number(version)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Task already updated by someone else." });
    }

  
    if (task.hospital_id !== req.user.hospital_id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Unauthorized hospital" });
    }

    if (req.user?.is_staff) {
      const { rowCount } = await client.query(
        `
        SELECT 1 FROM patient_staff
         WHERE staff_id = $1 AND patient_id = $2
        `,
        [req.user.id, task.patient_id]
      );

      if (rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Access denied: patient not assigned" });
      }
    }


    if (["Completed", "Delayed Completed", "Acknowledged"].includes(task.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Cannot override completed / acknowledged task" });
    }

    const wouldExceed = (task.override_count || 0) + 1 > task.override_count_max;


    if (wouldExceed) {

      const dup = await client.query(
        `
        SELECT 1 FROM task_override_requests
         WHERE task_id = $1 AND status = 'Pending'
         LIMIT 1
        `,
        [taskId]
      );

      if (dup.rowCount > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "An override request is already pending admin review."
        });
      }

      // 📝 Store request
      await client.query(
        `
        INSERT INTO task_override_requests
          (task_id, requested_by, requested_date, reason, status)
        VALUES ($1, $2, $3, $4, 'Pending')
        `,
        [taskId, req.user.id, newDueDate, reason.trim()]
      );

      const { rows: [admin] } = await client.query(
        `
        SELECT id FROM users
         WHERE id = $1
           AND is_admin = TRUE
           AND is_approved = TRUE
        `,
        [task.added_by_user_id]
      );

      const originalDue = task.due_date
        ? DateTime.fromJSDate(task.due_date).setZone(timezone).toFormat("yyyy-LL-dd")
        : "N/A";

      const requestedDue = DateTime.fromJSDate(newDueDate)
        .setZone(timezone)
        .toFormat("yyyy-LL-dd");

      const { rows: [staff] } = await client.query(
        `SELECT name FROM users WHERE id = $1`,
        [req.user.id]
      );

      const staffName = staff?.name || "Unknown Staff";

      const title = "Override Approval Needed";
      const message =
        `Task "${task.task_name}" for patient ${task.first_name} ${task.last_name} requires admin approval.\n\n` +
        `Requested by: ${staffName}\n` +
        `Reason: ${reason.trim()}\n` +
        `Current Due Date: ${originalDue}\n` +
        `Requested Override: ${requestedDue}`;

      let notif = null;

      if (admin) {
        const { rows: [row] } = await client.query(
          `
          INSERT INTO notifications
            (user_id, patient_id, patient_task_id, title, message, type)
          VALUES ($1, $2, $3, $4, $5, 'override_request')
          RETURNING *
          `,
          [admin.id, task.patient_id, task.id, title, message]
        );

        notif = { ...row, request_status: "Pending" };
      }

      await client.query("COMMIT");

      // 🔔 Real-time notify admin
      if (notif) {
        const io = req.app.get("io");
        io?.to?.(`user-${admin.id}`)?.emit?.("notification", notif);
      }

      return res.status(200).json({
        message: "Override request submitted for admin approval."
      });
    }
    const tsLocal = DateTime.local().setZone(timezone).toISO();

    await client.query(
      `
      UPDATE patient_tasks
         SET override_count = COALESCE(override_count,0) + 1,
            version = version + 1,
             due_date = $1,
             admin_override_approval = FALSE,
             status_history = COALESCE(status_history, '[]'::jsonb) || $3::jsonb
       WHERE id = $2
      `,
      [
        newDueDate,
        taskId,
        JSON.stringify([{
          status: "Overridden",
          reason: reason.trim(),
          staff_id: req.user.id,
          timestamp: tsLocal
        }])
      ]
    );

    await client.query("COMMIT");

    return res.json({ message: "✅ Task overridden successfully." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error overriding task:", err?.stack || err);
    return res.status(500).json({ error: "Internal Server Error" });

  } finally {
    client.release();
  }
};


const handleOverrideDecision = async (req, res) => {
  const client = await pool.connect();
  const insertedNotifications = [];

  try {
    if (!req.user?.is_approved) {
      return res.status(403).json({ error: "Access denied: user not approved" });
    }
    if (req.user?.is_super_admin || req.user?.has_global_access) {
      return res.status(403).json({ error: "Access denied: org-level role" });
    }

    if (!req.user?.is_admin) {
      return res.status(403).json({ error: "Only admins may approve overrides." });
    }

    const taskIdRaw = req.params.taskId;
    const taskId = Number(taskIdRaw);

    if (!Number.isInteger(taskId)) {
      return res.status(400).json({ error: `Invalid patient_task_id: ${taskIdRaw}` });
    }

    const { decision } = req.body;
    if (!["Approved", "Denied"].includes(decision)) {
      return res.status(400).json({ error: "Invalid decision. Must be Approved or Denied." });
    }

    await client.query("BEGIN");


    const { rows: [request] } = await client.query(
      `
      SELECT
        r.*,
        pt.id     AS patient_task_id,
        pt.patient_id,
        pt.task_id,
        p.added_by_user_id,
        t.name    AS task_name,
        p.first_name,
        p.last_name
      FROM task_override_requests r
      JOIN patient_tasks pt ON r.task_id = pt.id
      JOIN patients p       ON pt.patient_id = p.id
      JOIN tasks t          ON pt.task_id = t.id
      WHERE r.task_id = $1
        AND r.status = 'Pending'
      ORDER BY r.created_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [taskId]
    );

    if (!request) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "No pending override request found." });
    }
    if (req.user.id !== request.added_by_user_id) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "Only the admin who added this patient may approve or deny the override."
      });
    }


    if (decision === "Approved") {

      // Update task
      await client.query(
        `
        UPDATE patient_tasks
           SET due_date = $1,
               override_count = COALESCE(override_count,0) + 1,
               override_count_max = COALESCE(override_count_max,0) + 2,
               admin_override_approval = TRUE
         WHERE id = $2
        `,
        [request.requested_date, request.patient_task_id]
      );

      // Status logs
      await appendStatusHistory(request.patient_task_id, {
        status: "Overridden",
        staff_id: request.requested_by,
        reason: request.reason
      }, client);

      await appendStatusHistory(request.patient_task_id, {
        status: "Override Approved",
        staff_id: req.user.id
      }, client);

    } else {

      await appendStatusHistory(request.patient_task_id, {
        status: "Override Denied",
        staff_id: req.user.id
      }, client);
    }

    // Close request record
    await client.query(
      `
      UPDATE task_override_requests
         SET status = $1,
             approved_by = $2,
             decided_at = NOW()
       WHERE id = $3
      `,
      [decision, req.user.id, request.id]
    );

    // 🔔 Notify assigned staff
    const { rows: staffRows } = await client.query(
      `
      SELECT ps.staff_id AS id
        FROM patient_staff ps
        JOIN users u ON u.id = ps.staff_id
       WHERE ps.patient_id = $1 AND u.is_approved = TRUE
      `,
      [request.patient_id]
    );

    const title = `Override ${decision}`;
    const message =
      `Task "${request.task_name}" for patient ${request.first_name} ${request.last_name} was ${decision.toLowerCase()}.`;

    const type = decision === "Approved" ? "override_approved" : "override_denied";

    for (const r of staffRows) {
      const { rows: [notif] } = await client.query(
        `
        INSERT INTO notifications (user_id, patient_id, patient_task_id, title, message, type)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [r.id, request.patient_id, request.patient_task_id, title, message, type]
      );

      insertedNotifications.push(notif);
    }

    await client.query("COMMIT");

    // ⚡ Real-time sockets
    const io = req.app.get("io");
    for (const row of insertedNotifications) {
      io?.to?.(`user-${row.user_id}`)?.emit?.("notification", row);
    }

    return res.json({ message: `✅ Override ${decision.toLowerCase()} successfully.` });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error handling override decision:", err);
    return res.status(500).json({ error: "Internal Server Error" });

  } finally {
    client.release();
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
  getTaskNames,
  overrideTask,
  handleOverrideDecision

};
