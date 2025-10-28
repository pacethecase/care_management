
const pool = require("../models/db");
const assignTasksToPatient = require("../services/assignTasksToPatient");
const { DateTime } = require('luxon');


const getPatients = async (req, res) => {
  if (!req.user?.is_approved) {
  return res.status(403).json({ error: "Access denied: User not approved." });
}

  try {
    const userId = req.user?.id;
    const isStaff = req.user?.is_staff;
    const hospitalId = req.user?.hospital_id;
    const timezone = req.headers["x-timezone"] || "America/New_York";

    const todayEndInUTC = DateTime.now()
      .setZone(timezone)
      .endOf("day")
      .toUTC()
      .toJSDate();


    const result = await pool.query(`
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
              AND pt.status NOT IN ('Completed','Delayed Completed', 'Missed')
              AND pt.is_visible = true
          ) THEN 'in_progress'
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id 
              AND pt.status IN ('Completed', 'Delayed Completed') 
              AND pt.is_visible = true
          ) THEN 'completed'
         ELSE NULL
        END AS task_status,
        
        json_agg(json_build_object('id', u.id, 'name', u.name)) 
          FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
      FROM patients p
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      ${isStaff 
        ? `WHERE ps.staff_id = $2 AND p.status != 'Discharged' AND p.status = 'Admitted' AND p.hospital_id = $3   AND COALESCE(p.is_archived, false) = false`
        : `WHERE p.status != 'Discharged' AND p.status = 'Admitted' AND p.hospital_id = $2   AND COALESCE(p.is_archived, false) = false`
      }
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, isStaff 
        ? [todayEndInUTC, userId, hospitalId] 
        : [todayEndInUTC, hospitalId]);


    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching patients:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};



// Add Patient
const addPatient = async (req, res) => {
  if (!req.user?.is_approved) {
  return res.status(403).json({ error: "Access denied: User not approved." });
}

  const added_by_user_id = req.user.id;
  const hospital_id = req.user.hospital_id;

  const timezone = req.headers['x-timezone'] || 'America/New_York';


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

    // Validate required fields
    if (!first_name || !last_name || !birth_date || !roomNo || !age || !mrn) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    console.log("✅ Submitting patient with hospital_id:", hospital_id);

    // Construct selected_algorithms from flags
    const selectedAlgorithms = [];
    if (is_behavioral) selectedAlgorithms.push("Behavioral");
    if (is_guardianship) selectedAlgorithms.push("Guardianship");
    if (is_ltc) selectedAlgorithms.push("LTC");

    const admittedDateUTC = admitted_date
  ? DateTime.fromISO(admitted_date, { zone: timezone }).toUTC().toISO()
  : null;

    // Convert created_at to UTC
    const createdAtUTC = created_at
      ? DateTime.fromISO(created_at, { zone: timezone }).toUTC().toISO()
      : DateTime.now().setZone(timezone).toUTC().toISO();
    // Insert patient into DB
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

    // Then iterate over normalizedStaff instead
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


// Get Patient By ID
const getPatientById = async (req, res) => {
  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: User not approved." });
  }

  const userHospitalId = req.user.hospital_id;
  const timezone = req.headers['x-timezone'] || 'America/New_York';

  try {
    const { patientId } = req.params;

    const result = await pool.query(`
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
        json_agg(json_build_object('id', u.id, 'name', u.name, 'access_level', ps.access_level))
          FILTER (WHERE u.id IS NOT NULL) AS assigned_staff,
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
      WHERE p.id = $1 AND p.hospital_id = $2 
      AND COALESCE(p.is_archived,false) = false
      GROUP BY p.id
    `, [patientId, userHospitalId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found" });
    }


    const patient = result.rows[0];
    console.log(patient)
    res.status(200).json(patient);
  } catch (err) {
    console.error("❌ Error fetching patient:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getPatientTasks = async (req, res) => {
  if (!req.user?.is_approved) {
  return res.status(403).json({ error: "Access denied: User not approved." });
}

  try {
    const { patientId } = req.params;
    const userHospitalId = req.user.hospital_id;

    // Check patient exists and belongs to same hospital
    const statusRes = await pool.query(
      `SELECT status FROM patients WHERE id = $1 AND hospital_id = $2`,
      [patientId, userHospitalId]
    );

    if (statusRes.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found or access denied" });
    }

    if (statusRes.rows[0].status === 'Discharged') {
      return res.status(403).json({ error: "Tasks are not available for discharged patients" });
    }

    const result = await pool.query(
      `SELECT 
        pt.id AS patient_task_id,
        pt.status_history, 
        pt.task_id AS task_id,
        t.name AS task_name,
        t.category,
        t.description,
        pt.status,
        pt.due_date,
        pt.completed_at,
        pt.started_at,
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

      -- Last 'Completed'
      LEFT JOIN LATERAL (
        SELECT (elem.value ->> 'staff_id')::INTEGER AS staff_id
        FROM jsonb_array_elements(pt.status_history) AS elem
        WHERE elem.value ->> 'status' IN ('Completed', 'Delayed Completed')
        ORDER BY (elem.value ->> 'timestamp')::timestamp DESC
        LIMIT 1
      ) AS completed_history ON TRUE
      LEFT JOIN users u1 ON u1.id = completed_history.staff_id

      -- Last 'In Progress'
      LEFT JOIN LATERAL (
        SELECT (elem.value ->> 'staff_id')::INTEGER AS staff_id
        FROM jsonb_array_elements(pt.status_history) AS elem
        WHERE elem.value ->> 'status' = 'In Progress'
        ORDER BY (elem.value ->> 'timestamp')::timestamp DESC
        LIMIT 1
      ) AS started_history ON TRUE
      LEFT JOIN users u2 ON u2.id = started_history.staff_id


     -- Last 'Acknowledged'
      LEFT JOIN LATERAL (
        SELECT 
          (elem.value ->> 'staff_id')::INTEGER AS staff_id,
          (elem.value ->> 'timestamp')::timestamptz AS timestamp
        FROM jsonb_array_elements(pt.status_history) AS elem
        WHERE elem.value ->> 'status' = 'Acknowledged'
        ORDER BY (elem.value ->> 'timestamp')::timestamp DESC
        LIMIT 1
      ) AS acknowledged_history ON TRUE
      LEFT JOIN users u3 ON u3.id = acknowledged_history.staff_id


      JOIN patients p ON pt.patient_id = p.id
      WHERE pt.patient_id = $1 AND p.hospital_id = $2 AND pt.is_visible = TRUE
      AND COALESCE(p.is_archived,false) = false
      ORDER BY pt.due_date ASC`,
      [patientId, userHospitalId]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching patient tasks:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const dischargePatient = async (req, res) => {
  if (!req.user?.is_approved) {
  return res.status(403).json({ error: "Access denied: User not approved." });
}

  try {
    const { patientId } = req.params;
    const { dischargeNote } = req.body;
    const userHospitalId = req.user.hospital_id;

    // Check if patient exists and belongs to same hospital
    const patientRes = await pool.query(
      `SELECT * FROM patients WHERE id = $1 AND hospital_id = $2`,
      [patientId, userHospitalId]
    );

    if (patientRes.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found or access denied" });
    }

    const patient = patientRes.rows[0];

    // Update patient record
    await pool.query(
      `UPDATE patients 
       SET status = 'Discharged', 
           discharge_date = NOW(), 
           discharge_note = $1 
       WHERE id = $2`,
      [dischargeNote, patientId]
    );

    const io = req.app.get('io');


     const staffRes = await pool.query(
   `SELECT u.id AS staff_id
   FROM patient_staff ps
    JOIN users u ON u.id = ps.staff_id
   WHERE ps.patient_id = $1 AND u.is_staff = true`,
  [patientId]
  );

  for (const { staff_id } of staffRes.rows) {
    const title = "Patient Discharged";
    const message = `${patient.first_name} ${patient.last_name} has been discharged.`;

    const { rows: [notif] } = await pool.query(
      `INSERT INTO notifications (user_id, patient_id, title, message, type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        staff_id,
        patient.id,
        title,
        message,
        "discharge"   
      ]
    );


    io?.to?.(`user-${staff_id}`)?.emit("notification", notif);
  }

    res.status(200).json({ message: "Patient discharged successfully" });

  } catch (err) {
    console.error("❌ Error discharging patient:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const reactivatePatient = async (req, res) => {
  const { patientId } = req.params;
  const userHospitalId = req.user.hospital_id;
  if (!req.user?.is_approved) {
  return res.status(403).json({ error: "Access denied: User not approved." });
}


  try {
    // Enforce hospital isolation
    const patientRes = await pool.query(
      `SELECT * FROM patients WHERE id = $1 AND hospital_id = $2`,
      [patientId, userHospitalId]
    );

    if (patientRes.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found or access denied" });
    }

    const patient = patientRes.rows[0];

    await pool.query(
      `UPDATE patients
       SET discharge_date = NULL,
           discharge_note = NULL,
           status = 'Admitted'
       WHERE id = $1`,
      [patientId]
    );

const io = req.app.get("io");

const staffRes = await pool.query(
  `SELECT u.id AS staff_id
   FROM patient_staff ps
   JOIN users u ON u.id = ps.staff_id
   WHERE ps.patient_id = $1 AND u.is_staff = true`,
  [patientId]
);

for (const { staff_id } of staffRes.rows) {
  const title = "Patient Reinstated";
  const message = `${patient.first_name} ${patient.last_name} has been reinstated to active care.`;


  const { rows: [notif] } = await pool.query(
    `INSERT INTO notifications (user_id, patient_id, title, message, type)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      staff_id,
      patient.id,
      title,
      message,
      "reinstated"  
    ]
  );
  io?.to?.(`user-${staff_id}`)?.emit("notification", notif);

}

res.json({ message: "Patient reactivated successfully" });

  } catch (err) {
    console.error("❌ Error reactivating patient:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
const getDischargedPatients = async (req, res) => {
  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: User not approved." });
  }

  try {
    const userHospitalId = req.user.hospital_id;
    const { start, end } = req.query; 

    let filters = [`p.hospital_id = $1`, `p.status = 'Discharged'`, `COALESCE(p.is_archived,false) = false`];
    const params = [userHospitalId];

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
        json_agg(
          json_build_object('id', u.id, 'name', u.name)
        ) FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
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

    res.status(200).json({
      count: countRows[0]?.count ?? 0,
      patients,
    });
  } catch (err) {
    console.error("❌ Error fetching discharged patients:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updatePatient = async (req, res) => {
  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: User not approved." });
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
  } = req.body;

  try {
    // --- Get current patient
    const { rows: patientRows } = await pool.query(`SELECT * FROM patients WHERE id = $1`, [patientId]);
    if (patientRows.length === 0) return res.status(404).json({ error: "Patient not found." });

    const existing = patientRows[0];
    if (existing.hospital_id !== req.user.hospital_id)
      return res.status(403).json({ error: "Access denied: Patient belongs to another hospital." });

    // --- Concurrency check
    const clientUpdatedAt = req.body.updated_at;
    if (!clientUpdatedAt) return res.status(400).json({ error: "Missing updated_at timestamp." });
    if (existing.updated_at?.toISOString() !== new Date(clientUpdatedAt).toISOString()) {
      return res.status(409).json({ error: "This patient was already updated by someone else." });
    }

    const isAdmin = req.user.is_admin || req.user.is_super_admin;

    // --- Current staff and new staff comparison
    const { rows: currentStaff } = await pool.query(
      `SELECT staff_id FROM patient_staff WHERE patient_id = $1`,
      [patientId]
    );
    const currentStaffIds = currentStaff.map((s) => String(s.staff_id)).sort();
    const newStaffIds = assignedStaffIds.map(s => String(s.staff_id ?? s.id)).sort();
    const staffChanged = currentStaffIds.join(",") !== newStaffIds.join(",");

    if (!isAdmin && staffChanged && (!reason || reason.trim() === "")) {
      return res.status(400).json({ error: "Reason is required when changing staff assignments." });
    }

    const oldSet = new Set(currentStaffIds);
    const newlyAddedStaffIds = newStaffIds.filter((id) => !oldSet.has(id));
    const removedStaffIds = currentStaffIds.filter((id) => !newStaffIds.includes(id));

    // --- Flags
    const flagUpdates = {
      is_behavioral: selected_algorithms.includes("Behavioral"),
      is_ltc: selected_algorithms.includes("LTC"),
      is_guardianship: selected_algorithms.includes("Guardianship"),
    };

    const admittedDateUTC = admitted_date
      ? DateTime.fromISO(admitted_date, { zone: timezone }).toUTC().toISO()
      : null;


    const changes = {};
    const addChange = (key, oldVal, newVal) => {
      if (oldVal !== newVal) changes[key] = { old: oldVal, new: newVal };
    };

    addChange("first_name", existing.first_name, first_name);
    addChange("last_name", existing.last_name, last_name);
    addChange("birth_date", existing.birth_date?.toISOString().split("T")[0], birth_date);
    addChange("age", existing.age, age);
    addChange("room_no", existing.room_no, roomNo);
    addChange("mrn", existing.mrn, mrn);
    addChange("medical_info", existing.medical_info, medical_info);
    addChange("admitted_date", existing.admitted_date?.toISOString(), admitted_date);

    addChange("is_behavioral", existing.is_behavioral, flagUpdates.is_behavioral);
    addChange("is_restrained", existing.is_restrained, req.body.is_restrained);
    addChange("is_geriatric_psych_available", existing.is_geriatric_psych_available, req.body.is_geriatric_psych_available);
    addChange("is_behavioral_team", existing.is_behavioral_team, req.body.is_behavioral_team);

    addChange("is_ltc", existing.is_ltc, flagUpdates.is_ltc);
    addChange("is_ltc_medical", existing.is_ltc_medical, req.body.is_ltc_medical);
    addChange("is_ltc_financial", existing.is_ltc_financial, req.body.is_ltc_financial);

    addChange("is_guardianship", existing.is_guardianship, flagUpdates.is_guardianship);
    addChange("is_guardianship_financial", existing.is_guardianship_financial, req.body.is_guardianship_financial);
    addChange("is_guardianship_person", existing.is_guardianship_person, req.body.is_guardianship_person);
    addChange("is_guardianship_emergency", existing.is_guardianship_emergency, req.body.is_guardianship_emergency);

    if (staffChanged) {
      const { rows: oldStaff } = await pool.query(
        `SELECT name FROM users WHERE id = ANY($1::int[])`,
        [currentStaffIds.map(Number)]
      );
      const { rows: newStaff } = await pool.query(
        `SELECT name FROM users WHERE id = ANY($1::int[])`,
        [newStaffIds.map(Number)]
      );
      changes.staff_assignments = {
        old: oldStaff.map((s) => s.name),
        new: newStaff.map((s) => s.name),
      };
    }

    // --- Update patient record
    await pool.query(
      `UPDATE patients SET 
        first_name=$1,last_name=$2,birth_date=$3,age=$4,room_no=$5,mrn=$6,
        medical_info=$7,selected_algorithms=$8,is_behavioral=$9,
        is_restrained=$10,is_geriatric_psych_available=$11,is_behavioral_team=$12,
        is_ltc=$13,is_ltc_medical=$14,is_ltc_financial=$15,
        is_guardianship=$16,is_guardianship_financial=$17,
        is_guardianship_person=$18,is_guardianship_emergency=$19,
        admitted_date=$20,updated_at=NOW()
       WHERE id=$21`,
      [
        first_name, last_name, birth_date, age, roomNo, mrn, medical_info, selected_algorithms,
        flagUpdates.is_behavioral, req.body.is_restrained, req.body.is_geriatric_psych_available,
        req.body.is_behavioral_team, flagUpdates.is_ltc, req.body.is_ltc_medical, req.body.is_ltc_financial,
        flagUpdates.is_guardianship, req.body.is_guardianship_financial, req.body.is_guardianship_person,
        req.body.is_guardianship_emergency, admittedDateUTC, patientId,
      ]
    );

    // --- Update staff assignment
    await pool.query(`DELETE FROM patient_staff WHERE patient_id=$1`, [patientId]);
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
    const patientIdNum = parseInt(patientId, 10);
    const accessLevel = staff.access_level || "view";

    if (isNaN(staffId) || isNaN(patientIdNum)) {
      console.warn("⚠️ Skipping invalid staff_id:", staff);
      continue;
    }

    await pool.query(
      `INSERT INTO patient_staff (patient_id, staff_id, access_level)
      VALUES ($1, $2, $3)`,
      [patientIdNum, staffId, accessLevel]
    );
  }

    await assignTasksToPatient(patientId, timezone, selected_algorithms);

    await pool.query(
      `INSERT INTO patient_update_logs (patient_id, user_id, reason, changes, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [patientId, req.user.id, reason || "N/A", JSON.stringify(changes)]
    );

  
    const io = req.app.get("io");
    const { rows: admins } = await pool.query(
      `SELECT id, name FROM users WHERE hospital_id=$1 AND (is_admin=true OR is_super_admin=true)`,
      [req.user.hospital_id]
    );
    const updaterName = req.user.name || req.user.email || "Unknown User";

      
    const formatVal = (val) => {
      if (val === true || val === "true") return "Enabled";
      if (val === false || val === "false" || val === null || val === undefined) return "Disabled";
      return String(val);
    };

    const prettyField = (key) => {
      const map = {
        first_name: "First Name",
        last_name: "Last Name",
        birth_date: "Birth Date",
        room_no: "Room #",
        mrn: "MRN",
        is_behavioral: "Behavioral Flag",
        is_restrained: "Restrained",
        is_geriatric_psych_available: "Geriatric Psych Availability",
        is_behavioral_team: "Behavioral Team",
        is_ltc: "LTC Flag",
        is_ltc_medical: "LTC Medical",
        is_ltc_financial: "LTC Financial",
        is_guardianship: "Guardianship",
        is_guardianship_financial: "Guardianship Financial",
        is_guardianship_person: "Guardianship Person",
        is_guardianship_emergency: "Guardianship Emergency",
      };
      return map[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    };

    let summary = Object.entries(changes)
      .map(([f, v]) => {
        if (f === "staff_assignments") {
          return `Staff changed:\n   From: ${v.old.join(", ") || "None"}\n   To: ${v.new.join(", ") || "None"}`;
        }
        const oldVal = formatVal(v.old);
        const newVal = formatVal(v.new);
        return `${prettyField(f)}: ${oldVal} → ${newVal}`;
      })
      .join("\n");

    if (reason) summary += `\nReason: ${reason}`;


    const adminMessage = `Patient ${first_name} ${last_name} updated by ${updaterName}.\n\n${summary}`;
    const staffMessage = `Patient ${first_name} ${last_name} updated by ${updaterName}.\n\n${summary}`;

    if (isAdmin) {
        for (const s of assignedStaffIds) {
          const staffId = parseInt(s.staff_id ?? s.id, 10);
          if (isNaN(staffId)) {
            console.warn("⚠️ Skipping invalid staff id in notifications:", s);
            continue;
          }

       const { rows: [notif] } = await pool.query(
          `INSERT INTO notifications (user_id, patient_id, title, message, type)
          VALUES ($1, $2, 'Patient Updated by Admin', $3, 'update') RETURNING *`,
          [staffId, patientId, staffMessage]
        );

        io?.to?.(`user-${staffId}`)?.emit("notification", notif);
      }


      for (const admin of admins) {
        const { rows: [notif] } = await pool.query(
          `INSERT INTO notifications (user_id, patient_id, title, message, type)
           VALUES ($1, $2, 'Audit: Patient Record Updated', $3, 'audit') RETURNING *`,
          [admin.id, patientId, adminMessage]
        );
        io?.to?.(`user-${admin.id}`)?.emit("notification", notif);
      }

      for (const sid of newlyAddedStaffIds) {
        const message = `You’ve been assigned to patient ${first_name} ${last_name} by ${updaterName}.`;
        const { rows: [notif] } = await pool.query(
          `INSERT INTO notifications (user_id, patient_id, title, message, type)
           VALUES ($1, $2, 'New Patient Assignment', $3, 'assignment') RETURNING *`,
          [sid, patientId, message]
        );
        io?.to?.(`user-${sid}`)?.emit("notification", notif);
      }

      for (const sid of removedStaffIds) {
        const message = `You’ve been unassigned from patient ${first_name} ${last_name} by ${updaterName}.`;
        const { rows: [notif] } = await pool.query(
          `INSERT INTO notifications (user_id, patient_id, title, message, type)
           VALUES ($1, $2, 'Patient Unassignment', $3, 'unassignment') RETURNING *`,
          [sid, patientId, message]
        );
        io?.to?.(`user-${sid}`)?.emit("notification", notif);
      }

    } else {
      // --- Staff Updates
      for (const admin of admins) {
        const { rows: [notif] } = await pool.query(
          `INSERT INTO notifications (user_id, patient_id, title, message, type)
           VALUES ($1, $2, 'Patient Record Change', $3, 'update') RETURNING *`,
          [admin.id, patientId, adminMessage]
        );
        io?.to?.(`user-${admin.id}`)?.emit("notification", notif);
      }

  
        for (const s of assignedStaffIds) {
          const staffId = parseInt(s.staff_id ?? s.id, 10);
          if (isNaN(staffId)) {
            console.warn("⚠️ Skipping invalid staff id in notifications:", s);
            continue;
          }

       const { rows: [notif] } = await pool.query(
          `INSERT INTO notifications (user_id, patient_id, title, message, type)
          VALUES ($1, $2, 'Patient Updated by Admin', $3, 'update') RETURNING *`,
          [staffId, patientId, staffMessage]
        );
        io?.to?.(`user-${staffId}`)?.emit("notification", notif);
      }


      for (const sid of newlyAddedStaffIds) {
        const message = `You’ve been assigned to patient ${first_name} ${last_name} by ${updaterName}. ${reason ? `Reason: ${reason}` : ""}`;
        const { rows: [notif] } = await pool.query(
          `INSERT INTO notifications (user_id, patient_id, title, message, type)
           VALUES ($1, $2, 'New Patient Assignment', $3, 'assignment') RETURNING *`,
          [sid, patientId, message]
        );
        io?.to?.(`user-${sid}`)?.emit("notification", notif);
      }

      for (const sid of removedStaffIds) {
        const message = `You’ve been unassigned from patient ${first_name} ${last_name} by ${updaterName}. ${reason ? `Reason: ${reason}` : ""}`;
        const { rows: [notif] } = await pool.query(
          `INSERT INTO notifications (user_id, patient_id, title, message, type)
           VALUES ($1, $2, 'Patient Unassignment', $3, 'unassignment') RETURNING *`,
          [sid, patientId, message]
        );
        io?.to?.(`user-${sid}`)?.emit("notification", notif);
      }
    }

    // --- Final return
    const { rows: [updatedPatient] } = await pool.query(
      `SELECT p.*, json_agg(
        json_build_object(
          'id', u.id,
          'name', u.name,
          'access_level', ps.access_level
        )
      ) AS assigned_staff
      FROM patients p
      LEFT JOIN patient_staff ps ON ps.patient_id = p.id
      LEFT JOIN users u ON u.id = ps.staff_id
      WHERE p.id = $1
      GROUP BY p.id`,
      [patientId]
    );

    return res.status(200).json({
      message: "Patient updated successfully",
      patient: updatedPatient,
    });

  } catch (err) {
    console.error("❌ Failed to update patient:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};




const getSearchedPatients = async (req, res) => {
  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: User not approved." });
  }

  try {
    const { q, status } = req.query;
    const hospitalId = req.user.hospital_id;
    const timezone = req.headers["x-timezone"] || "America/New_York";

    if (!q || q.trim() === "") {
      return res.status(400).json({ error: "Search query is required" });
    }

    const today = DateTime.now().setZone(timezone).endOf("day").toUTC().toJSDate();
    const query = `%${q.toLowerCase()}%`;


    const conditions = [`p.hospital_id = $2`];
    const params = [query, hospitalId, today];

    switch (status) {
      case "discharged":
        conditions.push("p.discharge_date IS NOT NULL");
        conditions.push("COALESCE(p.is_archived, false) = false");
        break;
      case "archived":
        // archived patients
        conditions.push("COALESCE(p.is_archived, false) = true");
        break;
      default: // active patients
        // not discharged and not archived
        conditions.push("p.discharge_date IS NULL");
        conditions.push("COALESCE(p.is_archived, false) = false");
        break;
    }


  
    conditions.push(`(
      LOWER(p.first_name || ' ' || p.last_name) LIKE $1 OR
      LOWER(p.mrn) LIKE $1 OR
      p.admitted_date::text LIKE $1 OR
      p.created_at::text LIKE $1 OR
      p.discharge_date::text LIKE $1 OR
      p.archived_at::text LIKE $1
    )`);

    const whereClause = conditions.join(" AND ");

    const result = await pool.query(
      `SELECT 
         p.*,
         CASE
           WHEN EXISTS (
             SELECT 1 FROM patient_tasks pt
             WHERE pt.patient_id = p.id AND pt.status = 'Missed' AND pt.is_visible = true
           ) THEN 'missed'
           WHEN EXISTS (
             SELECT 1 FROM patient_tasks pt
             WHERE pt.patient_id = p.id
               AND pt.due_date <= $3::timestamp
               AND pt.status NOT IN ('Completed','Delayed Completed', 'Missed')
               AND pt.is_visible = true
           ) THEN 'in_progress'
           WHEN EXISTS (
             SELECT 1 FROM patient_tasks pt
             WHERE pt.patient_id = p.id AND pt.status IN ('Completed', 'Delayed Completed') AND pt.is_visible = true
           ) THEN 'completed'
           ELSE NULL
         END AS task_status,
         json_agg(json_build_object('id', u.id, 'name', u.name))
           FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
       FROM patients p
       LEFT JOIN patient_staff ps ON p.id = ps.patient_id
       LEFT JOIN users u ON ps.staff_id = u.id
       WHERE ${whereClause}
       GROUP BY p.id
       ORDER BY 
         CASE
           WHEN $4 = 'discharged' THEN p.discharge_date
           WHEN $4 = 'archived' THEN p.archived_at
           ELSE p.created_at
         END DESC`,
      [...params, status || "active"]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error searching patients:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};


const getPatientsByAdmin = async (req, res) => {
  if (!req.user?.is_approved) {
  return res.status(403).json({ error: "Access denied: User not approved." });
}

  const { adminId } = req.params;
  const hospitalId = req.user.hospital_id;
  const timezone = req.headers["x-timezone"] || "America/New_York";
  const today = DateTime.now().setZone(timezone).endOf('day').toUTC().toJSDate();

  try {
    const result = await pool.query(
      `SELECT 
        p.*,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id AND pt.status = 'Missed' AND pt.is_visible = true
          ) THEN 'missed'
          WHEN EXISTS (
            SELECT 1 FROM patient_tasks pt
            WHERE pt.patient_id = p.id
             AND pt.due_date <= $3::timestamp
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
      WHERE p.added_by_user_id = $1 AND p.hospital_id = $2 AND p.status != 'Discharged'   AND COALESCE(p.is_archived, false) = false AND p.status = 'Admitted'
      GROUP BY p.id
      ORDER BY p.created_at DESC`,
      [adminId, hospitalId, today]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching patients by admin:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};





const updateCourtDate = async (req, res) => {
  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: User not approved." });
  }

  const { id } = req.params;
  const { type, newDate } = req.body;
  const timezone = req.headers['x-timezone'] || 'America/New_York';

  if (!["guardianship", "ltc"].includes(type)) {
    return res.status(400).json({ error: "Invalid type. Must be 'guardianship' or 'ltc'." });
  }

  const column = type === "guardianship"
    ? "guardianship_court_datetime"
    : "ltc_court_datetime";

  try {
    const localDateTime = DateTime.fromISO(newDate, { zone: timezone });
    const utcDateTime = localDateTime.toUTC().toISO();

    await pool.query(
      `UPDATE patients SET ${column} = $1 WHERE id = $2`,
      [utcDateTime, id]
    );

    res.status(200).json({ message: "Court date updated successfully." });
  } catch (error) {
    console.error("❌ Error updating court date:", error);
    res.status(500).json({ error: "Failed to update court date." });
  }
};


const archiveDischargedPatient = async (req, res) => {
  if (!req.user?.is_approved) return res.status(403).json({ error: "Access denied: User not approved." });
  if (!req.user?.is_admin && !req.user?.is_super_admin) {
    return res.status(403).json({ error: "Only admins can archive patients." });
  }

  try {
    const { patientId } = req.params;
    const { reason } = req.body || {};
    const hospitalId = req.user.hospital_id;
    if (!reason) {
      return res.status(400).json({ error: "Archive reason is required." });
    }
    const { rows } = await pool.query(
      `SELECT id, status, hospital_id FROM patients WHERE id = $1`,
      [patientId]
    );
    if (rows.length === 0 || rows[0].hospital_id !== hospitalId) {
      return res.status(404).json({ error: "Patient not found or access denied" });
    }
    if (!['Discharged', 'Archived'].includes(rows[0].status)) {
      // Allow idempotent re-archive if already Archived
      return res.status(400).json({ error: "Only discharged patients can be archived." });
    }

    const { rows: updated } = await pool.query(
      `UPDATE patients
         SET is_archived = TRUE,
             archived_at = NOW(),
             archived_by_user_id = $1,
             archived_reason = $2,
             status = 'Archived'
       WHERE id = $3
       RETURNING *`,
      [req.user.id, reason ?? null, patientId]
    );

    return res.status(200).json({ message: "Patient archived successfully.", patient: updated[0] });
  } catch (err) {
    console.error("❌ Error archiving patient:", err);
    if (err.code === "42703") {
      return res.status(400).json({ error: "Archive fields missing on patients table." });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};


const getArchivedPatients = async (req, res) => {
  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: User not approved." });
  }

  try {
    const userHospitalId = req.user.hospital_id;
    const { start, end } = req.query;

    let filters = [
      `p.hospital_id = $1`,
      `p.status = 'Archived'`,
      `COALESCE(p.is_archived,false) = true`
    ];
    const params = [userHospitalId];

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
    json_agg(
      json_build_object('id', u.id, 'name', u.name)
    ) FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
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

    res.status(200).json({
      count: countRows[0]?.count ?? 0,
      patients,
    });
  } catch (err) {
    console.error("❌ Error fetching archived patients:", err);
    res.status(500).json({ error: "Internal server error" });
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