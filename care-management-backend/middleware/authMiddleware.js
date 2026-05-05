// middleware/authMiddleware.js
const jwt     = require('jsonwebtoken');
const pool    = require('../models/db');
const JWT_SECRET = process.env.JWT_SECRET;
const ADMINISTRATION_ALLOWED_PATHS = [
  '/auth',
  '/hospitals',
  '/admin',
  '/organizations',
  '/users',
  '/public',
];


// ─── VERIFY TOKEN ─────────────────────────────────────────────────────────────
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token)
    return res.status(401).json({ error: "Access denied. No token." });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded.is_approved)
      return res.status(403).json({ error: "Your account is pending approval." });

     if (decoded.role === 'administration') {
      const allowed = ADMINISTRATION_ALLOWED_PATHS.some(path => 
        req.path.startsWith(path) || req.originalUrl.startsWith(path)
      );
      if (!allowed)
        return res.status(403).json({ 
          error: "Access denied: administration role cannot access this resource." 
        });
      req.user = decoded;
      return next();
    }

    // FIX: check role string instead of boolean flags
    if (decoded.role === 'super_admin') {
      if (!decoded.organization_id)
        return res.status(403).json({ error: "Super admin missing organization context." });
      req.user = decoded;
      return next();
    }

    // Global access is a flag on super_admin — handled above.
    // For admin and staff, hospital_id is required.
    if (decoded.role === 'admin' || decoded.role === 'staff') {
      if (!decoded.hospital_id)
        return res.status(403).json({ error: "Token missing hospital context." });
    }

    req.user = decoded;
    return next();

  } catch (err) {
    console.error("JWT verification failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};

// ─── REQUIRE ADMIN ────────────────────────────────────────────────────────────
// FIX: check role string
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin')
    return res.status(403).json({ error: "Admin access required." });
  next();
};

// ─── REQUIRE STAFF ────────────────────────────────────────────────────────────
// FIX: check role string
const requireStaff = (req, res, next) => {
  if (req.user?.role !== 'staff')
    return res.status(403).json({ error: "Staff access required." });
  next();
};

// ─── REQUIRE EDIT ACCESS ──────────────────────────────────────────────────────
// Checks that the user has 'edit' access_level on the patient.
// Admins and super_admins always bypass — only staff are restricted.
// FIX: role checks use role string
const requireEditAccess = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user?.is_approved)
      return res.status(403).json({ error: "Access denied: user not approved." });

    // Admins and super_admins always have edit access
    if (user.role === 'admin' || user.role === 'super_admin')
      return next();

    // Staff — check access_level on patient_staff
    let patientId = req.params.patientId || req.params.id || null;
    const taskId  = req.params.taskId || null;

    // If route is task-based, resolve patientId from patient_tasks
    if (!patientId && taskId) {
      const { rows } = await pool.query(
        `SELECT patient_id FROM patient_tasks WHERE id = $1`,
        [taskId]
      );
      if (!rows.length)
        return res.status(404).json({ error: "Task not found." });
      patientId = rows[0].patient_id;
    }

    if (!patientId)
      return res.status(400).json({ error: "Missing patient ID or task ID." });

    const { rows: accessRows } = await pool.query(
      `SELECT access_level FROM patient_staff WHERE patient_id = $1 AND staff_id = $2`,
      [patientId, user.id]
    );
    console.log(accessRows)

    if (!accessRows.length)
      return res.status(403).json({ error: "Access denied: not assigned to this patient." });

    if (accessRows[0].access_level !== 'edit')
      return res.status(403).json({ error: "Access denied: view-only access." });

    req.patientId = patientId;
    return next();

  } catch (err) {
    console.error("requireEditAccess error:", err);
    return res.status(500).json({ error: "Internal server error validating access." });
  }
};

// ─── BLOCK NON-CLINICAL USERS ─────────────────────────────────────────────────
// Prevents super_admins from operating on patient tasks.
// FIX: role check uses role string
const blockNonClinicalUsers = (req, res, next) => {
  if (req.user?.role === 'super_admin')
    return res.status(403).json({
      error: "Access denied: org-level role cannot operate on patient tasks.",
    });
  next();
};

module.exports = {
  verifyToken,
  requireAdmin,
  requireStaff,
  requireEditAccess,
  blockNonClinicalUsers,
};