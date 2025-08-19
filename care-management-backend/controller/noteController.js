const pool = require("../models/db");


const getPatientNotes = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { hospital_id,is_approved } = req.user;
    if (!is_approved) {
          return res.status(403).json({ error: "Access denied. User not approved." });
        }

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



const addPatientNote = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { staff_id, note_text } = req.body;
    const { hospital_id,is_approved } = req.user;

    if (!is_approved) {
      return res.status(403).json({ error: "Access denied. User not approved." });
    }
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
     nurse_name: name,
    });
  } catch (err) {
    console.error("❌ Error adding note:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


const updatePatientNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const { note_text } = req.body;
    const { hospital_id, is_approved, id: userId } = req.user;

    if (!is_approved) {
      return res.status(403).json({ error: "Access denied. User not approved." });
    }

    if (!note_text?.trim()) {
      return res.status(400).json({ error: "Note cannot be empty" });
    }

    // Ensure note belongs to the same hospital
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

    const updatedNoteRes = await pool.query(
      `UPDATE notes 
       SET note_text = $1, staff_id = $3
       WHERE id = $2
       RETURNING id, patient_id, staff_id, note_text, created_at`,
      [note_text, noteId, userId]
    );

    const updatedNote = updatedNoteRes.rows[0];

    // Fetch staff name for response
    const nurseRes = await pool.query(`SELECT name FROM users WHERE id = $1`, [
      updatedNote.staff_id,
    ]);
    const nurse_name = nurseRes.rows[0]?.name || null;

    res.status(200).json({
      ...updatedNote,
      nurse_name,
    });
  } catch (err) {
    console.error("❌ Error updating note:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};



const deletePatientNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const {
      hospital_id,
      is_approved,
      id: userId,
      has_global_access,
      role,
    } = req.user;

    if (!is_approved) {
      return res.status(403).json({ error: "Access denied. User not approved." });
    }

    const noteRes = await pool.query(
      `
      SELECT n.id, n.staff_id, n.patient_id, p.hospital_id AS patient_hospital_id
      FROM notes n
      JOIN patients p ON p.id = n.patient_id
      WHERE n.id = $1
      `,
      [noteId]
    );

    if (noteRes.rowCount === 0) {
      return res.status(404).json({ error: "Note not found" });
    }

    const note = noteRes.rows[0];

    if (note.patient_hospital_id !== hospital_id) {
      return res.status(403).json({ error: "Unauthorized to delete this note" });
    }

    const isAuthor = note.staff_id === userId;
    const isAdmin = role === "admin";
    if (!isAuthor && !has_global_access && !isAdmin) {
      return res.status(403).json({ error: "Only the author or admin can delete this note" });
    }


    await pool.query(`DELETE FROM notes WHERE id = $1`, [noteId]);

    return res.status(200).json({ success: true, deletedId: Number(noteId) });
  } catch (err) {
    console.error("❌ Error deleting note:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { getPatientNotes, addPatientNote, updatePatientNote ,deletePatientNote};
