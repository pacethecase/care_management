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
      is_guardianship_emergency
      
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
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,CURRENT_DATE) RETURNING *`,
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
      ]
    );
    const newPatient = result.rows[0];

  
    await assignTasksToPatient(newPatient.id); 
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
      `SELECT pt.id AS task_id, t.name AS task_name, t.category, t.description, pt.status, pt.due_date,pt.completed_at, t.condition_required, t.is_repeating,t.due_in_days_after_dependency,t.is_non_blocking
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

    // Update patient record
    await pool.query(
      `UPDATE patients 
       SET status = 'Discharged', 
           discharge_date = NOW(), 
           discharge_note = $1 
       WHERE id = $2`,
      [dischargeNote, patientId]
    );

    res.status(200).json({ message: "Patient discharged successfully" });

  } catch (err) {
    console.error("❌ Error discharging patient:", err);
    res.status(500).json({ error: "Internal Server Error" });
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



module.exports = {
  getPatients,
  addPatient,
  getPatientById,
  getPatientTasks,
  dischargePatient,
  getDischargedPatients
};