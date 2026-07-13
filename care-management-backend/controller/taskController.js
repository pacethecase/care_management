// controller/taskController.js
const pool = require("../models/db");
const { DateTime } = require("luxon");
const { getHospitalTimezone } = require("../utils/timezone");

// ─── Role helpers ─────────────────────────────────────────────────────────────
const isSuperAdmin    = (u) => u.role === "super_admin";
const isAdmin         = (u) => u.role === "admin";
const isStaff         = (u) => u.role === "staff";
const hasGlobalAccess = (u) => u.role === "administration" && u.has_global_access;

// ─── Helper: block org-level roles from patient task operations ───────────────
const blockOrgLevel = (req, res) => {
  if (isSuperAdmin(req.user) || hasGlobalAccess(req.user)) {
    res.status(403).json({ error: "Access denied: org-level role cannot modify patient tasks." });
    return true;
  }
  return false;
};

// ─── Helper: write to patient_task_status_history (replaces JSONB append) ────
// FIX: status_history is now a proper table, not a JSONB column
const appendStatusHistory = async (patientTaskId, entry, client) => {
  await client.query(
    `INSERT INTO patient_task_status_history
      (patient_task_id, old_status, new_status, changed_by_user_id, changed_at, note)
     VALUES ($1, $2, $3, $4, NOW(), $5)`,
    [
      patientTaskId,
      entry.old_status ?? null,
      entry.status,
      entry.staff_id ?? null,
      entry.reason ?? null,
    ]
  );
};

// ─── Helper: check staff is assigned to patient ───────────────────────────────
const checkStaffAssigned = async (staffId, patientId, client) => {
  const { rowCount } = await client.query(
    `SELECT 1 FROM patient_staff WHERE staff_id = $1 AND patient_id = $2`,
    [staffId, patientId]
  );
  return rowCount > 0;
};

