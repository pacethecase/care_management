
const pool = require("../models/db");
const assignTasksToPatient = require("../services/assignTasksToPatient");
const { DateTime } = require('luxon');


const getPatients = async (req, res) => {
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
        ? `WHERE ps.staff_id = $2 AND p.status != 'Discharged' AND p.hospital_id = $3`
        : `WHERE p.status != 'Discharged' AND p.hospital_id = $2`
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
  const added_by_user_id = req.user.id;
  const hospital_id = req.user.hospital_id;

  const timezone = req.headers['x-timezone'] || 'America/New_York';


  try {
    const {
      first_name,
      last_name,
      birth_date,
      age,
      bedId,
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
    if (!first_name || !last_name || !birth_date || !bedId || !age || !mrn) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    console.log("✅ Submitting patient with hospital_id:", hospital_id);

    // Construct selected_algorithms from flags
    const selectedAlgorithms = [];
    if (is_behavioral) selectedAlgorithms.push("Behavioral");
    if (is_guardianship) selectedAlgorithms.push("Guardianship");
    if (is_ltc) selectedAlgorithms.push("LTC");
    // Convert created_at to UTC
    const createdAtUTC = created_at
      ? DateTime.fromISO(created_at, { zone: timezone }).toUTC().toISO()
      : DateTime.now().setZone(timezone).toUTC().toISO();
    // Insert patient into DB
    const result = await pool.query(
      `INSERT INTO patients (
        first_name, last_name, birth_date, age, bed_id, mrn, medical_info,
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
        first_name, last_name, birth_date, age, bedId, mrn, medical_info,
        is_behavioral, is_restrained, is_geriatric_psych_available, is_behavioral_team,
        is_ltc, is_ltc_medical, is_ltc_financial,
        is_guardianship, is_guardianship_financial, is_guardianship_person, is_guardianship_emergency,
        admitted_date, added_by_user_id, hospital_id, createdAtUTC,
        selectedAlgorithms
      ]
    );

    const newPatient = result.rows[0];

    // Validate staff assignment
    if (assignedStaffIds.length > 0) {
      const { rows: validStaff } = await pool.query(
        `SELECT id FROM users WHERE id = ANY($1::int[]) AND hospital_id = $2`,
        [assignedStaffIds, hospital_id]
      );
      const validStaffIds = validStaff.map(s => s.id);
      if (validStaffIds.length !== assignedStaffIds.length) {
        return res.status(400).json({ error: "One or more assigned staff are not in your hospital" });
      }
    }

    // Insert into patient_staff
    for (const staffId of assignedStaffIds) {
      await pool.query(
        `INSERT INTO patient_staff (patient_id, staff_id) VALUES ($1, $2)`,
        [newPatient.id, staffId]
      );
    }

    await assignTasksToPatient(newPatient.id, timezone, selectedAlgorithms);

    // Send real-time notifications to assigned staff
    if (assignedStaffIds.length > 0) {
      const io = req.app.get("io");
      for (const staffId of assignedStaffIds) {
        const message = `You are assigned to ${newPatient.first_name} ${newPatient.last_name}`;
        io.to(`user-${staffId}`).emit("notification", {
          title: "New Patient Assigned",
          message
        });
        await pool.query(
          `INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)`,
          [staffId, "New Patient Assigned", message]
        );
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
  const userHospitalId = req.user.hospital_id;
    const timezone = req.headers['x-timezone'] || 'America/New_York';
  try {
    const { patientId } = req.params;

    const result = await pool.query(`
  SELECT 
    p.*,
    json_agg(json_build_object('id', u.id, 'name', u.name)) FILTER (WHERE u.id IS NOT NULL) AS assigned_staff,
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
  GROUP BY p.id
`, [patientId, userHospitalId]);


    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found" });
    }
  const patient = result.rows[0];

  

    res.status(200).json(patient);
  } catch (err) {
    console.error("❌ Error fetching patient:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getPatientTasks = async (req, res) => {
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
        pt.task_id AS task_id,
        t.name AS task_name,
        t.category,
        t.description,
        pt.status,
        pt.due_date,
        pt.completed_at,
        pt.started_at,

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
          (elem.value ->> 'timestamp')::timestamp AS timestamp
        FROM jsonb_array_elements(pt.status_history) AS elem
        WHERE elem.value ->> 'status' = 'Acknowledged'
        ORDER BY (elem.value ->> 'timestamp')::timestamp DESC
        LIMIT 1
      ) AS acknowledged_history ON TRUE
      LEFT JOIN users u3 ON u3.id = acknowledged_history.staff_id


      JOIN patients p ON pt.patient_id = p.id
      WHERE pt.patient_id = $1 AND p.hospital_id = $2 AND pt.is_visible = TRUE
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
      io.to(`user-${staff_id}`).emit("notification", {
        title: "Patient Discharged",
        message: `${patient.first_name} ${patient.last_name} has been discharged.`,
      });

      await pool.query(
        `INSERT INTO notifications (user_id, patient_id, title, message)
         VALUES ($1, $2, $3, $4)`,
        [
          staff_id,
          patient.id,
          "Patient Discharged",
          `${patient.first_name} ${patient.last_name} has been discharged.`
        ]
      );
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

    const io = req.app.get('io');

   const staffRes = await pool.query(
    `SELECT u.id AS staff_id
    FROM patient_staff ps
      JOIN users u ON u.id = ps.staff_id
    WHERE ps.patient_id = $1 AND u.is_staff = true`,
    [patientId]
    );
  
    for (const { staff_id } of staffRes.rows) {
      io.to(`user-${staff_id}`).emit("notification", {
        title: "Patient Reinstated",
        message: `${patient.first_name} ${patient.last_name} has been reinstated to active care1.`,
      });

      await pool.query(
        `INSERT INTO notifications (user_id, patient_id, title, message)
         VALUES ($1, $2, $3, $4)`,
        [
          staff_id,
          patient.id,
          "Patient Reinstated",
          `${patient.first_name} ${patient.last_name} has been reinstated to active care.`
        ]
      );
    }

    res.json({ message: 'Patient reactivated successfully' });

  } catch (err) {
    console.error("❌ Error reactivating patient:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
const getDischargedPatients = async (req, res) => {
  try {
    const userHospitalId = req.user.hospital_id;

    const result = await pool.query(`
      SELECT 
        p.*,
        json_agg(
          json_build_object(
            'id', u.id,
            'name', u.name
          )
        ) FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
      FROM patients p
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      WHERE p.status = 'Discharged' AND p.hospital_id = $1
      GROUP BY p.id
      ORDER BY p.discharge_date DESC
    `, [userHospitalId]);

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching discharged patients:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updatePatient = async (req, res) => {
  const patientId = req.params.patientId;
  const {
    first_name,
    last_name,
    birth_date,
    age,
    bedId,
    mrn,
    medical_info,
    assignedStaffIds = [],
    selected_algorithms = []
  } = req.body;

  try {
    const isAdmin = req.user.is_admin;
    const userHospitalId = req.user.hospital_id;
    if (!isAdmin) {
      return res.status(403).json({ error: "Only admins can edit patient data." });
    }

    // Fetch patient and enforce hospital isolation
    const checkRes = await pool.query(`SELECT * FROM patients WHERE id = $1`, [patientId]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found." });
    }

    const existing = checkRes.rows[0];

    if (existing.hospital_id !== userHospitalId) {
      return res.status(403).json({ error: "Access denied: Patient belongs to a different hospital." });
    }

    const prevAlgorithms = existing.selected_algorithms || [];
    const addedAlgorithms = selected_algorithms.filter(a => !prevAlgorithms.includes(a));
    const removedAlgorithms = prevAlgorithms.filter(a => !selected_algorithms.includes(a));

    // Prepare flag updates based on selected algorithms
    const flagUpdates = {
      is_behavioral: selected_algorithms.includes("Behavioral"),
      is_ltc: selected_algorithms.includes("LTC"),
      is_guardianship: selected_algorithms.includes("Guardianship"),
    };

    // Update patient details
    await pool.query(
      `UPDATE patients
       SET first_name = $1,
           last_name = $2,
           birth_date = $3,
           age = $4,
           bed_id = $5,
           mrn = $6,
           medical_info = $7,
           selected_algorithms = $8,
           is_behavioral = $9,
           is_restrained = $10,
           is_geriatric_psych_available = $11,
           is_behavioral_team = $12,
           is_ltc = $13,
           is_ltc_medical = $14,
           is_ltc_financial = $15,
           is_guardianship = $16,
           is_guardianship_financial = $17,
           is_guardianship_person = $18,
           is_guardianship_emergency = $19
       WHERE id = $20`,
      [
        first_name,
        last_name,
        birth_date,
        age,
        bedId,
        mrn,
        medical_info,
        selected_algorithms,

        flagUpdates.is_behavioral,
        req.body.is_restrained,
        req.body.is_geriatric_psych_available,
        req.body.is_behavioral_team,

        flagUpdates.is_ltc,
        req.body.is_ltc_medical,
        req.body.is_ltc_financial,

        flagUpdates.is_guardianship,
        req.body.is_guardianship_financial,
        req.body.is_guardianship_person,
        req.body.is_guardianship_emergency,

        patientId
      ]
    );

    // Replace staff assignments
    await pool.query(`DELETE FROM patient_staff WHERE patient_id = $1`, [patientId]);
    for (const staffId of assignedStaffIds) {
      await pool.query(
        `INSERT INTO patient_staff (patient_id, staff_id) VALUES ($1, $2)`,
        [patientId, staffId]
      );
    }

    // Assign or update tasks
    const timezone = req.headers['x-timezone'] || 'America/New_York';
    await assignTasksToPatient(patientId, timezone, selected_algorithms, addedAlgorithms, removedAlgorithms);

    // Return updated patient data
    const updatedPatientRes = await pool.query(`
      SELECT 
        p.*,
        json_agg(json_build_object('id', u.id, 'name', u.name)) FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
      FROM patients p
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      WHERE p.id = $1
      GROUP BY p.id
    `, [patientId]);

    return res.status(200).json({ message: "Patient updated successfully", patient: updatedPatientRes.rows[0] });

  } catch (err) {
    console.error("❌ Failed to update patient:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


const getSearchedPatients = async (req, res) => {
  try {
    const { q } = req.query;
    const hospitalId = req.user.hospital_id;
    const timezone = req.headers["x-timezone"] || "America/New_York";

    if (!q || q.trim() === "") {
      return res.status(400).json({ error: "Search query is required" });
    }

   const today = DateTime.now()
  .setZone(timezone)
  .endOf('day')
  .toUTC()
  .toJSDate(); 

    const query = `%${q.toLowerCase()}%`;

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
       WHERE p.hospital_id = $2
         AND (
           LOWER(p.first_name || ' ' || p.last_name) LIKE $1 OR
           LOWER(p.mrn) LIKE $1 OR
           p.admitted_date::text LIKE $1 OR
           p.created_at::text LIKE $1
         )
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [query, hospitalId, today]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error searching patients:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};


const getPatientsByAdmin = async (req, res) => {
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
      WHERE p.added_by_user_id = $1 AND p.hospital_id = $2 AND p.status != 'Discharged'
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
  const { id } = req.params;
  const { type, newDate } = req.body;

  if (!["guardianship", "ltc"].includes(type)) {
    return res.status(400).json({ error: "Invalid type. Must be 'guardianship' or 'ltc'." });
  }

  const column = type === "guardianship"
    ? "guardianship_court_datetime"
    : "ltc_court_datetime";

  try {
    await pool.query(
      `UPDATE patients SET ${column} = $1 WHERE id = $2`,
      [newDate, id]
    );
    res.status(200).json({ message: "Court date updated successfully." });
  } catch (error) {
    console.error("❌ Error updating court date:", error);
    res.status(500).json({ error: "Failed to update court date." });
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
  updateCourtDate

};