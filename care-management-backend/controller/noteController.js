// controller/noteController.js
const pool = require("../models/db");

// ─── Helper: check patient access based on role ───────────────────────────────
// Returns true if the user has scope to access this patient
const checkPatientAccess = async (patientId, user) => {
  const { role, hospital_id, organization_id, has_global_access } = user;

  if (role === 'administration' && has_global_access) {
    // Global super admin — can access any patient
    const { rowCount } = await pool.query(
      `SELECT 1 FROM patients WHERE id = $1`,
      [patientId]
    );
    return rowCount > 0;
  }

  if (role === 'super_admin') {
    // Org-level super admin — patient must be in their org
    const { rowCount } = await pool.query(
      `SELECT 1 FROM patients p
       JOIN hospitals h ON h.id = p.hospital_id
       WHERE p.id = $1 AND h.organization_id = $2`,
      [patientId, organization_id]
    );
    return rowCount > 0;
  }

  // admin and staff — patient must be in their hospital
  const { rowCount } = await pool.query(
    `SELECT 1 FROM patients WHERE id = $1 AND hospital_id = $2`,
    [patientId, hospital_id]
  );
  return rowCount > 0;
};

// ─── GET PATIENT NOTES ────────────────────────────────────────────────────────
const getPatientNotes = async (req, res) => {
  const { patientId } = req.params;
  const { is_approved } = req.user;

  if (!is_approved)
    return res.status(403).json({ error: "Access denied. User not approved." });

  try {
    const hasAccess = await checkPatientAccess(patientId, req.user);
    if (!hasAccess)
      return res.status(403).json({ error: "Unauthorized access to patient notes" });

    const { rows } = await pool.query(
      `SELECT n.id, n.patient_id, n.staff_id, n.note_text, n.created_at, n.updated_at,
              u.name AS nurse_name
       FROM notes n
       LEFT JOIN users u ON n.staff_id = u.id
       WHERE n.patient_id = $1
       ORDER BY n.created_at DESC`,
      [patientId]
    );

    return res.status(200).json(rows);

  } catch (err) {
    console.error("Error fetching notes:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ─── ADD PATIENT NOTE ─────────────────────────────────────────────────────────
const addPatientNote = async (req, res) => {
  const { patientId } = req.params;
  const { note_text } = req.body;
  const { id: userId, is_approved } = req.user;

  if (!is_approved)
    return res.status(403).json({ error: "Access denied. User not approved." });
  if (!note_text?.trim())
    return res.status(400).json({ error: "Note cannot be empty" });

  try {
    const hasAccess = await checkPatientAccess(patientId, req.user);
    if (!hasAccess)
      return res.status(403).json({ error: "Unauthorized access to patient" });

    // FIX: fetch user name in the same query via JOIN instead of a second round-trip
    const { rows } = await pool.query(
      `WITH inserted AS (
         INSERT INTO notes (patient_id, staff_id, note_text)
         VALUES ($1, $2, $3)
         RETURNING id, patient_id, staff_id, note_text, created_at, updated_at
       )
       SELECT i.*, u.name AS nurse_name
       FROM inserted i
       LEFT JOIN users u ON u.id = i.staff_id`,
      [patientId, userId, note_text.trim()]
    );

    return res.status(201).json(rows[0]);

  } catch (err) {
    console.error("Error adding note:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ─── UPDATE PATIENT NOTE ──────────────────────────────────────────────────────
const updatePatientNote = async (req, res) => {
  const { noteId } = req.params;
  const { note_text } = req.body;
  const { id: userId, role, hospital_id, organization_id, has_global_access, is_approved } = req.user;

  if (!is_approved)
    return res.status(403).json({ error: "Access denied. User not approved." });
  if (!note_text?.trim())
    return res.status(400).json({ error: "Note cannot be empty" });

  try {
    // Fetch note with hospital and org context for scope check
    const { rows: noteRows } = await pool.query(
      `SELECT n.id, n.staff_id, p.hospital_id, h.organization_id
       FROM notes n
       JOIN patients p ON n.patient_id = p.id
       JOIN hospitals h ON h.id = p.hospital_id
       WHERE n.id = $1`,
      [noteId]
    );

    if (!noteRows.length)
      return res.status(404).json({ error: "Note not found" });

    const note = noteRows[0];

    // FIX: scope check using role string
    const inScope =
      (role === 'administration' && has_global_access) ||
      (role === 'super_admin' && note.organization_id === organization_id) ||
      ((role === 'admin' || role === 'staff') && note.hospital_id === hospital_id);

    if (!inScope)
      return res.status(403).json({ error: "Unauthorized to edit this note" });

    // FIX: only the author can edit their own note
    // admins can delete but shouldn't silently overwrite another person's note
    if (note.staff_id !== userId)
      return res.status(403).json({ error: "Only the note author can edit it" });

    const { rows } = await pool.query(
      `UPDATE notes
       SET note_text = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, patient_id, staff_id, note_text, created_at, updated_at`,
      [note_text.trim(), noteId]
    );

    const nurseRes = await pool.query(
      `SELECT name FROM users WHERE id = $1`,
      [rows[0].staff_id]
    );

    return res.status(200).json({
      ...rows[0],
      nurse_name: nurseRes.rows[0]?.name ?? null,
    });

  } catch (err) {
    console.error("Error updating note:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ─── DELETE PATIENT NOTE ──────────────────────────────────────────────────────
const deletePatientNote = async (req, res) => {
  const { noteId } = req.params;
  const { id: userId, role, hospital_id, organization_id, has_global_access, is_approved } = req.user;

  if (!is_approved)
    return res.status(403).json({ error: "Access denied. User not approved." });

  try {
    const { rows: noteRows } = await pool.query(
      `SELECT n.id, n.staff_id, p.hospital_id, h.organization_id
       FROM notes n
       JOIN patients p ON p.id = n.patient_id
       JOIN hospitals h ON h.id = p.hospital_id
       WHERE n.id = $1`,
      [noteId]
    );

    if (!noteRows.length)
      return res.status(404).json({ error: "Note not found" });

    const note = noteRows[0];

    // FIX: scope check using role string
    const inScope =
      (role === 'administration' && has_global_access) ||
      (role === 'super_admin' && note.organization_id === organization_id) ||
      ((role === 'admin' || role === 'staff') && note.hospital_id === hospital_id);

    if (!inScope)
      return res.status(403).json({ error: "Unauthorized (wrong hospital or organization)" });

    // FIX: author OR admin/super_admin can delete
    const isAuthor   = note.staff_id === userId;
    const isElevated = role === 'admin' || role === 'super_admin';

    if (!isAuthor && !isElevated)
      return res.status(403).json({ error: "Only the author or an admin may delete this note" });

    await pool.query(`DELETE FROM notes WHERE id = $1`, [noteId]);
    return res.status(200).json({ success: true, deletedId: Number(noteId) });

  } catch (err) {
    console.error("Error deleting note:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { getPatientNotes, addPatientNote, updatePatientNote, deletePatientNote };