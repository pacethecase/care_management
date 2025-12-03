
const pool = require("../models/db");
const assignTasksToPatient = require("../services/assignTasksToPatient");
const { DateTime } = require('luxon');


const getPatients = async (req, res) => {
  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: User not approved." });
  }

  try {
    const userId = req.user.id;
    const {
      is_staff,
      is_admin,
      is_super_admin,
      has_global_access,
      organization_id,
      hospital_id: userHospitalId,
    } = req.user;

    const { hospitalId: filterHospitalId, adminId: filterAdminId } = req.query;
    const timezone = req.headers["x-timezone"] || "America/New_York";

    const todayEndInUTC = DateTime.now()
      .setZone(timezone)
      .endOf("day")
      .toUTC()
      .toJSDate();

  
    let conditions = [];           
    let params = [todayEndInUTC];
    
    if (req.user.has_global_access) {
      return res.status(403).json({
        error: "Access denied: Organization admins cannot access patient records.",
      });
    }

   
    else if (is_super_admin) {
        params.push(organization_id);
        conditions.push(`p.hospital_id IN (SELECT id FROM hospitals WHERE organization_id = $${params.length})`);

        if (filterHospitalId) {
          params.push(filterHospitalId);
          conditions.push(`p.hospital_id = $${params.length}`);
        }
      }

 
  
    else if (is_admin) {
      params.push(userHospitalId);
      conditions.push(`p.hospital_id = $${params.length}`);
    }
    else if (is_staff) {
      params.push(userId, userHospitalId);
      conditions.push(`ps.staff_id = $${params.length - 1}`);
      conditions.push(`p.hospital_id = $${params.length}`);

    }
    else {
      return res.status(403).json({
        error: "Access denied: No valid role assigned.",
      });
    }

    if (filterAdminId) {
      params.push(filterAdminId);
      conditions.push(`p.added_by_user_id = $${params.length}`);
    }
    conditions.push("p.status = 'Admitted'");
    conditions.push("p.status != 'Discharged'");
    conditions.push("COALESCE(p.is_archived, false) = false");

    const whereClause = conditions.length ? "WHERE " + conditions.join(" AND ") : "";


    const query = `
      SELECT 
        p.*,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id AND pt.status = 'Missed' AND pt.is_visible = true
          ) THEN 'missed'
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id
              AND pt.due_date <= $1::timestamp
              AND pt.status NOT IN ('Completed','Delayed Completed','Missed')
              AND pt.is_visible = true
          ) THEN 'in_progress'
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id
              AND pt.status IN ('Completed','Delayed Completed')
              AND pt.is_visible = true
          ) THEN 'completed'
          ELSE NULL
        END AS task_status,
        json_agg(json_build_object('id', u.id, 'name', u.name))
          FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
      FROM patients p
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;

    const result = await pool.query(query, params);
    return res.status(200).json(result.rows);

  } catch (err) {
    console.error("❌ Error fetching patients:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};



const addPatient = async (req, res) => {
  if (!req.user?.is_approved) {
  return res.status(403).json({ error: "Access denied: User not approved." });
}

  const added_by_user_id = req.user.id;
  const hospital_id = req.user.hospital_id;

  const timezone = req.headers['x-timezone'] || 'America/New_York';
  console.log("Timezone header:", req.headers['x-timezone']);

  try {
    const {
      first_name,
      last_name,
      birth_date,
      age,
      roomNo,
      mrn,
      medical_info,
      assignedStaffIds = [],
      is_behavioral,
      is_restrained,
      is_geriatric_psych_available,
      is_behavioral_team,
      is_ltc,
      is_ltc_medical,
      is_ltc_financial,
      is_guardianship,
      is_guardianship_financial,
      is_guardianship_person,
      is_guardianship_emergency,
      admitted_date,
      created_at
    } = req.body;

    if (!req.user.is_admin || req.user.has_global_access) {
      return res.status(403).json({
        error: "Only hospital admins are allowed to add patients.",
      });
    }
    if (!hospital_id) {
      return res.status(400).json({
        error: "User is not assigned to any hospital. Cannot add patient.",
      });
    }


    if (!first_name || !last_name || !birth_date || !roomNo || !age || !mrn) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (!assignedStaffIds || assignedStaffIds.length === 0) {
      return res.status(400).json({
        message: "At least one staff member must be assigned to the patient.",
      });
    }

    const normalizedStaff1 = assignedStaffIds
      .map((s) => {
        if (typeof s === "string") {
          try {
            return JSON.parse(s);
          } catch {
            console.warn("⚠️ Invalid staff entry string:", s);
            return null;
          }
        }
        return s;
      })
      .filter(Boolean);

    const hasEditAccess = normalizedStaff1.some(
      (staff) =>
        (staff.access_level &&
          staff.access_level.toLowerCase() === "edit") ||
        staff.access_level === "full"
    );

    if (!hasEditAccess) {
      return res.status(400).json({
        message: "At least one assigned staff member must have edit access.",
      });
    }
    const { rows: existing } = await pool.query(
      `
      SELECT id, first_name, last_name, birth_date, mrn
      FROM patients
      WHERE LOWER(first_name) = LOWER($1)
        AND LOWER(last_name) = LOWER($2)
        AND birth_date::date = $3::date
        AND mrn = $4
        AND hospital_id = $5
      `,
      [first_name, last_name, birth_date, mrn, hospital_id]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        error: "A patient with the same Name, DOB, and MRN already exists.",
        existingPatient: existing[0],
      });
    }

    const selectedAlgorithms = [];
    if (is_behavioral) selectedAlgorithms.push("Behavioral");
    if (is_guardianship) selectedAlgorithms.push("Guardianship");
    if (is_ltc) selectedAlgorithms.push("LTC");

    const admittedDateUTC = admitted_date
  ? DateTime.fromISO(admitted_date, { zone: timezone }).toUTC().toISO()
  : null;
    const createdAtUTC = created_at
      ? DateTime.fromISO(created_at, { zone: timezone }).toUTC().toISO()
      : DateTime.now().setZone(timezone).toUTC().toISO();

    const result = await pool.query(
      `INSERT INTO patients (
        first_name, last_name, birth_date, age, room_no, mrn, medical_info,
        is_behavioral, is_restrained, is_geriatric_psych_available, is_behavioral_team,
        is_ltc, is_ltc_medical, is_ltc_financial,
        is_guardianship, is_guardianship_financial, is_guardianship_person, is_guardianship_emergency,
        admitted_date, added_by_user_id, hospital_id, created_at, selected_algorithms
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20, $21, $22, $23
      )
      RETURNING *`,
      [
        first_name, last_name, birth_date, age, roomNo, mrn, medical_info,
        is_behavioral, is_restrained, is_geriatric_psych_available, is_behavioral_team,
        is_ltc, is_ltc_medical, is_ltc_financial,
        is_guardianship, is_guardianship_financial, is_guardianship_person, is_guardianship_emergency,
        admittedDateUTC, added_by_user_id, hospital_id, createdAtUTC,
        selectedAlgorithms
      ]
    );

    const newPatient = result.rows[0];


    if (assignedStaffIds.length > 0) {
      const staffIdsOnly = assignedStaffIds.map((s) => {
        if (typeof s === "string") {
          try {
            const parsed = JSON.parse(s);
            return parseInt(parsed.staff_id ?? parsed.id, 10);
          } catch {
            return null;
          }
        }
        return parseInt(s.staff_id ?? s.id, 10);
      }).filter((id) => !isNaN(id));

      const { rows: validStaff } = await pool.query(
        `SELECT id FROM users WHERE id = ANY($1::int[]) AND hospital_id = $2 AND is_approved = true`,
        [staffIdsOnly, hospital_id]
      );

      const validStaffIds = validStaff.map((s) => s.id);
      if (validStaffIds.length !== staffIdsOnly.length) {
        return res.status(400).json({
          error: "One or more assigned staff are not approved or not in your hospital",
        });
      }
    }

    const normalizedStaff = assignedStaffIds.map((s) => {
      if (typeof s === "string") {
        try {
          return JSON.parse(s);
        } catch {
          console.warn("⚠️ Invalid staff entry string:", s);
          return null;
        }
      }
      return s;
    }).filter(Boolean);
    for (const staff of normalizedStaff) {
      const staffIdRaw = staff.staff_id ?? staff.id;
      const staffId = parseInt(staffIdRaw, 10);
      const accessLevel = staff.access_level || "view";

      if (isNaN(staffId)) {
        console.warn("⚠️ Skipping invalid staff_id:", staff);
        continue;
      }

      await pool.query(
        `INSERT INTO patient_staff (patient_id, staff_id, access_level)
        VALUES ($1, $2, $3)`,
        [newPatient.id, staffId, accessLevel]
      );
    }


      await assignTasksToPatient(newPatient.id, timezone, selectedAlgorithms);

      if (normalizedStaff.length > 0) {
        const io = req.app.get("io");

        for (const staff of normalizedStaff) {
          const staffIdRaw = staff.staff_id ?? staff.id;
          const staffId = parseInt(staffIdRaw, 10);
          if (isNaN(staffId)) {
            console.warn("⚠️ Skipping invalid staff_id for notification:", staff);
            continue;
          }

          const title = "New Patient Assigned";
          const message = `You are assigned to ${newPatient.first_name} ${newPatient.last_name}`;

          const { rows: [notif] } = await pool.query(
            `INSERT INTO notifications (user_id, patient_id, title, message, type)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [staffId, newPatient.id, title, message, "assignment"]
          );

          io?.to?.(`user-${staffId}`)?.emit("notification", notif);
        }
      }

      res.status(201).json({ message: "Patient added and tasks assigned", patient: newPatient });
    } catch (err) {
      console.error("❌ Error adding patient:", err);
      res.status(500).json({ error: "Internal server error" });
    }
};



