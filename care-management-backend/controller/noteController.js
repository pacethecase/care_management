const pool = require("../models/db");

// ✅ Get Notes for a Patient
const getPatientNotes = async (req, res) => {
  try {
    const { patientId } = req.params;
    const notesResult = await pool.query(
      `SELECT n.*, u.name AS nurse_name 
       FROM notes n 
       LEFT JOIN users u ON n.staff_id = u.id 
       WHERE patient_id = $1 
       ORDER BY created_at DESC`,
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

    if (!note_text.trim()) {
      return res.status(400).json({ error: "Note cannot be empty" });
    }

    const newNote = await pool.query(
      `INSERT INTO notes (patient_id, staff_id, note_text) 
       VALUES ($1, $2, $3) RETURNING *`,
      [patientId, staff_id, note_text]
    );

    res.status(201).json(newNote.rows[0]);
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

    if (!note_text.trim()) {
      return res.status(400).json({ error: "Note cannot be empty" });
    }

    const updatedNote = await pool.query(
      `UPDATE notes 
       SET note_text = $1, created_at = NOW() 
       WHERE id = $2 RETURNING *`,
      [note_text, noteId]
    );

    if (updatedNote.rows.length === 0) {
      return res.status(404).json({ error: "Note not found" });
    }

    res.status(200).json(updatedNote.rows[0]);
  } catch (err) {
    console.error("❌ Error updating note:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { getPatientNotes, addPatientNote, updatePatientNote };
