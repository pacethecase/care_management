const pool = require("../models/db");

// ✅ Get Notes for a Patient
const getPatientNotes = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { hospital_id } = req.user;

    // Make sure patient belongs to the same hospital
    const patientCheck = await pool.query(
      `SELECT 1 FROM patients WHERE id = $1 AND hospital_id = $2`,
      [patientId, hospital_id]
    );

    if (patientCheck.rowCount === 0) {
      return res.status(403).json({ error: "Unauthorized access to patient notes" });
    }

    const notesResult = await pool.query(
      `SELECT n.*, u.name AS nurse_name 
       FROM notes n 
       LEFT JOIN users u ON n.staff_id = u.id 
       WHERE n.patient_id = $1 
       ORDER BY n.created_at DESC`,
      [patientId]
    );

    res.status(200).json(notesResult.rows);
  } catch (err) {
    console.error("❌ Error fetching notes:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


// ✅ Add Note
const addPatientNote = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { staff_id, note_text } = req.body;
    const { hospital_id } = req.user;

    if (!note_text.trim()) {
      return res.status(400).json({ error: "Note cannot be empty" });
    }

    // Check hospital match
    const patientCheck = await pool.query(
      `SELECT 1 FROM patients WHERE id = $1 AND hospital_id = $2`,
      [patientId, hospital_id]
    );

    if (patientCheck.rowCount === 0) {
      return res.status(403).json({ error: "Unauthorized access to patient" });
    }

const newNoteRes = await pool.query(
  `INSERT INTO notes (patient_id, staff_id, note_text)
   VALUES ($1, $2, $3)
   RETURNING id, note_text, created_at, staff_id`,
  [patientId, staff_id, note_text]
);

const newNote = newNoteRes.rows[0];

    // Get nurse name from staff_id
    const nurseRes = await pool.query(
      `SELECT name FROM users WHERE id = $1`,
      [staff_id]
    );

    const name = nurseRes.rows[0]?.name || null;

    res.status(201).json({
      ...newNote,
      name, 
    });
  } catch (err) {
    console.error("❌ Error adding note:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


// ✅ Edit Note (Optional)
const updatePatientNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const { note_text } = req.body;
    const { hospital_id } = req.user;

    if (!note_text.trim()) {
      return res.status(400).json({ error: "Note cannot be empty" });
    }

    // Ensure note belongs to a patient in the same hospital
    const noteCheck = await pool.query(
      `SELECT 1
       FROM notes n
       JOIN patients p ON n.patient_id = p.id
       WHERE n.id = $1 AND p.hospital_id = $2`,
      [noteId, hospital_id]
    );

    if (noteCheck.rowCount === 0) {
      return res.status(403).json({ error: "Unauthorized to edit this note" });
    }

    const updatedNote = await pool.query(
      `UPDATE notes 
       SET note_text = $1, created_at = NOW() 
       WHERE id = $2 RETURNING *`,
      [note_text, noteId]
    );

    res.status(200).json(updatedNote.rows[0]);
  } catch (err) {
    console.error("❌ Error updating note:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { getPatientNotes, addPatientNote, updatePatientNote };
