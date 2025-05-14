const pool = require("../models/db");
const assignTasksToPatient = require("../services/assignTasksToPatient");


// GET All Patients (with role filter)
const getPatients = async (req, res) => {
  try {
    const userId = req.user?.id;
    const isStaff = req.user?.is_staff;
    const query = isStaff
      ? `SELECT p.*, u.name AS staff_name FROM patients p LEFT JOIN users u ON p.assigned_staff_id = u.id WHERE p.assigned_staff_id = $1 AND p.status != 'Discharged' ORDER BY p.created_at DESC`
      : `SELECT p.*, u.name AS staff_name FROM patients p LEFT JOIN users u ON p.assigned_staff_id = u.id WHERE p.status != 'Discharged' ORDER BY p.created_at DESC`;

    const result = await pool.query(query, isStaff ? [userId] : []);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching patients:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Add Patient
const addPatient = async (req, res) => {
  try {
    const {
      name,
      birth_date,
      age,
      bedId,
      mrn,
      medical_info,
      assignedStaffId,
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
      admitted_date
    } = req.body;

    if (!name || !birth_date || !bedId || !age || !mrn) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const result = await pool.query(
      `INSERT INTO patients (name, birth_date, age, bed_id,mrn, medical_info, assigned_staff_id, is_behavioral, is_restrained, is_geriatric_psych_available, is_behavioral_team, is_ltc,
      is_ltc_medical,
      is_ltc_financial,
      is_guardianship,
      is_guardianship_financial,
      is_guardianship_person,
      is_guardianship_emergency,admitted_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [
        name,
        birth_date,
        age,
        bedId,
        mrn,
        medical_info,
        assignedStaffId || null,
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
        admitted_date
      ]
    );
    const newPatient = result.rows[0];

    const timezone = req.headers['x-timezone'] || 'America/New_York';
    await assignTasksToPatient(newPatient.id, timezone);
    if (assignedStaffId) {
      const io = req.app.get('io');

        io.to(`user-${assignedStaffId}`).emit('notification', {
          title: 'New Patient Assigned',
          message: `You are assigned to ${newPatient.name}`,
        });
        await pool.query(`
          INSERT INTO notifications (user_id, title, message)
          VALUES ($1, $2, $3)
        `, [assignedStaffId, 'New Patient Assigned',`You are assigned to ${newPatient.name}`]);
    }
    res.status(201).json({ message: "Patient added and tasks assigned", patient: result.rows[0] });
  } catch (err) {
    console.error("❌ Error adding patient:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get Patient By ID
const getPatientById = async (req, res) => {
  try {
    const { patientId } = req.params;
    const result = await pool.query(
      `SELECT p.*, u.name AS staff_name FROM patients p LEFT JOIN users u ON p.assigned_staff_id = u.id WHERE p.id = $1 AND p.status != 'Discharged'`,
      [patientId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: "Patient not found" });

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
      `SELECT pt.id AS task_id, t.name AS task_name, t.category, t.description, pt.status, pt.due_date,pt.completed_at, t.condition_required, t.is_repeating,t.due_in_days_after_dependency,t.is_non_blocking, t.algorithm,pt.ideal_due_date
       FROM patient_tasks pt
       JOIN tasks t ON pt.task_id = t.id
       WHERE pt.patient_id = $1
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
    const staffId = req.user?.id || null;

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

    if (patient.assigned_staff_id) {
    
      io.to(`user-${patient.assigned_staff_id}`).emit('notification', {
        title: 'Patient Discharged',
        message: `${patient.name} has been discharged.`,
      });

      await pool.query(`
        INSERT INTO notifications (user_id, patient_id, title, message)
        VALUES ($1, $2, $3, $4)
      `, [
        patient.assigned_staff_id,
        patient.id,
        'Patient Discharged',
        `${patient.name} has been discharged.`
      ]);
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
    if (patient.assigned_staff_id) {
      io.to(`user-${patient.assigned_staff_id}`).emit('notification', {
        title: 'Patient Reinstated',
        message: `${patient.name} has been reinstated.`,
      });

      await pool.query(`
        INSERT INTO notifications (user_id, patient_id, title, message)
        VALUES ($1, $2, $3, $4)
      `, [
        patient.assigned_staff_id,
        patient.id,
        'Patient Reinstated',
        `${patient.name} has been reinstated to active care.`
      ]);
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
      SELECT p.*, u.name AS staff_name
      FROM patients p
      LEFT JOIN users u ON p.assigned_staff_id = u.id
      WHERE p.status = 'Discharged'
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
    name,
    birth_date,
    age,
    bedId,
    mrn,
    medical_info,
    assignedStaffId
  } = req.body;

  try {
    // Check if patient exists
    const isAdmin = req.user.is_admin;
    if (!isAdmin) {
      return res.status(403).json({ error: "Only admins can edit patient data." });
    }

    const checkRes = await pool.query(`SELECT * FROM patients WHERE id = $1`, [patientId]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: "Patient not found." });
    }

    // Update patient
    const updateRes = await pool.query(
      `UPDATE patients
       SET name = $1,
           birth_date = $2,
           age = $3,
           bed_id = $4,
           mrn = $5,
           medical_info = $6,
           assigned_staff_id = $7
       WHERE id = $8
       RETURNING *`,
      [name, birth_date, age, bedId, mrn, medical_info, assignedStaffId || null, patientId]
    );

    await pool.query(
      `UPDATE patient_tasks
       SET assigned_staff_id = $1
       WHERE patient_id = $2`,
      [assignedStaffId || null, patientId]
    );
    return res.status(200).json({
      message: "Patient updated successfully",
      patient: updateRes.rows[0],
    });
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
      `SELECT id, name, mrn, birth_date, admitted_date, status, created_at,bed_id,is_behavioral,is_ltc,is_guardianship
       FROM patients
       WHERE LOWER(name) LIKE $1 OR LOWER(mrn) LIKE $1
       ORDER BY created_at DESC`,
      [query]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error searching patients:", err);
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
  getSearchedPatients
};