// ─── START TASK ───────────────────────────────────────────────────────────────
const startTask = async (req, res) => {
  const client = await pool.connect();
  try {
    const { taskId } = req.params;
    const { version } = req.body;
    const staffId   = req.user.id;
    const hospitalId = req.user.hospital_id;

    if (!req.user?.is_approved)
      return res.status(403).json({ error: "Access denied: user not approved." });
    if (version == null)
      return res.status(400).json({ error: "Missing version." });
    // FIX: role check
    if (blockOrgLevel(req, res)) return;

    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT pt.id, pt.status, pt.started_at, pt.patient_id, pt.version, p.hospital_id
       FROM patient_tasks pt
       JOIN patients p ON pt.patient_id = p.id
       WHERE pt.id = $1 FOR UPDATE`,
      [taskId]
    );

    if (!rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Task not found." }); }

    const task = rows[0];

    if (task.version !== Number(version)) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Task was updated by someone else." }); }
    if (task.hospital_id !== hospitalId) { await client.query("ROLLBACK"); return res.status(403).json({ error: "Access denied." }); }

    if (isStaff(req.user)) {
      const assigned = await checkStaffAssigned(staffId, task.patient_id, client);
      if (!assigned) { await client.query("ROLLBACK"); return res.status(403).json({ error: "Access denied: not assigned to this patient." }); }
    }

    if (task.started_at) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Task already started." }); }

    if (!["Pending", "Missed", "Follow Up"].includes(task.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: `Cannot start a task with status '${task.status}'.` });
    }

    // FIX: check missed reason from patient_task_status_history, not JSONB
    if (task.status === "Missed") {
      const { rows: histRows } = await client.query(
        `SELECT 1 FROM patient_task_status_history
         WHERE patient_task_id = $1 AND new_status = 'Missed' AND note IS NOT NULL LIMIT 1`,
        [taskId]
      );
      if (!histRows.length) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Missed reason required before starting." }); }
    }

    const { rows: [updated] } = await client.query(
      `UPDATE patient_tasks SET status = 'In Progress', started_at = NOW(), version = version + 1
       WHERE id = $1 AND version = $2
       RETURNING id, version, status, started_at`,
      [taskId, version]
    );

    if (!updated) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Task already started by another user." }); }

    await appendStatusHistory(taskId, { status: "In Progress", old_status: task.status, staff_id: staffId }, client);

    await client.query("COMMIT");
    return res.status(200).json({ taskId: updated.id, version: updated.version, status: updated.status, started_at: updated.started_at });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("startTask error:", err);
    return res.status(500).json({ error: "Internal error" });
  } finally {
    client.release();
  }
};

// ─── COMPLETE TASK ────────────────────────────────────────────────────────────
const completeTask = async (req, res) => {
  const client = await pool.connect();
  try {
    const { taskId } = req.params;
    const { court_date, reason, missed_reason, version } = req.body;
    const user = req.user;

    if (!user?.is_approved)
      return res.status(403).json({ error: "Access denied: user not approved." });
    if (version == null)
      return res.status(400).json({ error: "Missing version." });
    if (blockOrgLevel(req, res)) return;

    const hospitalId = user.hospital_id;
    const staffId    = user.id;
    const timezone   = await getHospitalTimezone(hospitalId);

    await client.query("BEGIN");

    const { rows: taskRows } = await client.query(
      `SELECT pt.*, p.hospital_id FROM patient_tasks pt
       JOIN patients p ON pt.patient_id = p.id
       WHERE pt.id = $1 FOR UPDATE`,
      [taskId]
    );

    if (!taskRows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Task not found." }); }

    const task = taskRows[0];

    if (task.version !== Number(version)) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Task was already updated by someone else." }); }
    if (task.hospital_id !== hospitalId)  { await client.query("ROLLBACK"); return res.status(403).json({ error: "Unauthorized: wrong hospital." }); }

    if (isStaff(user)) {
      const assigned = await checkStaffAssigned(staffId, task.patient_id, client);
      if (!assigned) { await client.query("ROLLBACK"); return res.status(403).json({ error: "Access denied." }); }
    }

    if (["Completed", "Delayed Completed"].includes(task.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Task already completed." });
    }

    if (task.status !== "Missed" && !reason?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Reason is required to complete this task." });
    }

    const SYSTEM_NOTE = 'Auto-marked missed by system';

    if (task.status === "Missed") {
      const { rows: missedRows } = await client.query(
        `SELECT id, note FROM patient_task_status_history
        WHERE patient_task_id = $1 AND new_status = 'Missed'
        ORDER BY changed_at DESC LIMIT 1`,
        [taskId]
      );

      const latestMissed = missedRows[0];
      const hasRealReason = latestMissed?.note && latestMissed.note !== SYSTEM_NOTE;

      if (latestMissed && !hasRealReason) {
        if (!missed_reason?.trim()) {
          await client.query("ROLLBACK");
          return res.status(400).json({ 
            error: "This task was marked as missed. Please provide a missed reason." 
          });
        }
        const finalNote = latestMissed.note === SYSTEM_NOTE
          ? `${SYSTEM_NOTE} | Staff reason: ${missed_reason.trim()}`
          : missed_reason.trim();

        await client.query(
          `UPDATE patient_task_status_history SET note = $1, changed_by_user_id = $2 WHERE id = $3`,
          [finalNote, staffId, latestMissed.id]
        );
      }
    }

    const [taskDetailsRes, patientRes] = await Promise.all([
      client.query(`SELECT * FROM tasks WHERE id = $1`, [task.task_id]),
      client.query(`SELECT * FROM patients WHERE id = $1`, [task.patient_id]),
    ]);

    const taskDetails = taskDetailsRes.rows[0];
    const patient     = patientRes.rows[0];

    if (!taskDetails || !patient) { await client.query("ROLLBACK"); return res.status(500).json({ error: "Task or patient metadata not found." }); }

      if (taskDetails.is_court_date) {
        if (!court_date) { 
          await client.query("ROLLBACK"); 
          return res.status(400).json({ error: "Court date is required to complete this task." }); 
        }

        const courtDateUTC = DateTime.fromISO(court_date, { zone: timezone }).toUTC().toISO();

        const column = taskDetails.algorithm === "Guardianship"
          ? "guardianship_court_date"
          : "ltc_court_date";

        await client.query(
          `UPDATE patients SET ${column} = $1,  version = version + 1,updated_at = NOW() WHERE id = $2`,
          [courtDateUTC, task.patient_id]
        );
      }
    // FIX: "on time" = completed_at <= due_date (both are TIMESTAMPTZ)
    // No need to compute endOf('day') — due_date already IS 11:59 PM local in UTC
    const completedAt = new Date();
    let finalStatus = "Completed";

    if (task.due_date && completedAt > new Date(task.due_date)) {
      finalStatus = "Delayed Completed";
    }

    await client.query(
      `UPDATE patient_tasks SET status = $1, completed_at = $2, version = version + 1 WHERE id = $3`,
      [finalStatus, completedAt, taskId]
    );

    await appendStatusHistory(taskId, {
      status: finalStatus,
      old_status: task.status,
      staff_id: staffId,
      reason: reason?.trim() ?? null,
    }, client);

    if (taskDetails.is_non_blocking) {
      await client.query("COMMIT");
      return res.status(200).json({ message: "Non-blocking task completed successfully." });
    }

    const patientStatus = patient.status;
    const isManualFollowUp = taskDetails.is_repeating && taskDetails.due_in_days_after_dependency !== null;

    // Recurring task — create next instance
    if (taskDetails.is_repeating && taskDetails.recurrence_interval && patientStatus !== "Discharged" && !isManualFollowUp) {
      const base      = task.completed_at ? new Date(task.completed_at) : new Date();
      const idealBase = task.ideal_due_date ? new Date(task.ideal_due_date) : new Date();

      const nextDue = DateTime.fromJSDate(base).setZone(timezone)
        .plus({ days: taskDetails.recurrence_interval })
        .set({ hour: 23, minute: 59, second: 0, millisecond: 0 })
        .toUTC().toJSDate();

      const nextIdeal = DateTime.fromJSDate(idealBase).setZone(timezone)
        .plus({ days: taskDetails.recurrence_interval })
        .set({ hour: 23, minute: 59, second: 0, millisecond: 0 })
        .toUTC().toJSDate();

      await client.query(
        `INSERT INTO patient_tasks (patient_id, task_id, status, due_date, ideal_due_date) VALUES ($1,$2,'Pending',$3,$4)`,
        [task.patient_id, taskDetails.id, nextDue, nextIdeal]
      );
    }

    // Unlock dependent tasks
    const { rows: deps } = await client.query(
      `SELECT t.* FROM tasks t
       JOIN task_dependencies td ON t.id = td.task_id
       WHERE td.depends_on_task_id = $1`,
      [task.task_id]
    );

    for (const dep of deps) {
      const { rows: existing } = await client.query(
        `SELECT 1 FROM patient_tasks WHERE patient_id = $1 AND task_id = $2 AND status IN ('Pending','In Progress')`,
        [task.patient_id, dep.id]
      );
      if (existing.length) continue;

      // Business logic skips
      if (dep.name === "LTC - Begin compiling needed financial/legal information" && patient.is_ltc_medical && !patient.is_ltc_financial) continue;
      if (dep.name === "LTC - Follow up with state on Medical Application status" && patient.is_ltc_financial) continue;
      if (dep.name === "Guardianship - Confirm Guardianship Appointed" && !patient.is_guardianship_emergency) continue;

      if (dep.is_non_blocking) {
        await client.query(`INSERT INTO patient_tasks (patient_id, task_id, status) VALUES ($1,$2,'Pending')`, [task.patient_id, dep.id]);
        continue;
      }

      const dueBase   = DateTime.fromJSDate(task.completed_at || new Date()).setZone(timezone);
      const idealBase = DateTime.fromJSDate(task.ideal_due_date || task.due_date || task.completed_at || new Date()).setZone(timezone);

      let due, ideal;

      if (dep.is_repeating && dep.recurrence_interval != null && dep.due_in_days_after_dependency == null) {
        due   = dueBase.plus({ days: dep.recurrence_interval }).set({ hour: 23, minute: 59, second: 0, millisecond: 0 }).toUTC().toJSDate();
        ideal = idealBase.plus({ days: dep.recurrence_interval }).set({ hour: 23, minute: 59, second: 0, millisecond: 0 }).toUTC().toJSDate();
      } else if (dep.due_in_days_after_dependency != null) {
        due   = dueBase.plus({ days: dep.due_in_days_after_dependency }).set({ hour: 23, minute: 59, second: 0, millisecond: 0 }).toUTC().toJSDate();
        ideal = idealBase.plus({ days: dep.due_in_days_after_dependency }).set({ hour: 23, minute: 59, second: 0, millisecond: 0 }).toUTC().toJSDate();
      }

      if (!due || !ideal) { console.warn(`Skipping '${dep.name}' — missing date calculations`); continue; }

      await client.query(
        `INSERT INTO patient_tasks (patient_id, task_id, status, due_date, ideal_due_date) VALUES ($1,$2,'Pending',$3,$4)`,
        [task.patient_id, dep.id, due, ideal]
      );
    }

    await client.query("COMMIT");
    return res.status(200).json({ message: "Task completed successfully." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("completeTask error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};

// ─── MARK TASK AS MISSED ──────────────────────────────────────────────────────
const markTaskAsMissed = async (req, res) => {
  const client = await pool.connect();
  try {
    const { taskId } = req.params;
    const { missed_reason, version } = req.body;
    const staffId    = req.user?.id;
    const hospitalId = req.user?.hospital_id;

    if (!req.user?.is_approved) return res.status(403).json({ error: "Access denied." });
    if (version == null) return res.status(400).json({ error: "Missing version." });
    if (!missed_reason?.trim()) return res.status(400).json({ error: "Missed reason is required." });

    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT pt.*, p.hospital_id FROM patient_tasks pt
       JOIN patients p ON pt.patient_id = p.id
       WHERE pt.id = $1 FOR UPDATE`,
      [taskId]
    );

    if (!rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Task not found." }); }

    const task = rows[0];
    if (task.version !== Number(version)) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Task modified by another user." }); }
    if (task.hospital_id !== hospitalId)  { await client.query("ROLLBACK"); return res.status(403).json({ error: "Unauthorized." }); }

    if (isStaff(req.user)) {
      const assigned = await checkStaffAssigned(staffId, task.patient_id, client);
      if (!assigned) { await client.query("ROLLBACK"); return res.status(403).json({ error: "Access denied." }); }
    }

    // FIX: check from patient_task_status_history table
    if (task.status === "Missed") {
      const { rows: existingReason } = await client.query(
        `SELECT 1 FROM patient_task_status_history
         WHERE patient_task_id = $1 AND new_status = 'Missed' AND note IS NOT NULL LIMIT 1`,
        [taskId]
      );
      if (existingReason.length) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Missed reason already provided." }); }

      // Just add the reason to history — don't change status
      await appendStatusHistory(taskId, { status: "Missed", old_status: "Missed", staff_id: staffId, reason: missed_reason.trim() }, client);
      await client.query("COMMIT");
      return res.status(200).json({ message: "Missed reason updated." });
    }

    if (["Completed", "Delayed Completed"].includes(task.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Cannot mark a completed task as missed." });
    }

    await client.query(
      `UPDATE patient_tasks SET status = 'Missed', version = version + 1 WHERE id = $1`,
      [taskId]
    );

    await appendStatusHistory(taskId, { status: "Missed", old_status: task.status, staff_id: staffId, reason: missed_reason.trim() }, client);

    await client.query("COMMIT");
    return res.status(200).json({ message: "Task marked as missed." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("markTaskAsMissed error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};

// ─── GET PRIORITY TASKS ───────────────────────────────────────────────────────
const getPriorityTasks = async (req, res) => {
  if (!req.user?.is_approved) return res.status(403).json({ error: "Access denied." });

  const { id: staffId, hospital_id } = req.user;
  const { patientId } = req.query;

  try {
    let query = `
      SELECT pt.id AS patient_task_id, pt.version, pt.updated_at, pt.task_id,
             pt.due_date, pt.status,
             p.last_name || ', ' || p.first_name AS patient_name,
             t.name AS task_name, pt.patient_id,
             t.is_repeating, t.is_court_date, t.due_in_days_after_dependency, t.is_non_blocking
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      JOIN patients p ON pt.patient_id = p.id AND p.hospital_id = $2
      JOIN patient_staff ps ON ps.patient_id = p.id
      WHERE ps.staff_id = $1
        AND pt.status IN ('Pending', 'In Progress', 'Missed')
        AND pt.due_date <= NOW() + INTERVAL '2 days'
        AND p.status = 'Admitted'
        AND p.is_archived = FALSE
        AND pt.is_visible = TRUE
    `;
    const params = [staffId, hospital_id];
    if (patientId) { query += ` AND pt.patient_id = $3`; params.push(patientId); }
    query += ` ORDER BY pt.due_date ASC`;

    const { rows } = await pool.query(query, params);
    return res.json(rows);

  } catch (err) {
    console.error("getPriorityTasks error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ─── GET MISSED TASKS ─────────────────────────────────────────────────────────
// FIX: missed reason check now queries patient_task_status_history, not JSONB
const getMissedTasks = async (req, res) => {
  if (!req.user?.is_approved) return res.status(403).json({ error: "Access denied." });

  const { id: staffId, hospital_id } = req.user;
  const { patientId } = req.query;

  try {
    let query = `
      SELECT pt.id AS patient_task_id, pt.version, pt.updated_at, pt.task_id,
             pt.due_date, p.last_name || ', ' || p.first_name AS patient_name,
             t.name AS task_name
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      JOIN patients p ON pt.patient_id = p.id AND p.hospital_id = $2
      JOIN patient_staff ps ON ps.patient_id = p.id
      WHERE ps.staff_id = $1
        AND pt.status = 'Missed'
        AND p.status = 'Admitted'
        AND p.is_archived = FALSE
        AND pt.is_visible = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM patient_task_status_history h
          WHERE h.patient_task_id = pt.id
            AND h.new_status = 'Missed'
            AND h.note IS NOT NULL
        )
    `;
    const params = [staffId, hospital_id];
    if (patientId) { query += ` AND pt.patient_id = $3`; params.push(patientId); }
    query += ` ORDER BY pt.due_date ASC`;

    const { rows } = await pool.query(query, params);
    return res.json(rows);

  } catch (err) {
    console.error("getMissedTasks error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ─── FOLLOW UP COURT TASK ─────────────────────────────────────────────────────
// FIX: role checks + status_history from table
const followUpCourtTask = async (req, res) => {
  const client = await pool.connect();
  try {
    const { taskId } = req.params;
    const { followUpReason, version } = req.body;
    const { id: staffId, hospital_id } = req.user;

    if (!req.user?.is_approved) return res.status(403).json({ error: "Access denied." });
    if (version == null) return res.status(400).json({ error: "Missing version." });
    if (blockOrgLevel(req, res)) return;
    if (!followUpReason?.trim()) return res.status(400).json({ error: "Follow-up reason is required." });

    const timezone = await getHospitalTimezone(hospital_id);

    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT pt.*, p.hospital_id AS patient_hospital_id, t.is_non_blocking
       FROM patient_tasks pt
       JOIN patients p ON pt.patient_id = p.id
       JOIN tasks t ON pt.task_id = t.id
       WHERE pt.id = $1 AND p.hospital_id = $2 FOR UPDATE`,
      [taskId, hospital_id]
    );

    if (!rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Task not found or unauthorized." }); }

    const task = rows[0];
    if (task.version !== Number(version)) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Task already modified by someone else." }); }

    if (isStaff(req.user)) {
      const assigned = await checkStaffAssigned(staffId, task.patient_id, client);
      if (!assigned) { await client.query("ROLLBACK"); return res.status(403).json({ error: "Access denied: not assigned to patient." }); }
    }

    const { rows: [taskDetails] } = await client.query(`SELECT * FROM tasks WHERE id = $1`, [task.task_id]);
    if (!taskDetails) { await client.query("ROLLBACK"); return res.status(500).json({ error: "Task metadata missing." }); }

    const isManualFollowUp = taskDetails.is_repeating && taskDetails.due_in_days_after_dependency !== null;

    if (!isManualFollowUp && !task.is_non_blocking) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "This task is not eligible for follow-up." });
    }

   if (task.is_non_blocking) {
      // Mark old task as Follow Up
      await client.query(
        `UPDATE patient_tasks SET status = 'Follow Up', version = version + 1 WHERE id = $1`,
        [taskId]
      );
      await appendStatusHistory(taskId, { status: "Follow Up", old_status: task.status, staff_id: staffId, reason: followUpReason.trim() }, client);

      // Create new pending instance
      const { rows: [newTask] } = await client.query(
        `INSERT INTO patient_tasks (patient_id, task_id, status) VALUES ($1,$2,'Pending') RETURNING id`,
        [task.patient_id, task.task_id]
      );
      await appendStatusHistory(newTask.id, { status: "Pending", old_status: null, staff_id: staffId, reason: "Follow-up from previous task" }, client);

      await client.query("COMMIT");
      return res.status(200).json({ message: "Non-blocking follow-up task created." });
    }
    const nextDue = DateTime.now().setZone(timezone)
      .plus({ days: taskDetails.recurrence_interval })
      .set({ hour: 23, minute: 59, second: 0, millisecond: 0 })
      .toUTC().toJSDate();

    await client.query(
      `UPDATE patient_tasks SET status = 'Follow Up', due_date = $1, version = version + 1 WHERE id = $2`,
      [nextDue, taskId]
    );

    await appendStatusHistory(taskId, { status: "Follow Up", old_status: task.status, staff_id: staffId, reason: followUpReason.trim() }, client);

    await client.query("COMMIT");
    return res.status(200).json({ message: "Follow-up scheduled successfully." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("followUpCourtTask error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};

// ─── UPDATE TASK NOTE ─────────────────────────────────────────────────────────
const updateTaskNote = async (req, res) => {
  const client = await pool.connect();
  try {
    const { taskId } = req.params;
    const { task_note, include_note_in_report, contact_info, version } = req.body;
    const { id: staffId, hospital_id } = req.user;

    if (!req.user?.is_approved) return res.status(403).json({ error: "Access denied." });
    if (version == null) return res.status(400).json({ error: "Missing version." });
    if (blockOrgLevel(req, res)) return;

    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT pt.*, p.hospital_id FROM patient_tasks pt
       JOIN patients p ON pt.patient_id = p.id
       WHERE pt.id = $1 AND p.hospital_id = $2 FOR UPDATE`,
      [taskId, hospital_id]
    );

    if (!rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Task not found." }); }

    const task = rows[0];
    if (task.version !== Number(version)) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Task updated by another user." }); }

    if (isStaff(req.user)) {
      const assigned = await checkStaffAssigned(staffId, task.patient_id, client);
      if (!assigned) { await client.query("ROLLBACK"); return res.status(403).json({ error: "Access denied." }); }
    }

    const { rows: [updated] } = await client.query(
      `UPDATE patient_tasks
       SET task_note             = COALESCE($1, task_note),
           include_note_in_report = COALESCE($2, include_note_in_report),
           contact_info           = COALESCE($3, contact_info),
           updated_at             = NOW(),
           version                = version + 1
       WHERE id = $4 RETURNING *`,
      [task_note, include_note_in_report, contact_info, taskId]
    );

    await client.query("COMMIT");
    return res.status(200).json({ message: "Task metadata updated.", task: updated });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("updateTaskNote error:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
};

// ─── ACKNOWLEDGE TASK ─────────────────────────────────────────────────────────
const acknowledgeTask = async (req, res) => {
  const client = await pool.connect();
  try {
    const taskId    = parseInt(req.params.taskId, 10);
    const staffId   = req.user.id;
    const hospitalId = req.user.hospital_id;
    const { reason, version } = req.body;

    if (!req.user?.is_approved) return res.status(403).json({ error: "Access denied." });
    if (version == null) return res.status(400).json({ error: "Missing version." });
    if (blockOrgLevel(req, res)) return;
    if (isNaN(taskId)) return res.status(400).json({ error: "Invalid task ID." });
    if (!reason?.trim()) return res.status(400).json({ error: "Reason is required." });

    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT pt.*, p.hospital_id FROM patient_tasks pt
       JOIN patients p ON pt.patient_id = p.id
       WHERE pt.id = $1 AND p.hospital_id = $2 FOR UPDATE`,
      [taskId, hospitalId]
    );

    if (!rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Task not found." }); }

    const task = rows[0];
    if (task.version !== Number(version)) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Task already updated by someone else." }); }

    if (isStaff(req.user)) {
      const assigned = await checkStaffAssigned(staffId, task.patient_id, client);
      if (!assigned) { await client.query("ROLLBACK"); return res.status(403).json({ error: "Access denied." }); }
    }

    if (task.status === "Acknowledged") { await client.query("ROLLBACK"); return res.status(409).json({ error: "Task already acknowledged." }); }

    await client.query(
      `UPDATE patient_tasks SET status = 'Acknowledged', version = version + 1, completed_at = NOW() WHERE id = $1`,
      [taskId]
    );

    await appendStatusHistory(taskId, { status: "Acknowledged", old_status: task.status, staff_id: staffId, reason: reason.trim() }, client);

    await client.query("COMMIT");
    return res.status(200).json({ message: "Task acknowledged successfully." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("acknowledgeTask error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};

// ─── ADD MANUAL TASK ──────────────────────────────────────────────────────────
const addManualTaskForPatient = async (req, res) => {
  const client = await pool.connect();
  try {
    const patientId = Number(req.params.id);
    const { name, description, is_repeating = false, recurrence_interval = null,
            is_overridable = false, is_non_blocking = false, algorithm = null, due_date = null } = req.body;
    const { id: staffId, hospital_id } = req.user;

    if (!req.user?.is_approved) return res.status(403).json({ error: "Access denied." });
    if (blockOrgLevel(req, res)) return;
    if (!name?.trim() || !description?.trim()) return res.status(400).json({ error: "Name and description are required." });
    if (isNaN(patientId)) return res.status(400).json({ error: "Invalid patient ID." });

    const timezone = await getHospitalTimezone(hospital_id);

    await client.query("BEGIN");

    const { rows: patientRows } = await client.query(
      `SELECT id FROM patients WHERE id = $1 AND hospital_id = $2`,
      [patientId, hospital_id]
    );
    if (!patientRows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Patient not found." }); }

    if (isStaff(req.user)) {
      const assigned = await checkStaffAssigned(staffId, patientId, client);
      if (!assigned) { await client.query("ROLLBACK"); return res.status(403).json({ error: "Access denied." }); }
    }

    const { rows: [newTask] } = await client.query(
      `INSERT INTO tasks (name, description, is_repeating, recurrence_interval, is_overridable, is_non_blocking, algorithm, is_manual)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE) RETURNING id`,
      [name.trim(), description.trim(), is_repeating, recurrence_interval, is_overridable, is_non_blocking, algorithm]
    );

    const dueLocal = due_date
      ? DateTime.fromISO(due_date, { zone: timezone }).set({ hour: 23, minute: 59, second: 0, millisecond: 0 })
      : DateTime.now().setZone(timezone).set({ hour: 23, minute: 59, second: 0, millisecond: 0 });

    const dueDateUTC = dueLocal.toUTC().toJSDate();

    const { rows: [patientTask] } = await client.query(
      `INSERT INTO patient_tasks (patient_id, task_id, status, due_date, ideal_due_date, is_visible)
       VALUES ($1,$2,'Pending',$3,$3,TRUE) RETURNING id`,
      [patientId, newTask.id, dueDateUTC]
    );

    await appendStatusHistory(patientTask.id, { status: "Pending", old_status: null, staff_id: staffId, reason: "Manual task created" }, client);

    await client.query("COMMIT");
    return res.status(201).json({ message: "Manual task created successfully." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("addManualTaskForPatient error:", err);
    return res.status(500).json({ error: "Failed to create manual task." });
  } finally {
    client.release();
  }
};

// ─── GET TASK NAMES ───────────────────────────────────────────────────────────
const getTaskNames = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT name AS task_name FROM tasks WHERE is_manual IS NOT TRUE ORDER BY name`
    );
    return res.json(rows.map(r => r.task_name));
  } catch (err) {
    console.error("getTaskNames error:", err);
    return res.status(500).json({ error: "Failed to fetch task names" });
  }
};

// ─── OVERRIDE TASK ────────────────────────────────────────────────────────────
// FIX: role checks + status_history from table + requested_at instead of requested_date
const overrideTask = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(taskId)) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Invalid task ID." }); }

    const { override_date, reason, version } = req.body;

    if (!req.user?.is_approved) { await client.query("ROLLBACK"); return res.status(403).json({ error: "Access denied." }); }
    if (version == null) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Missing version." }); }
    if (blockOrgLevel(req, res)) return;
    if (!reason?.trim()) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Override reason is required." }); }
    if (!override_date) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Override date is required." }); }

    const { rows: [task] } = await client.query(
      `SELECT pt.*, p.hospital_id, p.added_by_user_id, p.id AS patient_id,
              t.name AS task_name, p.first_name, p.last_name
       FROM patient_tasks pt
       JOIN patients p ON pt.patient_id = p.id
       JOIN tasks t ON t.id = pt.task_id
       WHERE pt.id = $1 FOR UPDATE`,
      [taskId]
    );

    if (!task) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Task not found." }); }
    if (task.version !== Number(version)) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Task already updated by someone else." }); }
    if (task.hospital_id !== req.user.hospital_id) { await client.query("ROLLBACK"); return res.status(403).json({ error: "Unauthorized hospital." }); }

    const timezone = await getHospitalTimezone(task.hospital_id);
    const parsed   = DateTime.fromISO(override_date, { zone: timezone });
    if (!parsed.isValid) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Invalid override_date." }); }

    const newDueDate = parsed.set({ hour: 23, minute: 59 }).toUTC().toJSDate();

    if (isStaff(req.user)) {
      const assigned = await checkStaffAssigned(req.user.id, task.patient_id, client);
      if (!assigned) { await client.query("ROLLBACK"); return res.status(403).json({ error: "Access denied." }); }
    }

    if (["Completed", "Delayed Completed", "Acknowledged"].includes(task.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Cannot override a completed or acknowledged task." });
    }

    const wouldExceed = (task.override_count || 0) + 1 > task.override_count_max;

    if (wouldExceed) {
      const { rowCount: dupCount } = await client.query(
        `SELECT 1 FROM task_override_requests WHERE task_id = $1 AND status = 'Pending' LIMIT 1`,
        [taskId]
      );
      if (dupCount > 0) { await client.query("ROLLBACK"); return res.status(409).json({ error: "An override request is already pending." }); }

      // FIX: requested_at instead of requested_date (schema fix)
      await client.query(
      `INSERT INTO task_override_requests (task_id, requested_by, requested_at, reason, status)
      VALUES ($1,$2,$3,$4,'Pending')`,
      [taskId, req.user.id, newDueDate, reason.trim()]
    );

      // Notify the admin who added the patient
      // FIX: role = 'admin' not is_admin = TRUE
      const { rows: [admin] } = await client.query(
        `SELECT id FROM users WHERE id = $1 AND role = 'admin' AND is_approved = TRUE`,
        [task.added_by_user_id]
      );

      if (admin) {
        const { rows: [notif] } = await client.query(
          `INSERT INTO notifications (user_id, patient_id, patient_task_id, title, message, type)
           VALUES ($1,$2,$3,$4,$5,'override_request') RETURNING *`,
          [admin.id, task.patient_id, task.id,
           "Override Approval Needed",
           `Task "${task.task_name}" for ${task.first_name} ${task.last_name} requires approval. Reason: ${reason.trim()}`]
        );
        const io = req.app.get("io");
        io?.to?.(`user-${admin.id}`)?.emit("notification", { ...notif, request_status: "Pending" });
      }

      await client.query("COMMIT");
      return res.status(200).json({ message: "Override request submitted for admin approval." });
    }

    await client.query(
      `UPDATE patient_tasks
       SET override_count = COALESCE(override_count, 0) + 1,
           version        = version + 1,
           due_date       = $1,
           admin_override_approval = FALSE
       WHERE id = $2`,
      [newDueDate, taskId]
    );

    await appendStatusHistory(taskId, { status: "Overridden", old_status: task.status, staff_id: req.user.id, reason: reason.trim() }, client);

    await client.query("COMMIT");
    return res.json({ message: "Task overridden successfully." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("overrideTask error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};

// ─── HANDLE OVERRIDE DECISION ─────────────────────────────────────────────────
// FIX: role check uses role === 'admin' not is_admin
const handleOverrideDecision = async (req, res) => {
  const client = await pool.connect();
  const insertedNotifications = [];

  try {
    if (!req.user?.is_approved) return res.status(403).json({ error: "Access denied." });
    if (blockOrgLevel(req, res)) return;
    // FIX: was checking is_admin boolean
    if (!isAdmin(req.user)) return res.status(403).json({ error: "Only admins may approve overrides." });

    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(taskId)) return res.status(400).json({ error: "Invalid task ID." });

    const { decision } = req.body;
    if (!["Approved", "Denied"].includes(decision)) return res.status(400).json({ error: "Invalid decision." });

    await client.query("BEGIN");

    const { rows: [request] } = await client.query(
      `SELECT r.*, pt.id AS patient_task_id, pt.patient_id, pt.task_id,
              p.added_by_user_id, t.name AS task_name, p.first_name, p.last_name
       FROM task_override_requests r
       JOIN patient_tasks pt ON r.task_id = pt.id
       JOIN patients p ON pt.patient_id = p.id
       JOIN tasks t ON pt.task_id = t.id
       WHERE r.task_id = $1 AND r.status = 'Pending'
       ORDER BY r.created_at DESC LIMIT 1 FOR UPDATE`,
      [taskId]
    );

    if (!request) { await client.query("ROLLBACK"); return res.status(404).json({ error: "No pending override request found." }); }
    if (req.user.id !== request.added_by_user_id) { await client.query("ROLLBACK"); return res.status(403).json({ error: "Only the admin who added this patient may decide the override." }); }

    if (decision === "Approved") {
      await client.query(
        `UPDATE patient_tasks
         SET due_date = $1, override_count = COALESCE(override_count,0) + 1,
             override_count_max = COALESCE(override_count_max,0) + 2,
             admin_override_approval = TRUE
         WHERE id = $2`,
        [request.requested_at, request.patient_task_id]
      );
      await appendStatusHistory(request.patient_task_id, { status: "Overridden", old_status: null, staff_id: request.requested_by, reason: request.reason }, client);
      await appendStatusHistory(request.patient_task_id, { status: "Override Approved", old_status: "Overridden", staff_id: req.user.id }, client);
    } else {
      await appendStatusHistory(request.patient_task_id, { status: "Override Denied", old_status: null, staff_id: req.user.id }, client);
    }

    await client.query(
      `UPDATE task_override_requests SET status = $1, approved_by = $2, decided_at = NOW() WHERE id = $3`,
      [decision, req.user.id, request.id]
    );

    const { rows: staffRows } = await client.query(
      `SELECT ps.staff_id AS id FROM patient_staff ps
       JOIN users u ON u.id = ps.staff_id
       WHERE ps.patient_id = $1 AND u.is_approved = TRUE`,
      [request.patient_id]
    );

    const type    = decision === "Approved" ? "override_approved" : "override_denied";
    const title   = `Override ${decision}`;
    const message = `Task "${request.task_name}" for ${request.first_name} ${request.last_name} was ${decision.toLowerCase()}.`;

    for (const r of staffRows) {
      const { rows: [notif] } = await client.query(
        `INSERT INTO notifications (user_id, patient_id, patient_task_id, title, message, type)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [r.id, request.patient_id, request.patient_task_id, title, message, type]
      );
      insertedNotifications.push(notif);
    }

    await client.query("COMMIT");

    const io = req.app.get("io");
    for (const notif of insertedNotifications) {
      io?.to?.(`user-${notif.user_id}`)?.emit("notification", notif);
    }

    return res.json({ message: `Override ${decision.toLowerCase()} successfully.` });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("handleOverrideDecision error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};

module.exports = {
  startTask, completeTask, markTaskAsMissed, getMissedTasks,
  getPriorityTasks, followUpCourtTask, updateTaskNote,
  acknowledgeTask, addManualTaskForPatient, getTaskNames,
  overrideTask, handleOverrideDecision,
};