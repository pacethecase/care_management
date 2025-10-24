const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
const pool = require("../models/db");

// ✅ Token Verification Middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) return res.status(401).json({ error: "Access denied. No token." });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded.is_approved) {
      return res.status(403).json({ error: "Your account is pending approval." });
    }

    if (!decoded.hospital_id) {
      return res.status(403).json({ error: "Token missing hospital context." });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT verification failed:", err);
    res.status(401).json({ error: "Invalid token." });
  }
};


// 🔒 Role-Based Guards
const requireAdmin = (req, res, next) => {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

const requireStaff = (req, res, next) => {
  if (!req.user?.is_staff) {
    return res.status(403).json({ error: "Staff access required" });
  }
  next();
};


const requireEditAccess = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user?.is_approved) {
      return res.status(403).json({ error: "Access denied: user not approved." });
    }

    // Admins/super_admins always bypass
    if (user.is_admin || user.is_super_admin) {
      return next();
    }

    let patientId = req.params.patientId;
    const taskId = req.params.taskId || req.params.id;

    // 🧠 If route is task-based, find patientId via patient_tasks
    if (!patientId && taskId) {
      const { rows } = await pool.query(
        `SELECT patient_id FROM patient_tasks WHERE id = $1`,
        [taskId]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "Task not found." });
      }
      patientId = rows[0].patient_id;
    }

    if (!patientId) {
      return res.status(400).json({ error: "Missing patient ID or task ID." });
    }

    // 🔍 Verify the user’s access level for this patient
    const { rows: accessRows } = await pool.query(
      `SELECT access_level FROM patient_staff WHERE patient_id = $1 AND staff_id = $2`,
      [patientId, user.id]
    );

    if (accessRows.length === 0) {
      return res.status(403).json({ error: "Access denied: not assigned to this patient." });
    }

    if (accessRows[0].access_level !== "edit") {
      return res.status(403).json({ error: "Access denied: view-only staff cannot modify this patient." });
    }

    req.patientId = patientId;
    next();
  } catch (err) {
    console.error("❌ requireEditAccess error:", err);
    res.status(500).json({ error: "Internal server error validating access." });
  }
};



module.exports = {
  verifyToken,
  requireAdmin,
  requireStaff,
  requireEditAccess,
};
