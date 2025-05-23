const pool = require("../models/db");
const assignTasksToPatient = require("../services/assignTasksToPatient");


// GET All Patients (with role filter)
const getPatients = async (req, res) => {
  try {
    const userId = req.user?.id;
    const isStaff = req.user?.is_staff;

    const result = await pool.query(`
      SELECT 
        p.*,
        json_agg(json_build_object('id', u.id, 'name', u.name)) FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
      FROM patients p
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      ${isStaff ? `WHERE ps.staff_id = $1 AND p.status != 'Discharged'` : `WHERE p.status != 'Discharged'`}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, isStaff ? [userId] : []);

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching patients:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};


// Add Patient
const addPatient = async (req, res) => {
  const added_by_user_id = req.user.id;
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
      added_by_user_id
    } = req.body;

    if (!first_name ||!last_name || !birth_date || !bedId || !age || !mrn) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const result = await pool.query(
      `INSERT INTO patients (first_name,last_name, birth_date, age, bed_id,mrn, medical_info, is_behavioral, is_restrained, is_geriatric_psych_available, is_behavioral_team, is_ltc,
      is_ltc_medical,
      is_ltc_financial,
      is_guardianship,
      is_guardianship_financial,
      is_guardianship_person,
      is_guardianship_emergency,admitted_date,added_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
      [
        first_name,
        last_name,
        birth_date,
        age,
        bedId,
        mrn,
        medical_info,
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
        added_by_user_id
      ]
    );
    const newPatient = result.rows[0];
    for (const staffId of assignedStaffIds) {
      await pool.query(
        `INSERT INTO patient_staff (patient_id, staff_id) VALUES ($1, $2)`,
        [newPatient.id, staffId]
      );
    }
    const timezone = req.headers['x-timezone'] || 'America/New_York';
    await assignTasksToPatient(newPatient.id, timezone);
    if (assignedStaffIds.length > 0) {
      const io = req.app.get("io");
    
      for (const staffId of assignedStaffIds) {
        io.to(`user-${staffId}`).emit("notification", {
          title: "New Patient Assigned",
          message: `You are assigned to ${newPatient.first_name} ${newPatient.last_name}`,
        });
    
        await pool.query(
          `INSERT INTO notifications (user_id, title, message)
           VALUES ($1, $2, $3)`,
          [staffId, "New Patient Assigned", `You are assigned to ${newPatient.first_name} ${newPatient.last_name}`]
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
  try {
    const { patientId } = req.params;

    const result = await pool.query(`
      SELECT 
        p.*,
        json_agg(json_build_object('id', u.id, 'name', u.name)) FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
      FROM patients p
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      WHERE p.id = $1
      GROUP BY p.id
    `, [patientId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error fetching patient:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};


// Get Tasks for a Patient
const getPatientTasks = async (req, res) => {
  try {
    const { patientId } = req.params;
    const statusRes = await pool.query(`SELECT status FROM patients WHERE id = $1`, [patientId]);
    if (statusRes.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found" });
    }

    if (statusRes.rows[0].status === 'Discharged') {
      return res.status(403).json({ error: "Tasks are not available for discharged patients" });
    }

    const result = await pool.query(
      `SELECT pt.id AS task_id, t.name AS task_name, t.category, t.description, pt.status, pt.due_date,pt.completed_at, t.condition_required, t.is_repeating,t.due_in_days_after_dependency,t.is_non_blocking, t.algorithm,pt.ideal_due_date, pt.task_note, pt.include_note_in_report, pt.contact_info,
      u.name AS completed_by
      FROM patient_tasks pt
       JOIN tasks t ON pt.task_id = t.id
       LEFT JOIN LATERAL (
          SELECT (elem.value ->> 'staff_id')::INTEGER AS staff_id
          FROM jsonb_array_elements(pt.status_history) AS elem
          WHERE elem.value ->> 'status' = 'Completed'
          ORDER BY (elem.value ->> 'timestamp')::timestamp DESC
          LIMIT 1
        ) AS history ON TRUE
         LEFT JOIN users u ON u.id = history.staff_id
       WHERE pt.patient_id = $1 AND pt.is_visible = TRUE
       ORDER BY pt.due_date ASC`,
      [patientId]
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

    // Check if patient exists
    const patientRes = await pool.query(`SELECT * FROM patients WHERE id = $1`, [patientId]);
    if (patientRes.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found" });
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

    // Get all assigned staff
    const staffRes = await pool.query(
      `SELECT staff_id FROM patient_staff WHERE patient_id = $1`,
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

  try {
    const patientRes = await pool.query(`SELECT * FROM patients WHERE id = $1`, [patientId]);
    if (patientRes.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found" });
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

    // Get all assigned staff
    const staffRes = await pool.query(
      `SELECT staff_id FROM patient_staff WHERE patient_id = $1`,
      [patientId]
    );

    for (const { staff_id } of staffRes.rows) {
      io.to(`user-${staff_id}`).emit("notification", {
        title: "Patient Reinstated",
        message: `${patient.first_name} ${patient.last_name} has been reinstated to active care.`,
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
    const result = await pool.query(`
      SELECT 
        p.*,
        json_agg(
          json_build_object(
            'id', u.id,
            'name',u.name
          )
        ) FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
      FROM patients p
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      WHERE p.status = 'Discharged'
      GROUP BY p.id
      ORDER BY p.discharge_date DESC
    `);

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
    if (!isAdmin) {
      return res.status(403).json({ error: "Only admins can edit patient data." });
    }

    // Fetch current patient
    const checkRes = await pool.query(`SELECT * FROM patients WHERE id = $1`, [patientId]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found." });
    }
    const existing = checkRes.rows[0];
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



// Search Patients (Global DB Search)
const getSearchedPatients = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === "") {
      return res.status(400).json({ error: "Search query is required" });
    }

    const query = `%${q.toLowerCase()}%`;
    const result = await pool.query(
      `SELECT id, first_name, last_name, mrn, birth_date, admitted_date, status, created_at, bed_id,
              is_behavioral, is_ltc, is_guardianship
        FROM patients
        WHERE LOWER(first_name || ' ' || last_name) LIKE $1 OR LOWER(mrn) LIKE $1
        ORDER BY created_at DESC
`,
      [query]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error searching patients:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};


const getPatientSummary = async (req, res) => {
  const { patientId } = req.params;
  try {
    // 1. Barrier to Discharge: Collect flags
    const patientRes = await pool.query(`SELECT * FROM patients WHERE id = $1`, [patientId]);
    if (patientRes.rows.length === 0) return res.status(404).json({ error: "Patient not found" });

    const p = patientRes.rows[0];

    let barrierToDischarge = [];
    if (p.is_behavioral) barrierToDischarge.push("Behavioral");
    if (p.is_ltc) barrierToDischarge.push("Long-Term Care");
    if (p.is_guardianship) barrierToDischarge.push("Guardianship");

    // 2. Daily Prioritization: fetch tasks due today and not completed
  const todayTasks = await pool.query(`
    SELECT t.name 
    FROM patient_tasks pt
    JOIN tasks t ON pt.task_id = t.id
    WHERE pt.patient_id = $1 
      AND pt.due_date::date = CURRENT_DATE 
      AND pt.status != 'Completed'
       AND pt.is_visible = TRUE
    ORDER BY pt.due_date ASC
  `, [patientId]);

  const prioritization = todayTasks.rows.length > 0
    ? todayTasks.rows.map(row => row.name).join(', ')
    : "None";

  // 3. Missed/Incomplete Tasks: due before today and not completed
  const missedOrIncomplete = await pool.query(`
    SELECT t.name 
    FROM patient_tasks pt
    JOIN tasks t ON pt.task_id = t.id
    WHERE pt.patient_id = $1 
      AND pt.due_date::date < CURRENT_DATE
      AND pt.status IN ('Pending', 'In Progress', 'Missed')
  `, [patientId]);
  
  const missedTasks = missedOrIncomplete.rows.length > 0
    ? missedOrIncomplete.rows.map(row => row.name).join(', ')
    : "None";
  




    // 4. Projected timeline (max ideal due date)
    const proj = await pool.query(`
      SELECT MAX(ideal_due_date) AS projected FROM patient_tasks WHERE patient_id = $1
    `, [patientId]);

    const projectedCompletion = proj.rows[0].projected
      ? new Date(proj.rows[0].projected).toLocaleDateString()
      : "N/A";

    res.json({
      barrier_to_discharge: barrierToDischarge.join(", ") || "None",
      daily_prioritization: prioritization,
      incomplete_tasks: missedTasks,
      projected_completion: projectedCompletion
    });

  } catch (err) {
    console.error("❌ Error getting patient summary:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getPatientsByAdmin = async (req, res) => {
  const { adminId } = req.params;

  try {
    const result = await pool.query(`
      SELECT 
        p.*,
        json_agg(json_build_object('id', u.id, 'name', u.name)) FILTER (WHERE u.id IS NOT NULL) AS assigned_staff
      FROM patients p
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      WHERE p.added_by_user_id = $1 AND p.status != 'Discharged'
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, [adminId]);

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching patients by admin:", err);
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
  getPatientSummary,
  getPatientsByAdmin

};