const getPatientById = async (req, res) => {
  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: User not approved." });
  }

  // ❌ Org admins never access patients
  if (req.user.has_global_access) {
    return res.status(403).json({
      error: "Access denied: Organization admins cannot access patient data.",
    });
  }

  const { patientId } = req.params;
  let conditions = ["p.id = $1", "COALESCE(p.is_archived, false) = false"];
  let params = [patientId];
  let idx = 2;

  // ✅ SUPER ADMIN → org hospitals only
  if (req.user.is_super_admin) {
    params.push(req.user.organization_id);
    conditions.push(`
      p.hospital_id IN (
        SELECT id FROM hospitals WHERE organization_id = $${idx}
      )
    `);
    idx++;
  }

  // ✅ ADMIN → hospital only
  else if (req.user.is_admin) {
    params.push(req.user.hospital_id);
    conditions.push(`p.hospital_id = $${idx}`);
    idx++;
  }

  // ✅ STAFF → assigned patients only
  else if (req.user.is_staff) {
    params.push(req.user.id);
    conditions.push(`
      EXISTS (
        SELECT 1 FROM patient_staff
        WHERE patient_id = p.id
          AND staff_id = $${idx}
      )
    `);
    idx++;

    // enforce same hospital
    params.push(req.user.hospital_id);
    conditions.push(`p.hospital_id = $${idx}`);
    idx++;
  }

  // ❌ No valid role
  else {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const query = `
      SELECT 
        p.id,
        p.first_name,
        p.last_name,
        p.birth_date,
        p.age,
        p.room_no,
        p.medical_info,
        p.status,
        p.discharge_date,
        p.discharge_note,
        p.mrn,
        p.admitted_date,
        p.is_behavioral,
        p.is_restrained,
        p.is_geriatric_psych_available,
        p.is_behavioral_team,
        p.is_ltc,
        p.is_ltc_financial,
        p.is_ltc_medical,
        p.is_guardianship,
        p.is_guardianship_financial,
        p.is_guardianship_person,
        p.is_guardianship_emergency,
        p.guardianship_court_datetime::timestamptz AS guardianship_court_datetime,
        p.ltc_court_datetime::timestamptz AS ltc_court_datetime,
        p.created_at,
        p.added_by_user_id,
        p.selected_algorithms,
        p.hospital_id,
        p.updated_at,
        p.version,
        json_agg(
          json_build_object(
            'id', u.id,
            'name', u.name,
            'access_level', ps.access_level
          )
        ) FILTER (WHERE u.id IS NOT NULL) AS assigned_staff,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id AND pt.status = 'Missed'
          ) THEN 'missed'
          WHEN NOT EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id AND pt.ideal_due_date::date = CURRENT_DATE
          ) THEN 'completed'
          WHEN NOT EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id
              AND pt.ideal_due_date::date = CURRENT_DATE
              AND pt.status != 'Completed'
          ) THEN 'completed'
          ELSE 'in_progress'
        END AS task_status
      FROM patients p
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      WHERE ${conditions.join(" AND ")}
      GROUP BY p.id
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found or access denied" });
    }

    return res.status(200).json(result.rows[0]);

  } catch (err) {
    console.error("❌ Error fetching patient:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};


const getPatientTasks = async (req, res) => {
  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: User not approved." });
  }

  if (req.user.has_global_access) {
    return res.status(403).json({
      error: "Access denied: Organization admins cannot access patient data.",
    });
  }

  const { patientId } = req.params;
  let conditions = ["id = $1"];
  let params = [patientId];
  let idx = 2;
  if (req.user.is_super_admin) {
    params.push(req.user.organization_id);
    conditions.push(`
      hospital_id IN (
        SELECT id FROM hospitals WHERE organization_id = $${idx}
      )
    `);
    idx++;
  }


  else if (req.user.is_admin) {
    params.push(req.user.hospital_id);
    conditions.push(`hospital_id = $${idx}`);
    idx++;
  }

  else if (req.user.is_staff) {
    params.push(req.user.id);
    conditions.push(`
      EXISTS (
        SELECT 1 FROM patient_staff
        WHERE patient_id = patients.id
          AND staff_id = $${idx}
      )
    `);
    idx++;

    params.push(req.user.hospital_id);
    conditions.push(`hospital_id = $${idx}`);
    idx++;
  }

  else {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const patientCheckQuery = `
      SELECT status FROM patients
      WHERE ${conditions.join(" AND ")}
    `;
    const patientCheck = await pool.query(patientCheckQuery, params);

    if (!patientCheck.rows.length) {
      return res.status(404).json({ error: "Patient not found or access denied" });
    }

    // ✅ Block discharged if not super admin
    if (patientCheck.rows[0].status === "Discharged" && !req.user.is_super_admin) {
      return res.status(403).json({ error: "Tasks not available for discharged patients" });
    }

    // ✅ Fetch tasks
    const query = `
      SELECT 
        pt.id AS patient_task_id,
        pt.status_history,
        pt.task_id,
        t.name AS task_name,
        t.category,
        t.description,
        pt.status,
        pt.due_date,
        pt.completed_at,
        pt.started_at,
        pt.version,
        pt.updated_at,
        pt.override_count,
        t.condition_required,
        t.is_repeating,
        t.due_in_days_after_dependency,
        t.is_non_blocking,
        t.is_overridable,
        t.is_court_date,
        t.algorithm,
        pt.ideal_due_date,
        pt.task_note,
        pt.include_note_in_report,
        pt.contact_info,
        u1.name AS completed_by,
        u2.name AS started_by,
        u3.name AS acknowledged_by,
        acknowledged_history.timestamp AS acknowledged_at
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      LEFT JOIN LATERAL (
        SELECT (elem.value ->> 'staff_id')::INTEGER AS staff_id
        FROM jsonb_array_elements(pt.status_history) elem
        WHERE elem.value ->> 'status' IN ('Completed', 'Delayed Completed')
        ORDER BY (elem.value ->> 'timestamp')::timestamp DESC LIMIT 1
      ) AS completed_history ON TRUE
      LEFT JOIN users u1 ON u1.id = completed_history.staff_id
      LEFT JOIN LATERAL (
        SELECT (elem.value ->> 'staff_id')::INTEGER AS staff_id
        FROM jsonb_array_elements(pt.status_history) elem
        WHERE elem.value ->> 'status' = 'In Progress'
        ORDER BY (elem.value ->> 'timestamp')::timestamp DESC LIMIT 1
      ) AS started_history ON TRUE
      LEFT JOIN users u2 ON u2.id = started_history.staff_id
      LEFT JOIN LATERAL (
        SELECT (elem.value ->> 'staff_id')::INTEGER AS staff_id,
               (elem.value ->> 'timestamp')::timestamptz AS timestamp
        FROM jsonb_array_elements(pt.status_history) elem
        WHERE elem.value ->> 'status' = 'Acknowledged'
        ORDER BY (elem.value ->> 'timestamp')::timestamp DESC LIMIT 1
      ) AS acknowledged_history ON TRUE
      LEFT JOIN users u3 ON u3.id = acknowledged_history.staff_id
      WHERE pt.patient_id = $1
        AND COALESCE(pt.is_visible, TRUE) = TRUE
        AND COALESCE((SELECT is_archived FROM patients WHERE id = $1), false) = false
      ORDER BY pt.due_date ASC
    `;

    const { rows } = await pool.query(query, [patientId]);
    return res.status(200).json(rows);

  } catch (err) {
    console.error("❌ Error fetching patient tasks:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};


const dischargePatient = async (req, res) => {
  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: User not approved." });
  }

  if (!req.user.is_admin || req.user.has_global_access) {
    return res.status(403).json({ error: "Only hospital admins may discharge patients." });
  }

  const { patientId } = req.params;
  const { dischargeNote, version } = req.body;
  const userHospitalId = req.user.hospital_id;

  if (version == null) {
    return res.status(400).json({ error: "Missing version." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await client.query(
      `
      UPDATE patients
      SET status = 'Discharged',
          discharge_date = NOW(),
          discharge_note = $1,
          version = version + 1,
          updated_at = NOW()
      WHERE id = $2
        AND hospital_id = $3
        AND version = $4
      RETURNING *;
      `,
      [dischargeNote, patientId, userHospitalId, version]
    );
    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Patient already updated or access denied. Refresh and try again."
      });
    }

    const patient = result.rows[0];
    const staffRes = await client.query(
      `
      SELECT u.id AS staff_id
      FROM patient_staff ps
      JOIN users u ON u.id = ps.staff_id
      WHERE ps.patient_id = $1 AND u.is_staff = true
      `,
      [patientId]
    );

    const io = req.app.get("io");

    for (const { staff_id } of staffRes.rows) {
      const title = "Patient Discharged";
      const message = `${patient.first_name} ${patient.last_name} has been discharged`;

      const { rows: [notif] } = await client.query(
        `
        INSERT INTO notifications (user_id, patient_id, title, message, type)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [staff_id, patient.id, title, message, "discharge"]
      );

      io?.to?.(`user-${staff_id}`)?.emit("notification", notif);
    }

    await client.query("COMMIT");

    res.status(200).json({ message: "Patient discharged successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error discharging patient:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};


const reactivatePatient = async (req, res) => {
  const { patientId } = req.params;
  const { version } = req.body;
  const userHospitalId = req.user.hospital_id;

  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: User not approved." });
  }

  if (!req.user.is_admin || req.user.has_global_access) {
    return res.status(403).json({
      error: "Only hospital admins may reactivate patients.",
    });
  }

  if (version == null) {
    return res.status(400).json({ error: "Missing version." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await client.query(
      `
      UPDATE patients
      SET discharge_date = NULL,
          discharge_note = NULL,
          status = 'Admitted',
          version = version + 1,
          updated_at = NOW()
      WHERE id = $1
        AND hospital_id = $2
        AND version = $3
      RETURNING *;
      `,
      [patientId, userHospitalId, version]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Patient already updated or access denied. Refresh and try again.",
      });
    }

    const patient = result.rows[0];
    const staffRes = await client.query(
      `
      SELECT u.id AS staff_id
      FROM patient_staff ps
      JOIN users u ON u.id = ps.staff_id
      WHERE ps.patient_id = $1 AND u.is_staff = true
      `,
      [patientId]
    );

    const io = req.app.get("io");

    for (const { staff_id } of staffRes.rows) {
      const title = "Patient Reinstated";
      const message = `${patient.first_name} ${patient.last_name} has been reinstated to active care.`

      const { rows: [notif] } = await client.query(
        `
        INSERT INTO notifications (user_id, patient_id, title, message, type)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [staff_id, patient.id, title, message, "reinstated"]
      );

      io?.to?.(`user-${staff_id}`)?.emit("notification", notif);
    }

    await client.query("COMMIT");

    res.status(200).json({ message: "Patient reactivated successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error reactivating patient:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const getDischargedPatients = async (req, res) => {
  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: User not approved." });
  }
  if (req.user.has_global_access) {
    return res.status(403).json({
      error: "Access denied: Organization admins cannot access patient data.",
    });
  }
  if (req.user.is_staff) {
    return res.status(403).json({
      error: "Access denied: Staff cannot access discharged patients.",
    });
  }

  try {
    const { is_super_admin, is_admin, hospital_id, organization_id } = req.user;
    const { start, end,hospitalId } = req.query;

    let filters = [
      `p.status = 'Discharged'`,
      `COALESCE(p.is_archived,false) = false`,
    ];
    let params = [];
    if (is_super_admin) {
      params.push(organization_id);
      filters.push(`
        p.hospital_id IN (
          SELECT id FROM hospitals WHERE organization_id = $${params.length}
        )
      `);
      if (hospitalId) {
        params.push(hospitalId);
        filters.push(`p.hospital_id = $${params.length}`);
      }
    
    }

    else if (is_admin) {
      params.push(hospital_id);
      filters.push(`p.hospital_id = $${params.length}`);
    }

    else {
      return res.status(403).json({ error: "Access denied." });
    }

    if (start) {
      params.push(start);
      filters.push(`p.discharge_date::date >= $${params.length}`);
    }

    if (end) {
      params.push(end);
      filters.push(`p.discharge_date::date <= $${params.length}`);
    }

    const sql = `
      SELECT 
        p.*,
        json_agg(json_build_object('id', u.id, 'name', u.name))
          FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
      FROM patients p
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      WHERE ${filters.join(" AND ")}
      GROUP BY p.id
      ORDER BY p.discharge_date DESC NULLS LAST
    `;

    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM patients p
      WHERE ${filters.join(" AND ")}
    `;

    const [{ rows: patients }, { rows: countRows }] = await Promise.all([
      pool.query(sql, params),
      pool.query(countSql, params),
    ]);

    return res.status(200).json({
      count: countRows[0]?.count ?? 0,
      patients,
    });

  } catch (err) {
    console.error("❌ Error fetching discharged patients:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};


const updatePatient = async (req, res) => {
  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: User not approved." });
  }

  if (req.user.has_global_access || req.user.is_super_admin) {
    return res.status(403).json({
      error: "Access denied: You cannot modify patient records.",
    });
  }

  if (!req.user.is_admin && !req.user.is_staff) {
    return res.status(403).json({
      error: "Access denied: Only hospital admins and staff may update patients.",
    });
  }

  const timezone = req.headers["x-timezone"] || "America/New_York";
  const patientId = req.params.patientId;

  const {
    first_name,
    last_name,
    birth_date,
    age,
    roomNo,
    admitted_date,
    mrn,
    medical_info,
    assignedStaffIds = [],
    selected_algorithms = [],
    reason,
    version,
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT * FROM patients WHERE id = $1 FOR UPDATE`,
      [patientId]
    );

    if (version == null) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Missing version." });
    }

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Patient not found." });
    }

    const existing = rows[0];

    if (existing.hospital_id !== req.user.hospital_id) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "Access denied: Patient belongs to another hospital.",
      });
    }

    if (req.user.is_staff) {
      const { rows: assigned } = await client.query(
        `SELECT 1 FROM patient_staff WHERE patient_id = $1 AND staff_id = $2`,
        [patientId, req.user.id]
      );

      if (!assigned.length) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error: "Access denied: You are not assigned to this patient.",
        });
      }
    }

    if (existing.version !== Number(version)) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Patient was updated by another user. Please refresh."
      });
    }

    const isAdmin = req.user.is_admin;

    if (!assignedStaffIds.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "At least one staff member must be assigned to the patient.",
      });
    }

    const normalize = (arr) =>
      arr.map((s) => {
        if (typeof s === "string") {
          try { return JSON.parse(s); } catch { return null; }
        }
        return s;
      }).filter(Boolean);

    const normalizedStaff = normalize(assignedStaffIds);

    const hasEditAccess = normalizedStaff.some(
      (s) => ["edit"].includes(String(s.access_level).toLowerCase())
    );

    if (!hasEditAccess) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "At least one staff member must have edit access.",
      });
    }

    const { rows: currentStaff } = await client.query(
      `SELECT staff_id FROM patient_staff WHERE patient_id = $1`,
      [patientId]
    );

    const currentIds = currentStaff.map(s => String(s.staff_id)).sort();
    const newIds = normalizedStaff.map(s => String(s.staff_id ?? s.id)).sort();
    const staffChanged = currentIds.join() !== newIds.join();

    if (!isAdmin && staffChanged && !reason?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Reason required when changing staff assignments.",
      });
    }

    const flagUpdates = {
      is_behavioral: selected_algorithms.includes("Behavioral"),
      is_ltc: selected_algorithms.includes("LTC"),
      is_guardianship: selected_algorithms.includes("Guardianship"),
    };

    const admittedDateUTC = admitted_date
      ? DateTime.fromISO(admitted_date, { zone: timezone }).toUTC().toISO()
      : null;

    const changes = {};
    const diff = (k, o, n) => o !== n && (changes[k] = { old: o, new: n });

    diff("first_name", existing.first_name, first_name);
    diff("last_name", existing.last_name, last_name);
    diff("birth_date", existing.birth_date?.toISOString(), birth_date);
    diff("age", existing.age, age);
    diff("room_no", existing.room_no, roomNo);
    diff("mrn", existing.mrn, mrn);
    diff("medical_info", existing.medical_info, medical_info);
    diff("admitted_date", existing.admitted_date?.toISOString(), admitted_date);
    diff("is_behavioral", existing.is_behavioral, flagUpdates.is_behavioral);
    diff("is_ltc", existing.is_ltc, flagUpdates.is_ltc);
    diff("is_guardianship", existing.is_guardianship, flagUpdates.is_guardianship);

    const updateRes = await client.query(
      `UPDATE patients SET
        first_name=$1,last_name=$2,birth_date=$3,age=$4,room_no=$5,mrn=$6,
        medical_info=$7,selected_algorithms=$8,is_behavioral=$9,
        is_restrained=$10,is_geriatric_psych_available=$11,is_behavioral_team=$12,
        is_ltc=$13,is_ltc_medical=$14,is_ltc_financial=$15,
        is_guardianship=$16,is_guardianship_financial=$17,
        is_guardianship_person=$18,is_guardianship_emergency=$19,
        admitted_date=$20,version = version + 1, updated_at = NOW()
      WHERE id = $21 AND hospital_id = $23 AND version = $22`,
      [
        first_name, last_name, birth_date, age, roomNo, mrn, medical_info,
        selected_algorithms, flagUpdates.is_behavioral,
        req.body.is_restrained, req.body.is_geriatric_psych_available,
        req.body.is_behavioral_team, flagUpdates.is_ltc, req.body.is_ltc_medical,
        req.body.is_ltc_financial, flagUpdates.is_guardianship,
        req.body.is_guardianship_financial, req.body.is_guardianship_person,
        req.body.is_guardianship_emergency, admittedDateUTC,
        patientId, version, req.user.hospital_id
      ]
    );

    if (updateRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Patient was modified by someone else. Please refresh."
      });
    }

    await client.query(`DELETE FROM patient_staff WHERE patient_id=$1`, [patientId]);

    for (const s of normalizedStaff) {
      await client.query(
        `INSERT INTO patient_staff (patient_id, staff_id, access_level)
         VALUES ($1,$2,$3)`,
        [patientId, parseInt(s.staff_id ?? s.id), s.access_level || "view"]
      );
    }

    await assignTasksToPatient(patientId, timezone, selected_algorithms);

    await client.query(
      `INSERT INTO patient_update_logs (patient_id, user_id, reason, changes, created_at)
       VALUES ($1,$2,$3,$4,NOW())`,
      [patientId, req.user.id, reason || "N/A", JSON.stringify(changes)]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Patient updated successfully",
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error updating patient:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
  }
};




const getSearchedPatients = async (req, res) => {
  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: User not approved." });
  }
  if (req.user.has_global_access) {
  return res.status(403).json({
    error: "Access denied: Organization admins cannot access patient records.",
  });
}


  try {
    const { q, status = "active", start, end, hospitalId: filterHospitalId, adminId } = req.query;

    const {
      id: currentUserId,
      is_staff,
      is_admin,
      is_super_admin,
      has_global_access,
      organization_id,
      hospital_id: userHospitalId,
    } = req.user;

    if (!q || q.trim() === "") {
      return res.status(400).json({ error: "Search query is required." });
    }

    const timezone = req.headers["x-timezone"] || "America/New_York";
    const today = DateTime.now().setZone(timezone).endOf("day").toUTC().toJSDate();
    const query = `%${q.toLowerCase()}%`;

    let params = [query, today];
    let conditions = [];


    if (is_staff) {
      params.push(currentUserId);
      conditions.push(`p.id IN (SELECT patient_id FROM patient_staff WHERE staff_id = $${params.length})`);
    }
   
    else if (is_super_admin) {
      params.push(organization_id);
      conditions.push(`p.hospital_id IN (SELECT id FROM hospitals WHERE organization_id = $${params.length})`);
    }
    else if (is_admin) {
      params.push(userHospitalId);
      conditions.push(`p.hospital_id = $${params.length}`);
    }

  
    if (filterHospitalId) {
      params.push(filterHospitalId);
      conditions.push(`p.hospital_id = $${params.length}`);
    }


    if (adminId) {

      params.push(adminId);
      conditions.push(`p.added_by_user_id = $${params.length}`);
      params.push(adminId);
      conditions.push(`p.hospital_id = (SELECT hospital_id FROM users WHERE id = $${params.length})`);
    }

    /** STATUS */
    if (status === "discharged") {
      conditions.push("p.discharge_date IS NOT NULL AND COALESCE(p.is_archived, false) = false");
    } else if (status === "archived") {
      conditions.push("COALESCE(p.is_archived, false) = true");
    } else {
      conditions.push("p.discharge_date IS NULL AND COALESCE(p.is_archived, false) = false");
    }

    /** DATE RANGE */
    if (start || end) {
      const dateField =
        status === "archived" ? "p.archived_at"
        : status === "discharged" ? "p.discharge_date"
        : "p.created_at";

      if (start && end) {
        params.push(start, end);
        conditions.push(`${dateField}::date BETWEEN $${params.length - 1} AND $${params.length}`);
      } else if (start) {
        params.push(start);
        conditions.push(`${dateField}::date >= $${params.length}`);
      } else if (end) {
        params.push(end);
        conditions.push(`${dateField}::date <= $${params.length}`);
      }
    }

    const nameParts = q.trim().toLowerCase().split(" ");
    if (nameParts.length === 2) {
       conditions.push(`
        (
          (LOWER(p.first_name) LIKE $${params.length - 1} AND LOWER(p.last_name) LIKE $${params.length})
          OR (LOWER(p.first_name) LIKE $${params.length} AND LOWER(p.last_name) LIKE $${params.length - 1})
          OR LOWER(p.first_name || ' ' || p.last_name) LIKE $1
          OR LOWER(p.last_name || ' ' || p.first_name) LIKE $1
          OR LOWER(p.mrn) LIKE $1
        )
      `);
    } else {
      conditions.push(`
        (
          LOWER(p.first_name) LIKE $1
          OR LOWER(p.last_name) LIKE $1
          OR LOWER(p.mrn) LIKE $1
          OR LOWER(p.first_name || ' ' || p.last_name) LIKE $1
          OR LOWER(p.last_name || ' ' || p.first_name) LIKE $1
        )
      `);
    }

    const whereClause = "WHERE " + conditions.join(" AND ");

    const sql = `
      SELECT 
        p.*,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id AND pt.status = 'Missed' AND pt.is_visible = true
          ) THEN 'missed'
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id
              AND pt.due_date <= $2::timestamp
              AND pt.status NOT IN ('Completed','Delayed Completed','Missed')
              AND pt.is_visible = true
          ) THEN 'in_progress'
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id AND pt.status IN ('Completed','Delayed Completed') AND pt.is_visible = true
          ) THEN 'completed'
          ELSE NULL
        END AS task_status,
        json_agg(json_build_object('id', u.id, 'name', u.name))
          FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
      FROM patients p
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;

    const result = await pool.query(sql, params);
    return res.status(200).json(result.rows);

  } catch (err) {
    console.error("❌ Error searching patients:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};



const getPatientsByAdmin = async (req, res) => {
  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: User not approved." });
  }

  if (req.user.has_global_access) {
    return res.status(403).json({
      error: "Organization admins cannot access patient data.",
    });
  }

  if (req.user.is_staff) {
    return res.status(403).json({
      error: "Staff cannot access patients by admin.",
    });
  }

  try {
    const { adminId } = req.params;
    const {
      is_admin,
      is_super_admin,
      hospital_id: userHospitalId,
      organization_id,
    } = req.user;

    const { hospitalId: filterHospitalId } = req.query;
    const timezone = req.headers["x-timezone"] || "America/New_York";

    const todayEndInUTC = DateTime.now()
      .setZone(timezone)
      .endOf("day")
      .toUTC()
      .toJSDate();

    let params = [];
    params.push(adminId);     
    params.push(todayEndInUTC);     

    let conditions = [];

  
    if (is_super_admin) {
      params.push(organization_id);
      conditions.push(`
        p.hospital_id IN (
          SELECT id FROM hospitals WHERE organization_id = $${params.length}
        )
      `);

      if (filterHospitalId) {
        params.push(filterHospitalId);
        conditions.push(`p.hospital_id = $${params.length}`);
      }
    }

    else if (is_admin) {
      params.push(userHospitalId);
      conditions.push(`p.hospital_id = $${params.length}`);
    }

    else {
      return res.status(403).json({ error: "Access denied" });
    }
    conditions.push(`p.added_by_user_id = $1`);

  
    conditions.push(`p.status = 'Admitted'`);
    conditions.push(`COALESCE(p.is_archived,false) = false`);

    const whereClause = "WHERE " + conditions.join(" AND ");

    const query = `
      SELECT 
        p.*,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id AND pt.status = 'Missed' AND pt.is_visible = true
          ) THEN 'missed'
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id
              AND pt.due_date <= $2::timestamp
              AND pt.status NOT IN ('Completed','Delayed Completed','Missed')
              AND pt.is_visible = true
          ) THEN 'in_progress'
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id
              AND pt.status IN ('Completed','Delayed Completed')
              AND pt.is_visible = true
          ) THEN 'completed'
          ELSE NULL
        END AS task_status,
        json_agg(json_build_object('id', u.id, 'name', u.name))
          FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
      FROM patients p
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;

    const result = await pool.query(query, params);
    return res.status(200).json(result.rows);

  } catch (err) {
    console.error("❌ Error fetching patients by admin:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};




const updateCourtDate = async (req, res) => {
  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: User not approved." });
  }

  if (req.user.has_global_access || req.user.is_super_admin) {
    return res.status(403).json({
      error: "Access denied: You are not authorized to modify court dates.",
    });
  }

  if (!req.user.is_admin && !req.user.is_staff) {
    return res.status(403).json({
      error: "Access denied: Only hospital admins and staff may edit court dates.",
    });
  }

  const { id: patientId } = req.params;
  const { type, newDate, version } = req.body;
  const timezone = req.headers["x-timezone"] || "America/New_York";

  if (version == null) {
    return res.status(400).json({ error: "Missing version." });
  }

  if (!["guardianship", "ltc"].includes(type)) {
    return res.status(400).json({ error: "Invalid type. Must be 'guardianship' or 'ltc'." });
  }

  const column =
    type === "guardianship"
      ? "guardianship_court_datetime"
      : "ltc_court_datetime";

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 🔒 Lock and verify record
    const { rows } = await client.query(
      `SELECT id, hospital_id, version FROM patients WHERE id = $1 FOR UPDATE`,
      [patientId]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Patient not found." });
    }

    const patient = rows[0];

    if (patient.hospital_id !== req.user.hospital_id) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "Access denied: Patient belongs to another hospital.",
      });
    }

    if (patient.version !== Number(version)) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Patient was already modified. Please refresh and try again.",
      });
    }

    if (req.user.is_staff) {
      const { rows: assigned } = await client.query(
        `SELECT 1 FROM patient_staff WHERE patient_id = $1 AND staff_id = $2`,
        [patientId, req.user.id]
      );

      if (!assigned.length) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error: "Access denied: You are not assigned to this patient.",
        });
      }
    }

    const localDateTime = DateTime.fromISO(newDate, { zone: timezone });
    if (!localDateTime.isValid) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Invalid date format." });
    }

    const utcDateTime = localDateTime.toUTC().toISO();

    // ✅ Update with optimistic locking
    const updateRes = await client.query(
      `
      UPDATE patients
      SET ${column} = $1,
          version = version + 1,
          updated_at = NOW()
      WHERE id = $2 AND version = $3
      RETURNING *;
      `,
      [utcDateTime, patientId, version]
    );

    if (updateRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Patient already updated. Please refresh.",
      });
    }

    await client.query("COMMIT");
    return res.status(200).json({ message: "Court date updated successfully." });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error updating court date:", error);
    return res.status(500).json({ error: "Failed to update court date." });
  } finally {
    client.release();
  }
};

const archiveDischargedPatient = async (req, res) => {
  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: User not approved." });
  }

  if (!req.user.is_admin || req.user.has_global_access || req.user.is_super_admin) {
    return res.status(403).json({
      error: "Only hospital admins may archive patients.",
    });
  }

  const { patientId } = req.params;
  const { reason, version } = req.body || {};
  const hospitalId = req.user.hospital_id;

  if (version == null) {
    return res.status(400).json({ error: "Missing version." });
  }

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: "Archive reason is required." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 🔒 Lock & verify
    const { rows } = await client.query(
      `SELECT id, status, hospital_id, version
       FROM patients
       WHERE id = $1 AND hospital_id = $2
       FOR UPDATE`,
      [patientId, hospitalId]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Patient not found or access denied." });
    }

    const patient = rows[0];

    if (patient.version !== Number(version)) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Patient was already updated. Please refresh and try again.",
      });
    }

    if (patient.status !== "Discharged") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Only discharged patients can be archived.",
      });
    }

    // ✅ Version-safe update
    const { rows: updated } = await client.query(
      `
      UPDATE patients
      SET is_archived = TRUE,
          archived_at = NOW(),
          archived_by_user_id = $1,
          archived_reason = $2,
          status = 'Archived',
          version = version + 1,
          updated_at = NOW()
      WHERE id = $3 AND version = $4
      RETURNING *;
      `,
      [req.user.id, reason.trim(), patientId, version]
    );

    if (!updated.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Patient already updated. Refresh and retry.",
      });
    }

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Patient archived successfully.",
      patient: updated[0],
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error archiving patient:", err);

    if (err.code === "42703") {
      return res.status(400).json({
        error: "Archive fields missing on patients table.",
      });
    }

    return res.status(500).json({ error: "Internal server error" });

  } finally {
    client.release();
  }
};


const getArchivedPatients = async (req, res) => {
  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: User not approved." });
  }
  if (req.user.has_global_access) {
    return res.status(403).json({
      error: "Organization admins cannot access patient data.",
    });
  }

  if (req.user.is_staff) {
    return res.status(403).json({
      error: "Staff cannot access archived patients.",
    });
  }

  try {
    const { is_super_admin, is_admin, hospital_id, organization_id } = req.user;
    const { start, end, hospitalId } = req.query;

    let filters = [
      `p.status = 'Archived'`,
      `COALESCE(p.is_archived,false) = true`
    ];
    let params = [];

    if (is_super_admin) {
      params.push(organization_id);
      filters.push(`
        p.hospital_id IN (
          SELECT id FROM hospitals
          WHERE organization_id = $${params.length}
        )
      `);

      if (hospitalId) {
        params.push(hospitalId);
        filters.push(`p.hospital_id = $${params.length}`);
      }
    }
    else if (is_admin) {
      params.push(hospital_id);
      filters.push(`p.hospital_id = $${params.length}`);
    }

    else {
      return res.status(403).json({ error: "Access denied." });
    }


    if (start) {
      params.push(start);
      filters.push(`p.archived_at::date >= $${params.length}`);
    }

    if (end) {
      params.push(end);
      filters.push(`p.archived_at::date <= $${params.length}`);
    }

    const sql = `
      SELECT 
        p.*,
        json_agg(json_build_object('id', u.id, 'name', u.name))
          FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
      FROM patients p
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      WHERE ${filters.join(" AND ")}
      GROUP BY p.id
      ORDER BY p.archived_at DESC NULLS LAST
    `;

    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM patients p
      WHERE ${filters.join(" AND ")}
    `;

    const [{ rows: patients }, { rows: countRows }] = await Promise.all([
      pool.query(sql, params),
      pool.query(countSql, params),
    ]);

    return res.status(200).json({
      count: countRows[0]?.count ?? 0,
      patients,
    });

  } catch (err) {
    console.error("❌ Error fetching archived patients:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};


module.exports = {
  getPatients,
  addPatient,
  getPatientById,
  getPatientTasks,
  dischargePatient,
  reactivatePatient,
  getDischargedPatients,
  updatePatient,
  getSearchedPatients,
  getPatientsByAdmin,
  updateCourtDate,
  archiveDischargedPatient,
  getArchivedPatients
};