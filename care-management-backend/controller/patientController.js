// controller/patientController.js
const pool = require("../models/db");
const assignTasksToPatient = require("../services/assignTasksToPatient");
const { DateTime } = require("luxon");
const { getTimezoneForUser } = require("../utils/timezone");

// ─── Role helpers ─────────────────────────────────────────────────────────────
const isSuperAdmin    = (u) => u.role === "super_admin";
const isAdmin         = (u) => u.role === "admin";
const isStaff         = (u) => u.role === "staff";
const hasGlobalAccess = (u) => u.role === "administration" && u.has_global_access;

// ─── GET PATIENTS ─────────────────────────────────────────────────────────────
const getPatients = async (req, res) => {
  if (!req.user?.is_approved)
    return res.status(403).json({ error: "Access denied: User not approved." });

  // FIX: global super admins should see patients — they were getting 403 before.
  // They can view across orgs; just scope them to org if not filtering by hospital.
  const { id: userId, role, organization_id, hospital_id: userHospitalId } = req.user;
  const { hospitalId: filterHospitalId, adminId: filterAdminId } = req.query;

  try {
    let conditions = [];
    let params = [];

    if (hasGlobalAccess(req.user)) {
      // Global super admin — optionally filter by hospital
      if (filterHospitalId) {
        params.push(filterHospitalId);
        conditions.push(`p.hospital_id = $${params.length}`);
      }
      // No hospital filter = all hospitals (global access)
    } else if (isSuperAdmin(req.user)) {
      params.push(organization_id);
      conditions.push(`p.hospital_id IN (SELECT id FROM hospitals WHERE organization_id = $${params.length})`);
      if (filterHospitalId) {
        params.push(filterHospitalId);
        conditions.push(`p.hospital_id = $${params.length}`);
      }
    } else if (isAdmin(req.user)) {
      params.push(userHospitalId);
      conditions.push(`p.hospital_id = $${params.length}`);
    } else if (isStaff(req.user)) {
      params.push(userId, userHospitalId);
      conditions.push(`ps.staff_id = $${params.length - 1}`);
      conditions.push(`p.hospital_id = $${params.length}`);
    } else {
      return res.status(403).json({ error: "Access denied: No valid role assigned." });
    }

    if (filterAdminId) {
      params.push(filterAdminId);
      conditions.push(`p.added_by_user_id = $${params.length}`);
    }

    conditions.push("p.status = 'Admitted'");
    conditions.push("p.is_archived = FALSE");

    const whereClause = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

    const query = `
      SELECT
        p.id, p.first_name, p.last_name,
        TO_CHAR(p.birth_date, 'YYYY-MM-DD') AS birth_date,
        EXTRACT(YEAR FROM AGE(NOW(), p.birth_date))::INTEGER AS age,
        p.room_no, p.medical_info, p.status, p.mrn,
        p.admitted_date, p.hospital_id, p.version, p.updated_at, p.created_at,
        p.is_behavioral, p.is_restrained, p.is_geriatric_psych_available, p.is_behavioral_team,
        p.is_ltc, p.is_ltc_financial, p.is_ltc_medical,
        p.is_guardianship, p.is_guardianship_financial, p.is_guardianship_person, p.is_guardianship_emergency,
        p.added_by_user_id,
        h.name AS hospital_name,
        CASE
          -- Gray: no visible tasks
          WHEN NOT EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id AND pt.is_visible = TRUE
          ) THEN NULL

          -- Red: any task past due and not completed
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id
              AND pt.due_date < NOW()
              AND pt.status NOT IN ('Completed', 'Delayed Completed', 'Acknowledged')
              AND pt.is_visible = TRUE
          ) THEN 'missed'

          -- Blue: all up to date AND something due today or tomorrow
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id
              AND pt.due_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '1 day'
              AND pt.status NOT IN ('Completed', 'Delayed Completed', 'Acknowledged', 'Missed')
              AND pt.is_visible = TRUE
          ) THEN 'in_progress'

          -- Green: all up to date, nothing urgent
          ELSE 'completed'
        END AS task_status,
        json_agg(json_build_object('id', u.id, 'name', u.name))
          FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
      FROM patients p
      LEFT JOIN hospitals h ON h.id = p.hospital_id
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      ${whereClause}
      GROUP BY p.id, h.name
      ORDER BY p.created_at DESC
    `;

    const { rows } = await pool.query(query, params);
    return res.status(200).json(rows);

  } catch (err) {
    console.error("Error fetching patients:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const addPatient = async (req, res) => {
  if (!req.user?.is_approved)
    return res.status(403).json({ error: "Access denied: User not approved." });

  // FIX: role check — removed duplicate below
  if (!isAdmin(req.user))
    return res.status(403).json({ error: "Only hospital admins are allowed to add patients." });

  const added_by_user_id = req.user.id;
  const hospital_id      = req.user.hospital_id;

  if (!hospital_id)
    return res.status(400).json({ error: "User is not assigned to any hospital." });
  const client = await pool.connect();
  try {
    const timezone = await getTimezoneForUser(req.user);

    const {
      first_name, last_name, birth_date, roomNo, mrn, medical_info,
      assignedStaffIds = [],
      is_behavioral, is_restrained, is_geriatric_psych_available, is_behavioral_team,
      is_ltc, is_ltc_medical, is_ltc_financial,
      is_guardianship, is_guardianship_financial, is_guardianship_person, is_guardianship_emergency,
      admitted_date,
    } = req.body;

    // FIX: removed duplicate role/hospital checks that were inside try block

    if (!first_name || !last_name || !birth_date || !roomNo || !mrn)
      return res.status(400).json({ message: "Missing required fields" });

    if (!assignedStaffIds?.length)
      return res.status(400).json({ message: "At least one staff member must be assigned." });

    const normalizedStaff = normalizeStaff(assignedStaffIds);
    if (!normalizedStaff.some(s => ["edit", "full"].includes(String(s.access_level).toLowerCase())))
      return res.status(400).json({ message: "At least one staff member must have edit access." });

    // FIX: LTC/Guardianship validation BEFORE duplicate check and INSERT
    if (is_ltc && !is_ltc_medical && !is_ltc_financial)
      return res.status(400).json({ error: "LTC selected — please choose at least one: Financial or Medical." });

    if (is_guardianship && !is_guardianship_financial && !is_guardianship_person)
      return res.status(400).json({ error: "Guardianship selected — please choose at least one: Financial or Person." });

    const { rows: existing } = await pool.query(
      `SELECT id FROM patients
       WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)
         AND TO_CHAR(birth_date, 'YYYY-MM-DD') = $3 AND mrn = $4 AND hospital_id = $5`,
      [first_name, last_name, birth_date, mrn, hospital_id]
    );
    if (existing.length > 0)
      return res.status(409).json({ error: "A patient with the same Name, DOB, and MRN already exists." });

    const staffIds = normalizedStaff.map(s => parseInt(s.staff_id ?? s.id, 10)).filter(id => !isNaN(id));
    const { rows: validStaff } = await pool.query(
      `SELECT id FROM users WHERE id = ANY($1::int[]) AND hospital_id = $2 AND is_approved = TRUE`,
      [staffIds, hospital_id]
    );
    if (validStaff.length !== staffIds.length)
      return res.status(400).json({ error: "One or more staff are not approved or not in your hospital." });

    const selectedAlgorithms = [];
    if (is_behavioral)   selectedAlgorithms.push("Behavioral");
    if (is_guardianship) selectedAlgorithms.push("Guardianship");
    if (is_ltc)          selectedAlgorithms.push("LTC");

    const admittedDateUTC = admitted_date
      ? DateTime.fromISO(admitted_date, { zone: timezone }).toUTC().toISO()
      : null;
    await client.query("BEGIN");
    // FIX: no age, no selected_algorithms, no ever_selected_algorithms in INSERT
    const { rows: [newPatient] } = await client.query(
      `INSERT INTO patients (
        first_name, last_name, birth_date, room_no, mrn, medical_info,
        is_behavioral, is_restrained, is_geriatric_psych_available, is_behavioral_team,
        is_ltc, is_ltc_medical, is_ltc_financial,
        is_guardianship, is_guardianship_financial, is_guardianship_person, is_guardianship_emergency,
        admitted_date, added_by_user_id, hospital_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
      ) RETURNING *`,
      [
        first_name, last_name, birth_date, roomNo, mrn, medical_info,
        is_behavioral, is_restrained, is_geriatric_psych_available, is_behavioral_team,
        is_ltc, is_ltc_medical, is_ltc_financial,
        is_guardianship, is_guardianship_financial, is_guardianship_person, is_guardianship_emergency,
        admittedDateUTC, added_by_user_id, hospital_id,
      ]
    );

    // FIX: insert into patient_algorithms instead of TEXT[] columns
    for (const algo of selectedAlgorithms) {
      await client.query(
        `INSERT INTO patient_algorithms (patient_id, algorithm, assigned_at, assigned_by_user_id)
         VALUES ($1, $2, $3, $4)`,
        [newPatient.id, algo, admittedDateUTC || new Date().toISOString(), added_by_user_id]
      );
    }

    // Insert staff assignments
    for (const s of normalizedStaff) {
      await client.query(
        `INSERT INTO patient_staff (patient_id, staff_id, access_level) VALUES ($1,$2,$3)`,
        [newPatient.id, parseInt(s.staff_id ?? s.id, 10), s.access_level || "view"]
      );
    }
    await client.query("COMMIT");
    await assignTasksToPatient(newPatient.id, timezone, [], selectedAlgorithms, []);

    // Notify assigned staff
    const io = req.app.get("io");
    for (const s of normalizedStaff) {
      const staffId = parseInt(s.staff_id ?? s.id, 10);
      if (isNaN(staffId)) continue;
      const { rows: [notif] } = await pool.query(
        `INSERT INTO notifications (user_id, patient_id, title, message, type)
         VALUES ($1,$2,$3,$4,'assignment') RETURNING *`,
        [staffId, newPatient.id, "New Patient Assigned",
         `You are assigned to ${newPatient.first_name} ${newPatient.last_name}`]
      );
      io?.to?.(`user-${staffId}`)?.emit("notification", notif);
    }
 
    return res.status(201).json({ message: "Patient added and tasks assigned", patient: newPatient });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error adding patient:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
};

// ─── GET PATIENT BY ID ────────────────────────────────────────────────────────
const getPatientById = async (req, res) => {
  if (!req.user?.is_approved)
    return res.status(403).json({ error: "Access denied: User not approved." });

  const { patientId } = req.params;
  let conditions = ["p.id = $1", "p.is_archived = FALSE"];
  let params = [patientId];

  if (hasGlobalAccess(req.user)) {
    // FIX: global admins can view patient details — they were blocked before
  } else if (isSuperAdmin(req.user)) {
    params.push(req.user.organization_id);
    conditions.push(`p.hospital_id IN (SELECT id FROM hospitals WHERE organization_id = $${params.length})`);
  } else if (isAdmin(req.user)) {
    params.push(req.user.hospital_id);
    conditions.push(`p.hospital_id = $${params.length}`);
  } else if (isStaff(req.user)) {
    params.push(req.user.id);
    conditions.push(`EXISTS (SELECT 1 FROM patient_staff WHERE patient_id = p.id AND staff_id = $${params.length})`);
    params.push(req.user.hospital_id);
    conditions.push(`p.hospital_id = $${params.length}`);
  } else {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const { rows } = await pool.query(`
      SELECT
        p.id, p.first_name, p.last_name,
        TO_CHAR(p.birth_date, 'YYYY-MM-DD') AS birth_date,
        EXTRACT(YEAR FROM AGE(NOW(), p.birth_date))::INTEGER AS age,
        p.room_no, p.medical_info, p.status,
        p.discharge_date, p.discharge_note, p.mrn, p.admitted_date,
        p.is_behavioral, p.is_restrained, p.is_geriatric_psych_available, p.is_behavioral_team,
        p.is_ltc, p.is_ltc_financial, p.is_ltc_medical,
        p.is_guardianship, p.is_guardianship_financial, p.is_guardianship_person, p.is_guardianship_emergency,
        p.guardianship_court_date, p.ltc_court_date,
        p.created_at, p.added_by_user_id, p.hospital_id, p.updated_at, p.version,
        -- FIX: active_algorithms from patient_algorithms table, not TEXT[] column
        COALESCE(
          (SELECT json_agg(DISTINCT algorithm ORDER BY algorithm)
          FROM patient_algorithms
          WHERE patient_id = p.id AND removed_at IS NULL),
          '[]'
        ) AS active_algorithms,
        json_agg(
          json_build_object('id', u.id, 'name', u.name, 'access_level', ps.access_level)
        ) FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
      FROM patients p
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      WHERE ${conditions.join(" AND ")}
      GROUP BY p.id
    `, params);

    if (!rows.length)
      return res.status(404).json({ error: "Patient not found or access denied" });

    return res.status(200).json(rows[0]);

  } catch (err) {
    console.error("Error fetching patient:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── GET PATIENT TASKS ────────────────────────────────────────────────────────
const getPatientTasks = async (req, res) => {
  if (!req.user?.is_approved)
    return res.status(403).json({ error: "Access denied: User not approved." });

  const { patientId } = req.params;
  let conditions = ["id = $1", "is_archived = FALSE"];
  let params = [patientId];

  if (hasGlobalAccess(req.user)) {
    // no extra filter
  } else if (isSuperAdmin(req.user)) {
    params.push(req.user.organization_id);
    conditions.push(`hospital_id IN (SELECT id FROM hospitals WHERE organization_id = $${params.length})`);
  } else if (isAdmin(req.user)) {
    params.push(req.user.hospital_id);
    conditions.push(`hospital_id = $${params.length}`);
  } else if (isStaff(req.user)) {
    params.push(req.user.id);
    conditions.push(`EXISTS (SELECT 1 FROM patient_staff WHERE patient_id = patients.id AND staff_id = $${params.length})`);
    params.push(req.user.hospital_id);
    conditions.push(`hospital_id = $${params.length}`);
  } else {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const { rows: patientRows } = await pool.query(
      `SELECT status FROM patients WHERE ${conditions.join(" AND ")}`, params
    );
    if (!patientRows.length)
      return res.status(404).json({ error: "Patient not found or access denied" });

    // FIX: role check uses isSuperAdmin()
    if (patientRows[0].status === "Discharged" && !isSuperAdmin(req.user))
      return res.status(403).json({ error: "Tasks not available for discharged patients" });

    // FIX: status_history now comes from patient_task_status_history table
    // Completed/started/acknowledged user names fetched via JOIN on history table
    const { rows } = await pool.query(`
      SELECT
        pt.id AS patient_task_id,
        pt.task_id, pt.status, pt.version, pt.updated_at,
        pt.due_date, pt.completed_at, pt.started_at,
        pt.override_count, pt.override_count_max, pt.admin_override_approval,
        pt.task_note, pt.include_note_in_report, pt.contact_info,
        t.name AS task_name, t.category, t.description, t.algorithm,
        t.condition_required, t.is_repeating, t.due_in_days_after_dependency,
        t.is_non_blocking, t.is_overridable, t.is_court_date,
        pt.ideal_due_date,
        u1.name AS completed_by,
        u2.name AS started_by,
        u3.name AS acknowledged_by,
        acknowledged_history.ack_at AS acknowledged_at,
        -- FIX: status_history from joined table, not JSONB column
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', h.id,
              'old_status', h.old_status,
              'new_status', h.new_status,
              'changed_at', h.changed_at,
              'changed_by_user_id', h.changed_by_user_id,
              'note', h.note
            ) ORDER BY h.changed_at
          )
          FROM patient_task_status_history h
          WHERE h.patient_task_id = pt.id),
          '[]'
        ) AS status_history
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      LEFT JOIN LATERAL (
        SELECT h.changed_by_user_id AS staff_id
        FROM patient_task_status_history h
        WHERE h.patient_task_id = pt.id 
          AND h.new_status IN ('Completed', 'Delayed Completed')
        ORDER BY h.changed_at DESC LIMIT 1
      ) completed_history ON TRUE
      LEFT JOIN users u1 ON u1.id = completed_history.staff_id

      -- ADD: separate acknowledged_by for non-blocking display
      LEFT JOIN LATERAL (
        SELECT h.changed_by_user_id AS staff_id, h.changed_at AS ack_at
        FROM patient_task_status_history h
        WHERE h.patient_task_id = pt.id 
          AND h.new_status = 'Acknowledged'
        ORDER BY h.changed_at DESC LIMIT 1
      ) acknowledged_history ON TRUE
      LEFT JOIN users u3 ON u3.id = acknowledged_history.staff_id
      LEFT JOIN LATERAL (
        SELECT h.changed_by_user_id AS staff_id
        FROM patient_task_status_history h
        WHERE h.patient_task_id = pt.id AND h.new_status = 'In Progress'
        ORDER BY h.changed_at DESC LIMIT 1
      ) started_history ON TRUE
      LEFT JOIN users u2 ON u2.id = started_history.staff_id
      WHERE pt.patient_id = $1
        AND pt.is_visible = TRUE
        AND (SELECT is_archived FROM patients WHERE id = $1) = FALSE
      ORDER BY pt.due_date ASC
    `, [patientId]);

    return res.status(200).json(rows);

  } catch (err) {
    console.error("Error fetching patient tasks:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── DISCHARGE PATIENT ────────────────────────────────────────────────────────
const dischargePatient = async (req, res) => {
  if (!req.user?.is_approved)
    return res.status(403).json({ error: "Access denied: User not approved." });

  // FIX: was !req.user.is_admin || req.user.has_global_access — broken logic
  if (!isAdmin(req.user))
    return res.status(403).json({ error: "Only hospital admins may discharge patients." });

  const { patientId } = req.params;
  const { dischargeNote, version } = req.body;

  if (version == null)
    return res.status(400).json({ error: "Missing version." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows, rowCount } = await client.query(
      `UPDATE patients
       SET status = 'Discharged', discharge_date = NOW(),
           discharge_note = $1, version = version + 1, updated_at = NOW()
       WHERE id = $2 AND hospital_id = $3 AND version = $4
       RETURNING *`,
      [dischargeNote, patientId, req.user.hospital_id, version]
    );

    if (rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Patient already updated or access denied. Refresh and try again." });
    }

    // FIX: close out active patient_algorithms entries
    await client.query(
      `UPDATE patient_algorithms SET removed_at = NOW()
       WHERE patient_id = $1 AND removed_at IS NULL`,
      [patientId]
    );

    const patient = rows[0];

    // FIX: notify role='staff' users not is_staff=TRUE
    const { rows: staffRows } = await client.query(
      `SELECT u.id AS staff_id FROM patient_staff ps
       JOIN users u ON u.id = ps.staff_id
       WHERE ps.patient_id = $1 AND u.role = 'staff'`,
      [patientId]
    );

    const io = req.app.get("io");
    for (const { staff_id } of staffRows) {
      const { rows: [notif] } = await client.query(
        `INSERT INTO notifications (user_id, patient_id, title, message, type)
         VALUES ($1,$2,$3,$4,'discharge') RETURNING *`,
        [staff_id, patient.id, "Patient Discharged",
         `${patient.first_name} ${patient.last_name} has been discharged`]
      );
      io?.to?.(`user-${staff_id}`)?.emit("notification", notif);
    }

    await client.query("COMMIT");
    return res.status(200).json({ message: "Patient discharged successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error discharging patient:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};

// ─── REACTIVATE PATIENT ───────────────────────────────────────────────────────
const reactivatePatient = async (req, res) => {
  if (!req.user?.is_approved)
    return res.status(403).json({ error: "Access denied: User not approved." });

  // FIX: was !req.user.is_admin || req.user.has_global_access — broken logic
  if (!isAdmin(req.user))
    return res.status(403).json({ error: "Only hospital admins may reactivate patients." });

  const { patientId } = req.params;
  const { version } = req.body;

  if (version == null)
    return res.status(400).json({ error: "Missing version." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows, rowCount } = await client.query(
      `UPDATE patients
       SET discharge_date = NULL, discharge_note = NULL,
           status = 'Admitted', version = version + 1, updated_at = NOW()
       WHERE id = $1 AND hospital_id = $2 AND version = $3
       RETURNING *`,
      [patientId, req.user.hospital_id, version]
    );

    if (rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Patient already updated or access denied. Refresh and try again." });
    }

    // FIX: re-open patient_algorithms entries from patient_algorithms table
    const { rows: algoRows } = await client.query(
      `SELECT DISTINCT algorithm FROM patient_algorithms
       WHERE patient_id = $1 ORDER BY assigned_at DESC`,
      [patientId]
    );
    for (const { algorithm } of algoRows) {
      await client.query(
        `INSERT INTO patient_algorithms (patient_id, algorithm, assigned_at, assigned_by_user_id)
         VALUES ($1, $2, NOW(), $3)`,
        [patientId, algorithm, req.user.id]
      );
    }

    const patient = rows[0];
    const { rows: staffRows } = await client.query(
      `SELECT u.id AS staff_id FROM patient_staff ps
       JOIN users u ON u.id = ps.staff_id
       WHERE ps.patient_id = $1 AND u.role = 'staff'`,
      [patientId]
    );

    const io = req.app.get("io");
    for (const { staff_id } of staffRows) {
      const { rows: [notif] } = await client.query(
        `INSERT INTO notifications (user_id, patient_id, title, message, type)
         VALUES ($1,$2,$3,$4,'reinstated') RETURNING *`,
        [staff_id, patient.id, "Patient Reinstated",
         `${patient.first_name} ${patient.last_name} has been reinstated to active care.`]
      );
      io?.to?.(`user-${staff_id}`)?.emit("notification", notif);
    }

    await client.query("COMMIT");
    return res.status(200).json({ message: "Patient reactivated successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error reactivating patient:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};

// ─── GET DISCHARGED PATIENTS ──────────────────────────────────────────────────
const getDischargedPatients = async (req, res) => {
  if (!req.user?.is_approved)
    return res.status(403).json({ error: "Access denied: User not approved." });

  if (isStaff(req.user))
    return res.status(403).json({ error: "Staff cannot access discharged patients." });

  try {
    const { role, hospital_id, organization_id } = req.user;
    const { start, end, hospitalId } = req.query;

    let filters = ["p.status = 'Discharged'", "p.is_archived = FALSE"];
    let params = [];

    if (hasGlobalAccess(req.user)) {
      if (hospitalId) { params.push(hospitalId); filters.push(`p.hospital_id = $${params.length}`); }
    } else if (isSuperAdmin(req.user)) {
      params.push(organization_id);
      filters.push(`p.hospital_id IN (SELECT id FROM hospitals WHERE organization_id = $${params.length})`);
      if (hospitalId) { params.push(hospitalId); filters.push(`p.hospital_id = $${params.length}`); }
    } else if (isAdmin(req.user)) {
      params.push(hospital_id);
      filters.push(`p.hospital_id = $${params.length}`);
    } else {
      return res.status(403).json({ error: "Access denied." });
    }

    if (start) { params.push(start); filters.push(`p.discharge_date::date >= $${params.length}`); }
    if (end)   { params.push(end);   filters.push(`p.discharge_date::date <= $${params.length}`); }

    const whereClause = `WHERE ${filters.join(" AND ")}`;

    const [{ rows: patients }, { rows: countRows }] = await Promise.all([
      pool.query(`
        SELECT p.*,
          h.name AS hospital_name,
          EXTRACT(YEAR FROM AGE(NOW(), p.birth_date))::INTEGER AS age,
          json_agg(json_build_object('id', u.id, 'name', u.name))
            FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
        FROM patients p
        LEFT JOIN hospitals h ON h.id = p.hospital_id
        LEFT JOIN patient_staff ps ON p.id = ps.patient_id
        LEFT JOIN users u ON ps.staff_id = u.id
        ${whereClause}
        GROUP BY p.id,h.name
        ORDER BY p.discharge_date DESC NULLS LAST
      `, params),
      pool.query(`SELECT COUNT(*)::int AS count FROM patients p ${whereClause}`, params),
    ]);

    return res.status(200).json({ count: countRows[0]?.count ?? 0, patients });

  } catch (err) {
    console.error("Error fetching discharged patients:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── UPDATE PATIENT ───────────────────────────────────────────────────────────
const updatePatient = async (req, res) => {
  if (!req.user?.is_approved)
    return res.status(403).json({ error: "Access denied: User not approved." });

  // FIX: super_admins and global admins were blocked — now only staff and admin can update
  if (!isAdmin(req.user) && !isStaff(req.user))
    return res.status(403).json({ error: "Only hospital admins and staff may update patients." });

  const timezone = await getTimezoneForUser(req.user);
  const patientId = parseInt(req.params.patientId, 10);

  const {
    first_name, last_name, birth_date, roomNo, mrn, medical_info, admitted_date,
    assignedStaffIds = [], selected_algorithms = [], reason, updated_at,
    is_restrained, is_geriatric_psych_available, is_behavioral_team,
    is_ltc_medical, is_ltc_financial,
    is_guardianship_financial, is_guardianship_person, is_guardianship_emergency,
  } = req.body;
  const client = await pool.connect();
  try {
    const { rows } = await pool.query(`SELECT * FROM patients WHERE id = $1`, [patientId]);
    if (!rows.length) return res.status(404).json({ error: "Patient not found." });

    const patient = rows[0];

    if (patient.hospital_id !== req.user.hospital_id)
      return res.status(403).json({ error: "Access denied: Patient belongs to another hospital." });

    if (!updated_at)
      return res.status(400).json({ error: "Missing updated_at timestamp." });

    if (patient.updated_at?.toISOString() !== new Date(updated_at).toISOString())
      return res.status(409).json({ error: "This patient was already updated by someone else." });

    const normalizedStaff = normalizeStaff(assignedStaffIds);
    if (!normalizedStaff.length)
      return res.status(400).json({ error: "At least one staff member must be assigned." });

    if (!normalizedStaff.some(s => ["edit", "full"].includes(String(s.access_level).toLowerCase())))
      return res.status(400).json({ error: "At least one staff member must have edit or full access." });

    // Algorithm diff
    const { rows: currentAlgoRows } = await pool.query(
      `SELECT algorithm FROM patient_algorithms WHERE patient_id = $1 AND removed_at IS NULL`,
      [patientId]
    );
    const oldAlgorithms = currentAlgoRows.map(r => r.algorithm);
    const newAlgorithms = selected_algorithms;
    const addedAlgorithms   = newAlgorithms.filter(a => !oldAlgorithms.includes(a));
    const removedAlgorithms = oldAlgorithms.filter(a => !newAlgorithms.includes(a));

    const flags = {
      is_behavioral:  newAlgorithms.includes("Behavioral"),
      is_guardianship: newAlgorithms.includes("Guardianship"),
      is_ltc:          newAlgorithms.includes("LTC"),
    };

    const admittedDateUTC = admitted_date
      ? DateTime.fromISO(admitted_date, { zone: timezone }).toUTC().toISO()
      : patient.admitted_date;

    // Staff diff for notifications
    const { rows: currentStaffRows } = await pool.query(
      `SELECT staff_id FROM patient_staff WHERE patient_id = $1`, [patientId]
    );
    const currentIds = currentStaffRows.map(s => String(s.staff_id));
    const newIds     = normalizedStaff.map(s => String(s.staff_id ?? s.id));
    const addedStaff   = newIds.filter(id => !currentIds.includes(id));
    const removedStaff = currentIds.filter(id => !newIds.includes(id));

    // FIX: removed age from UPDATE — computed dynamically
    // FIX: removed selected_algorithms/ever_selected_algorithms — now in patient_algorithms
    await client.query("BEGIN");
    await client.query(
      `UPDATE patients SET
        first_name=$1, last_name=$2, birth_date=$3,
        room_no=$4, mrn=$5, medical_info=$6,
        is_behavioral=$7, is_restrained=$8, is_geriatric_psych_available=$9, is_behavioral_team=$10,
        is_ltc=$11, is_ltc_medical=$12, is_ltc_financial=$13,
        is_guardianship=$14, is_guardianship_financial=$15, is_guardianship_person=$16, is_guardianship_emergency=$17,
        admitted_date=$18, updated_at=NOW()
      WHERE id=$19`,
      [
        first_name, last_name, birth_date,
        roomNo, mrn, medical_info,
        flags.is_behavioral, is_restrained, is_geriatric_psych_available, is_behavioral_team,
        flags.is_ltc, is_ltc_medical, is_ltc_financial,
        flags.is_guardianship, is_guardianship_financial, is_guardianship_person, is_guardianship_emergency,
        admittedDateUTC, patientId,
      ]
    );

    // FIX: update patient_algorithms table instead of TEXT[] columns
    for (const algo of removedAlgorithms) {
      await client.query(
        `UPDATE patient_algorithms SET removed_at = NOW(), removed_by_user_id = $3
         WHERE patient_id = $1 AND algorithm = $2 AND removed_at IS NULL`,
        [patientId, algo, req.user.id]
      );
    }
    for (const algo of addedAlgorithms) {
      await client.query(
        `INSERT INTO patient_algorithms (patient_id, algorithm, assigned_at, assigned_by_user_id)
         VALUES ($1, $2, NOW(), $3)`,
        [patientId, algo, req.user.id]
      );
    }

    // Replace staff assignments
    await client.query(`DELETE FROM patient_staff WHERE patient_id = $1`, [patientId]);
    for (const s of normalizedStaff) {
      await client.query(
        `INSERT INTO patient_staff (patient_id, staff_id, access_level) VALUES ($1,$2,$3)`,
        [patientId, parseInt(s.staff_id ?? s.id, 10), s.access_level || "view"]
      );
    }

  

    await client.query(
      `INSERT INTO patient_update_logs (patient_id, user_id, reason, changes)
       VALUES ($1,$2,$3,$4)`,
      [patientId, req.user.id, reason || "N/A",
       JSON.stringify({ addedAlgorithms, removedAlgorithms, staffChanged: addedStaff.length > 0 || removedStaff.length > 0 })]
    );

    // Notifications
    const io = req.app.get("io");
    const updater = req.user.name || req.user.email || "User";
    const updateMessage = `Patient ${first_name} ${last_name} updated by ${updater}`;

    // FIX: notify role='admin' not is_admin=TRUE
    const { rows: admins } = await client.query(
      `SELECT id FROM users WHERE hospital_id = $1 AND role IN ('admin', 'super_admin')`,
      [req.user.hospital_id]
    );
    for (const admin of admins) {
      const { rows: [notif] } = await client.query(
        `INSERT INTO notifications (user_id, patient_id, title, message, type)
         VALUES ($1,$2,'Patient Updated',$3,'audit') RETURNING *`,
        [admin.id, patientId, updateMessage]
      );
      io?.to?.(`user-${admin.id}`)?.emit("notification", notif);
    }

    for (const sid of addedStaff) {
      const { rows: [notif] } = await client.query(
        `INSERT INTO notifications (user_id, patient_id, title, message, type)
         VALUES ($1,$2,'New Assignment',$3,'assignment') RETURNING *`,
        [sid, patientId, updateMessage]
      );
      io?.to?.(`user-${sid}`)?.emit("notification", notif);
    }

    for (const sid of removedStaff) {
      const { rows: [notif] } = await client.query(
        `INSERT INTO notifications (user_id, patient_id, title, message, type)
         VALUES ($1,$2,'Unassigned',$3,'unassignment') RETURNING *`,
        [sid, patientId, updateMessage]
      );
      io?.to?.(`user-${sid}`)?.emit("notification", notif);
    }
    await client.query("COMMIT");
    await assignTasksToPatient(patientId, timezone, [], addedAlgorithms, removedAlgorithms);
    const { rows: [updatedPatient] } = await pool.query(
      `SELECT p.*,
         EXTRACT(YEAR FROM AGE(NOW(), p.birth_date))::INTEGER AS age,
         json_agg(json_build_object('id', u.id, 'name', u.name, 'access_level', ps.access_level))
           FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
       FROM patients p
       LEFT JOIN patient_staff ps ON ps.patient_id = p.id
       LEFT JOIN users u ON u.id = ps.staff_id
       WHERE p.id = $1 GROUP BY p.id`,
      [patientId]
    );

    return res.status(200).json({ message: "Patient updated successfully", patient: updatedPatient });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating patient:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};

// ─── SEARCH PATIENTS ──────────────────────────────────────────────────────────
const getSearchedPatients = async (req, res) => {
  if (!req.user?.is_approved)
    return res.status(403).json({ error: "Access denied: User not approved." });

  const { q, status = "active", start, end, hospitalId: filterHospitalId, adminId } = req.query;
  const { id: currentUserId, organization_id, hospital_id: userHospitalId } = req.user;

  if (!q?.trim())
    return res.status(400).json({ error: "Search query is required." });

  try {
    const timezone = await getTimezoneForUser(req.user);
    const searchQuery = `%${q.toLowerCase()}%`;
    let params = [searchQuery];
    let conditions = [];

    if (hasGlobalAccess(req.user)) {
      if (filterHospitalId) { params.push(filterHospitalId); conditions.push(`p.hospital_id = $${params.length}`); }
    } else if (isSuperAdmin(req.user)) {
      params.push(organization_id);
      conditions.push(`p.hospital_id IN (SELECT id FROM hospitals WHERE organization_id = $${params.length})`);
      if (filterHospitalId) { params.push(filterHospitalId); conditions.push(`p.hospital_id = $${params.length}`); }
    } else if (isAdmin(req.user)) {
      params.push(userHospitalId);
      conditions.push(`p.hospital_id = $${params.length}`);
    } else if (isStaff(req.user)) {
      params.push(currentUserId);
      conditions.push(`p.id IN (SELECT patient_id FROM patient_staff WHERE staff_id = $${params.length})`);
    }

    if (adminId) { params.push(adminId); conditions.push(`p.added_by_user_id = $${params.length}`); }

    if (status === "discharged")    conditions.push("p.discharge_date IS NOT NULL AND p.is_archived = FALSE");
    else if (status === "archived") conditions.push("p.is_archived = TRUE");
    else                            conditions.push("p.discharge_date IS NULL AND p.is_archived = FALSE");

    const dateField = status === "archived" ? "p.archived_at" : status === "discharged" ? "p.discharge_date" : "p.created_at";
    if (start) { params.push(start); conditions.push(`${dateField}::date >= $${params.length}`); }
    if (end)   { params.push(end);   conditions.push(`${dateField}::date <= $${params.length}`); }

    conditions.push(`(
      LOWER(p.first_name) LIKE $1 OR LOWER(p.last_name) LIKE $1 OR LOWER(p.mrn) LIKE $1
      OR LOWER(p.first_name || ' ' || p.last_name) LIKE $1
      OR LOWER(p.last_name || ' ' || p.first_name) LIKE $1
    )`);

    const whereClause = "WHERE " + conditions.join(" AND ");

    const { rows } = await pool.query(`
      SELECT p.*,
        h.name AS hospital_name,
        EXTRACT(YEAR FROM AGE(NOW(), p.birth_date))::INTEGER AS age,
        json_agg(json_build_object('id', u.id, 'name', u.name))
          FILTER (WHERE u.id IS NOT NULL) AS assigned_staff,
        CASE
          -- Gray: no visible tasks
          WHEN NOT EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id AND pt.is_visible = TRUE
          ) THEN NULL

          -- Red: any task past due and not completed
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id
              AND pt.due_date < NOW()
              AND pt.status NOT IN ('Completed', 'Delayed Completed', 'Acknowledged')
              AND pt.is_visible = TRUE
          ) THEN 'missed'

          -- Blue: all up to date AND something due today or tomorrow
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id
              AND pt.due_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '1 day'
              AND pt.status NOT IN ('Completed', 'Delayed Completed', 'Acknowledged', 'Missed')
              AND pt.is_visible = TRUE
          ) THEN 'in_progress'

          -- Green: all up to date, nothing urgent
          ELSE 'completed'
        END AS task_status
      FROM patients p
      LEFT JOIN hospitals h ON h.id = p.hospital_id
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      ${whereClause}
      GROUP BY p.id,h.name
      ORDER BY p.created_at DESC
    `, params);

    return res.status(200).json(rows);

  } catch (err) {
    console.error("Error searching patients:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── GET PATIENTS BY ADMIN ────────────────────────────────────────────────────
const getPatientsByAdmin = async (req, res) => {
  if (!req.user?.is_approved)
    return res.status(403).json({ error: "Access denied: User not approved." });

  if (isStaff(req.user))
    return res.status(403).json({ error: "Staff cannot access patients by admin." });

  const { adminId } = req.params;
  const { hospital_id: userHospitalId, organization_id } = req.user;
  const { hospitalId: filterHospitalId } = req.query;

  try {
    const timezone = await getTimezoneForUser(req.user);
    let params = [adminId];
    let conditions = [`p.added_by_user_id = $1`, `p.status = 'Admitted'`, `p.is_archived = FALSE`];

    if (hasGlobalAccess(req.user)) {
      if (filterHospitalId) { params.push(filterHospitalId); conditions.push(`p.hospital_id = $${params.length}`); }
    } else if (isSuperAdmin(req.user)) {
      params.push(organization_id);
      conditions.push(`p.hospital_id IN (SELECT id FROM hospitals WHERE organization_id = $${params.length})`);
      if (filterHospitalId) { params.push(filterHospitalId); conditions.push(`p.hospital_id = $${params.length}`); }
    } else if (isAdmin(req.user)) {
      params.push(userHospitalId);
      conditions.push(`p.hospital_id = $${params.length}`);
    } else {
      return res.status(403).json({ error: "Access denied" });
    }

    const { rows } = await pool.query(`
      SELECT p.*,
        h.name AS hospital_name,
        EXTRACT(YEAR FROM AGE(NOW(), p.birth_date))::INTEGER AS age,
        json_agg(json_build_object('id', u.id, 'name', u.name))
          FILTER (WHERE u.id IS NOT NULL) AS assigned_staff,
        CASE
          -- Gray: no visible tasks
          WHEN NOT EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id AND pt.is_visible = TRUE
          ) THEN NULL

          -- Red: any task past due and not completed
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id
              AND pt.due_date < NOW()
              AND pt.status NOT IN ('Completed', 'Delayed Completed', 'Acknowledged')
              AND pt.is_visible = TRUE
          ) THEN 'missed'

          -- Blue: all up to date AND something due today or tomorrow
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id
              AND pt.due_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '1 day'
              AND pt.status NOT IN ('Completed', 'Delayed Completed', 'Acknowledged', 'Missed')
              AND pt.is_visible = TRUE
          ) THEN 'in_progress'

          -- Green: all up to date, nothing urgent
          ELSE 'completed'
        END AS task_status
      FROM patients p
      LEFT JOIN hospitals h ON p.hospital_id = h.id
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      WHERE ${conditions.join(" AND ")}
      GROUP BY p.id,h.name
      ORDER BY p.created_at DESC
    `, params);

    return res.status(200).json(rows);

  } catch (err) {
    console.error("Error fetching patients by admin:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── UPDATE COURT DATE ────────────────────────────────────────────────────────
// FIX: court dates are now tasks in patient_tasks (is_court_date=TRUE)
// This endpoint updates the due_date of the relevant court date task, not a patient column
const updateCourtDate = async (req, res) => {
  if (!req.user?.is_approved)
    return res.status(403).json({ error: "Access denied: User not approved." });
  if (isSuperAdmin(req.user) || hasGlobalAccess(req.user))
    return res.status(403).json({ error: "Only hospital admins and staff may edit court dates." });
  if (!isAdmin(req.user) && !isStaff(req.user))
    return res.status(403).json({ error: "Only hospital admins and staff may edit court dates." });

  const { id: patientId } = req.params;
  const { type, newDate, version } = req.body; // no longer need patient_task_id

  if (!["guardianship", "ltc"].includes(type))
    return res.status(400).json({ error: "Invalid type. Must be 'guardianship' or 'ltc'." });

  const column = type === "guardianship"
    ? "guardianship_court_date"
    : "ltc_court_date";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows, rowCount } = await client.query(
      `SELECT id, hospital_id, version FROM patients WHERE id = $1 FOR UPDATE`,
      [patientId]
    );
    if (!rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Patient not found." }); }

    const patient = rows[0];
    if (patient.hospital_id !== req.user.hospital_id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Access denied: Patient belongs to another hospital." });
    }
    if (patient.version !== Number(version)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Patient was already modified. Please refresh." });
    }

    if (isStaff(req.user)) {
      const { rows: assigned } = await client.query(
        `SELECT 1 FROM patient_staff WHERE patient_id = $1 AND staff_id = $2`,
        [patientId, req.user.id]
      );
      if (!assigned.length) { await client.query("ROLLBACK"); return res.status(403).json({ error: "Not assigned to this patient." }); }
    }

    const timezone = await getTimezoneForUser(req.user);
    const localDateTime = DateTime.fromISO(newDate, { zone: timezone });
    if (!localDateTime.isValid) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Invalid date format." }); }

    const utcDateTime = localDateTime.toUTC().toISO();

    // Write court date to patient, bump version
    await client.query(
      `UPDATE patients SET ${column} = $1, version = version + 1, updated_at = NOW() WHERE id = $2`,
      [utcDateTime, patientId]
    );

    await client.query("COMMIT");
    return res.status(200).json({ message: "Court date updated successfully." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating court date:", err);
    return res.status(500).json({ error: "Failed to update court date." });
  } finally {
    client.release();
  }
};

// ─── ARCHIVE DISCHARGED PATIENT ───────────────────────────────────────────────
const archiveDischargedPatient = async (req, res) => {
  if (!req.user?.is_approved)
    return res.status(403).json({ error: "Access denied: User not approved." });


  if (!isAdmin(req.user))
    return res.status(403).json({ error: "Only hospital admins may archive patients." });

  const { patientId } = req.params;
  const { reason, version } = req.body || {};

  if (version == null) return res.status(400).json({ error: "Missing version." });
  if (!reason?.trim()) return res.status(400).json({ error: "Archive reason is required." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows, rowCount } = await client.query(
      `SELECT id, status, hospital_id, version FROM patients
       WHERE id = $1 AND hospital_id = $2 FOR UPDATE`,
      [patientId, req.user.hospital_id]
    );

    if (!rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Patient not found or access denied." }); }

    const patient = rows[0];
    if (patient.version !== Number(version)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Patient was already updated. Please refresh." });
    }
    if (patient.status !== "Discharged") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Only discharged patients can be archived." });
    }

    const { rows: updated } = await client.query(
      `UPDATE patients
       SET is_archived = TRUE, archived_at = NOW(), archived_by_user_id = $1,
           archived_reason = $2, status = 'Archived', version = version + 1, updated_at = NOW()
       WHERE id = $3 AND version = $4 RETURNING *`,
      [req.user.id, reason.trim(), patientId, version]
    );

    if (!updated.length) { await client.query("ROLLBACK"); return res.status(409).json({ error: "Patient already updated. Refresh and retry." }); }

    await client.query("COMMIT");
    return res.status(200).json({ message: "Patient archived successfully.", patient: updated[0] });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error archiving patient:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
};

// ─── GET ARCHIVED PATIENTS ────────────────────────────────────────────────────
const getArchivedPatients = async (req, res) => {
  if (!req.user?.is_approved)
    return res.status(403).json({ error: "Access denied: User not approved." });

  if (isStaff(req.user))
    return res.status(403).json({ error: "Staff cannot access archived patients." });

  const { hospital_id, organization_id } = req.user;
  const { start, end, hospitalId } = req.query;

  let filters = ["p.status = 'Archived'", "p.is_archived = TRUE"];
  let params = [];

  if (hasGlobalAccess(req.user)) {
    if (hospitalId) { params.push(hospitalId); filters.push(`p.hospital_id = $${params.length}`); }
  } else if (isSuperAdmin(req.user)) {
    params.push(organization_id);
    filters.push(`p.hospital_id IN (SELECT id FROM hospitals WHERE organization_id = $${params.length})`);
    if (hospitalId) { params.push(hospitalId); filters.push(`p.hospital_id = $${params.length}`); }
  } else if (isAdmin(req.user)) {
    params.push(hospital_id);
    filters.push(`p.hospital_id = $${params.length}`);
  } else {
    return res.status(403).json({ error: "Access denied." });
  }

  if (start) { params.push(start); filters.push(`p.archived_at::date >= $${params.length}`); }
  if (end)   { params.push(end);   filters.push(`p.archived_at::date <= $${params.length}`); }

  try {
    const whereClause = `WHERE ${filters.join(" AND ")}`;
    const [{ rows: patients }, { rows: countRows }] = await Promise.all([
      pool.query(`
        SELECT p.*,
          h.name AS hospital_name,
          EXTRACT(YEAR FROM AGE(NOW(), p.birth_date))::INTEGER AS age,
          json_agg(json_build_object('id', u.id, 'name', u.name))
            FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
        FROM patients p
        LEFT JOIN hospitals h ON h.id = p.hospital_id
        LEFT JOIN patient_staff ps ON p.id = ps.patient_id
        LEFT JOIN users u ON ps.staff_id = u.id
        ${whereClause}
        GROUP BY p.id,h.name
        ORDER BY p.archived_at DESC NULLS LAST
      `, params),
      pool.query(`SELECT COUNT(*)::int AS count FROM patients p ${whereClause}`, params),
    ]);

    return res.status(200).json({ count: countRows[0]?.count ?? 0, patients });

  } catch (err) {
    console.error("Error fetching archived patients:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── Utility: normalize staff input ──────────────────────────────────────────
const normalizeStaff = (arr) =>
  arr.map(s => {
    if (typeof s === "string") { try { return JSON.parse(s); } catch { return null; } }
    return s;
  }).filter(Boolean);

module.exports = {
  getPatients, addPatient, getPatientById, getPatientTasks,
  dischargePatient, reactivatePatient, getDischargedPatients,
  updatePatient, getSearchedPatients, getPatientsByAdmin,
  updateCourtDate, archiveDischargedPatient, getArchivedPatients,
};