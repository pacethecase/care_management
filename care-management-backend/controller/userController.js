// controller/userController.js
const pool = require("../models/db");
const bcrypt = require("bcryptjs");
const { DateTime } = require("luxon");

// ─── GET ALL USERS ────────────────────────────────────────────────────────────
// FIX: all role checks use req.user.role instead of boolean flags
// FIX: SELECT lists role column, not the 3 boolean columns
const getAllUsers = async (req, res) => {
  const { id: currentUserId, role, organization_id, hospital_id, has_global_access } = req.user;
  const filterHospitalId = req.query.hospitalId || null;

  try {
    let query;
    let params = [];

    if (role === 'administration' && has_global_access) {
      // Global super admin — sees everyone except themselves
      if (filterHospitalId) {
        query = `
          SELECT id, name, email, role, is_approved, is_verified, hospital_id, organization_id
          FROM users
          WHERE hospital_id = $1 AND id != $2
          ORDER BY created_at DESC
        `;
        params = [filterHospitalId, currentUserId];
      } else {
        query = `
          SELECT id, name, email, role, is_approved, is_verified, hospital_id, organization_id
          FROM users
          WHERE id != $1
          ORDER BY created_at DESC
        `;
        params = [currentUserId];
      }

    } else if (role === 'super_admin') {
      // Org-level super admin — scoped to their org
      if (filterHospitalId) {
        query = `
          SELECT id, name, email, role, is_approved, is_verified, hospital_id, organization_id
          FROM users
          WHERE organization_id = $1 AND hospital_id = $2
          ORDER BY created_at DESC
        `;
        params = [organization_id, filterHospitalId];
      } else {
        query = `
          SELECT id, name, email, role, is_approved, is_verified, hospital_id, organization_id
          FROM users
          WHERE organization_id = $1
          ORDER BY created_at DESC
        `;
        params = [organization_id];
      }

    } else if (role === 'admin') {
      // Hospital admin — their hospital only
      query = `
        SELECT id, name, email, role, is_approved, is_verified, hospital_id, organization_id
        FROM users
        WHERE hospital_id = $1
        ORDER BY created_at DESC
      `;
      params = [hospital_id];

    } else {
      // Staff cannot list all users
      return res.status(403).json({ error: "Access denied" });
    }

    const { rows } = await pool.query(query, params);
    return res.status(200).json(rows);

  } catch (err) {
    console.error("Error fetching all users:", err);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
};

const getAdmins = async (req, res) => {
  const { role, organization_id, hospital_id, has_global_access } = req.user;
  const filterHospitalId = req.query.hospitalId || null;

  try {
    let query;
    let params = [];

    if (role === 'administration' && has_global_access) {
      if (filterHospitalId) {
        query = `
          SELECT id, name, email, role, hospital_id, organization_id
          FROM users
          WHERE role = 'admin'
            AND is_verified = TRUE AND is_approved = TRUE
            AND hospital_id = $1
          ORDER BY name ASC
        `;
        params = [filterHospitalId];
      } else {
        query = `
          SELECT id, name, email, role, hospital_id, organization_id
          FROM users
          WHERE role = 'admin'
            AND is_verified = TRUE AND is_approved = TRUE
          ORDER BY name ASC
        `;
      }

    } else if (role === 'super_admin') {
      if (filterHospitalId) {
        query = `
          SELECT id, name, email, role, hospital_id, organization_id
          FROM users
          WHERE role = 'admin'
            AND is_verified = TRUE AND is_approved = TRUE
            AND organization_id = $1 AND hospital_id = $2
          ORDER BY name ASC
        `;
        params = [organization_id, filterHospitalId];
      } else {
        query = `
          SELECT id, name, email, role, hospital_id, organization_id
          FROM users
          WHERE role = 'admin'
            AND is_verified = TRUE AND is_approved = TRUE
            AND organization_id = $1
          ORDER BY name ASC
        `;
        params = [organization_id];
      }

    } else if (role === 'admin') {
      query = `
        SELECT id, name, email, role, hospital_id, organization_id
        FROM users
        WHERE role = 'admin'
          AND is_verified = TRUE AND is_approved = TRUE
          AND hospital_id = $1
        ORDER BY name ASC
      `;
      params = [hospital_id];

    } else {
      return res.status(403).json({ error: "Access denied" });
    }

    const { rows } = await pool.query(query, params);
    return res.status(200).json(rows);

  } catch (err) {
    console.error("Error fetching admins:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── GET STAFF ────────────────────────────────────────────────────────────────
// FIX: WHERE is_staff = TRUE replaced with WHERE role = 'staff'
// FIX: admin and staff both see their hospital's staff — kept same behaviour
const getStaffs = async (req, res) => {
  const { id: currentUserId, role, organization_id, hospital_id, has_global_access } = req.user;
  const filterHospitalId = req.query.hospitalId || null;

  try {
    let query;
    let params = [];

    if (role === 'administration' && has_global_access) {
      if (filterHospitalId) {
        query = `
          SELECT id, name, email, role, hospital_id
          FROM users
          WHERE role = 'staff'
            AND is_verified = TRUE AND is_approved = TRUE
            AND hospital_id = $1
          ORDER BY name ASC
        `;
        params = [filterHospitalId];
      } else {
        query = `
          SELECT id, name, email, role, hospital_id
          FROM users
          WHERE role = 'staff'
            AND is_verified = TRUE AND is_approved = TRUE
            AND id != $1
          ORDER BY name ASC
        `;
        params = [currentUserId];
      }

    } else if (role === 'super_admin') {
      if (filterHospitalId) {
        query = `
          SELECT id, name, email, role, hospital_id
          FROM users
          WHERE role = 'staff'
            AND is_verified = TRUE AND is_approved = TRUE
            AND organization_id = $1 AND hospital_id = $2
          ORDER BY name ASC
        `;
        params = [organization_id, filterHospitalId];
      } else {
        query = `
          SELECT id, name, email, role, hospital_id
          FROM users
          WHERE role = 'staff'
            AND is_verified = TRUE AND is_approved = TRUE
            AND organization_id = $1
          ORDER BY name ASC
        `;
        params = [organization_id];
      }

    } else if (role === 'admin' || role === 'staff') {
      // Both admin and staff can see staff in their hospital
      query = `
        SELECT id, name, email, role, hospital_id
        FROM users
        WHERE role = 'staff'
          AND is_verified = TRUE AND is_approved = TRUE
          AND hospital_id = $1
        ORDER BY name ASC
      `;
      params = [hospital_id];

    } else {
      return res.status(403).json({ error: "Access denied" });
    }

    const { rows } = await pool.query(query, params);
    return res.status(200).json(rows);

  } catch (err) {
    console.error("Error fetching staff:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, password } = req.body;
  const { role, hospital_id, organization_id, has_global_access } = req.user;

  if (!name?.trim())
    return res.status(400).json({ error: "Name is required" });

  try {
    // Verify the target user exists and the caller has scope to edit them
    const { rows: targetRows } = await pool.query(
      `SELECT id, hospital_id, organization_id FROM users WHERE id = $1`,
      [id]
    );
    if (targetRows.length === 0)
      return res.status(404).json({ error: "User not found" });

    const target = targetRows[0];

    const allowed =
      has_global_access ||
      (role === 'super_admin' && target.organization_id === organization_id) ||
      (role === 'admin' && target.hospital_id === hospital_id) ||
      (String(req.user.id) === String(id)); // users can always update themselves

    if (!allowed)
      return res.status(403).json({ error: "Unauthorized" });

    const values = [name.trim()];
    let query = `UPDATE users SET name = $1`;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `, password = $2`;
      values.push(hashedPassword);
    }

    query += ` WHERE id = $${values.length + 1}
               RETURNING id, name, email, role, is_verified, hospital_id, organization_id`;
    values.push(id);

    const result = await pool.query(query, values);
    return res.status(200).json({ message: "User updated", user: result.rows[0] });

  } catch (err) {
    console.error("Error updating user:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const getStaffStarRating = async (req, res) => {
  const staffId = parseInt(req.params.id, 10);
  if (isNaN(staffId))
    return res.status(400).json({ error: "Invalid staff ID" });

  const { role, organization_id, hospital_id, has_global_access } = req.user;


  const now       = DateTime.utc();
  const past30    = now.minus({ days: 30 }).toISO();
  const nowISO    = now.toISO();

  try {
    let query = `
      SELECT
        pt.status,
        pt.due_date,
        pt.completed_at,
        p.hospital_id,
        h.timezone
      FROM patient_tasks pt
      JOIN patient_staff ps ON pt.patient_id = ps.patient_id
      JOIN patients p ON pt.patient_id = p.id
      JOIN hospitals h ON p.hospital_id = h.id
      WHERE ps.staff_id = $1
        AND pt.due_date >= $2
        AND pt.due_date <= $3
    `;

    const params = [staffId, past30, nowISO];

    if (role === 'administration' && has_global_access) {
      // No extra filter — global access
    } else if (role === 'super_admin') {
      query += ` AND p.hospital_id IN (SELECT id FROM hospitals WHERE organization_id = $4)`;
      params.push(organization_id);
    } else {
      // admin or staff — scope to their hospital
      query += ` AND p.hospital_id = $4`;
      params.push(hospital_id);
    }

    const { rows: tasks } = await pool.query(query, params);
    const total = tasks.length;

    const completedOnTime = tasks.filter((t) => {
      if (t.status !== 'Completed' || !t.completed_at) return false;
      return new Date(t.completed_at) <= new Date(t.due_date);
    }).length;

    const completionRate = total === 0 ? 0 : (completedOnTime / total) * 100;

    let stars = 0;
    if      (completionRate >= 95) stars = 5;
    else if (completionRate >= 85) stars = 4;
    else if (completionRate >= 70) stars = 3;
    else if (completionRate >= 50) stars = 2;
    else if (completionRate >  0)  stars = 1;

    return res.json({ staffId, total, completedOnTime, completionRate, stars });

  } catch (err) {
    console.error("Error getting star rating:", err);
    return res.status(500).json({ error: "Failed to get rating" });
  }
};

module.exports = {
  getAllUsers,
  getAdmins,
  getStaffs,
  updateUser,
  getStaffStarRating,
};