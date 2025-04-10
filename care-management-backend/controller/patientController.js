const pool = require("../models/db");
const assignTasksToPatient = require("../services/assignTasksToPatient");
// GET All Patients (with role filter)
const getPatients = async (req, res) => {
  try {
    const userId = req.user?.id;
    const isStaff = req.user?.is_staff;
    const query = isStaff
      ? `SELECT p.*, u.name AS staff_name FROM patients p LEFT JOIN users u ON p.assigned_staff_id = u.id WHERE p.assigned_staff_id = $1 ORDER BY p.created_at DESC`
      : `SELECT p.*, u.name AS staff_name FROM patients p LEFT JOIN users u ON p.assigned_staff_id = u.id ORDER BY p.created_at DESC`;

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
      medical_info,
      assignedStaffId,
      is_behavioral,
      is_restrained,
      is_geriatric_psych_available,
      is_behavioral_team,
      is_ltc,
      is_guardianship,
    } = req.body;

    if (!name || !birth_date || !bedId || !age) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const result = await pool.query(
      `INSERT INTO patients (name, birth_date, age, bed_id, medical_info, assigned_staff_id, is_behavioral, is_restrained, is_geriatric_psych_available, is_behavioral_team, is_ltc, is_guardianship)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        name,
        birth_date,
        age,
        bedId,
        medical_info,
        assignedStaffId || null,
        is_behavioral,
        is_restrained,
        is_geriatric_psych_available,
        is_behavioral_team,
        is_ltc,
        is_guardianship,
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
      `SELECT p.*, u.name AS staff_name FROM patients p LEFT JOIN users u ON p.assigned_staff_id = u.id WHERE p.id = $1`,
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
    const result = await pool.query(
      `SELECT pt.id AS task_id, t.name AS task_name, t.category, t.description, pt.status, pt.due_date, t.condition_required
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

module.exports = {
  getPatients,
  addPatient,
  getPatientById,
  getPatientTasks,
};