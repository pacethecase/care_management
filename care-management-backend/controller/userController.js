const pool = require("../models/db");
const bcrypt = require("bcryptjs");
const { DateTime } = require("luxon");

const getAllUsers = async (req, res) => {
  const {
    id: currentUserId,
    has_global_access,
    is_super_admin,
    organization_id,
    hospital_id
  } = req.user;

  const filterHospitalId = req.query.hospitalId; // optional filter

  try {
    let query;
    let params = [];

    // SUPER ADMIN — GLOBAL ACCESS
    if (has_global_access) {
      if (filterHospitalId) {
        query = `
          SELECT id, name, email, is_admin, is_staff, is_super_admin, is_approved, hospital_id, organization_id
          FROM users
          WHERE hospital_id = $1 AND id != $2
          ORDER BY created_at DESC
        `;
        params = [filterHospitalId, currentUserId];
      } else {
        query = `
          SELECT id, name, email, is_admin, is_staff, is_super_admin, is_approved, hospital_id, organization_id
          FROM users
          WHERE id != $1
          ORDER BY created_at DESC
        `;
        params = [currentUserId];
      }
    }

    // SUPER ADMIN — ORG ONLY
    else if (is_super_admin) {
      if (filterHospitalId) {
        query = `
          SELECT id, name, email, is_admin, is_staff, is_super_admin, is_approved, hospital_id, organization_id
          FROM users
          WHERE organization_id = $1 AND hospital_id = $2
          ORDER BY created_at DESC
        `;
        params = [organization_id, filterHospitalId];
      } else {
        query = `
          SELECT id, name, email, is_admin, is_staff, is_super_admin, is_approved, hospital_id, organization_id
          FROM users
          WHERE organization_id = $1
          ORDER BY created_at DESC
        `;
        params = [organization_id];
      }
    }

    // ADMIN — HOSPITAL ONLY
    else {
      query = `
        SELECT id, name, email, is_admin, is_staff, is_super_admin, is_approved, hospital_id, organization_id
        FROM users
        WHERE hospital_id = $1
        ORDER BY created_at DESC
      `;
      params = [hospital_id];
    }

    const { rows } = await pool.query(query, params);
    res.status(200).json(rows);
  } catch (err) {
    console.error("❌ Error fetching all users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};


const getAdmins = async (req, res) => {
  const {
    has_global_access,
    is_super_admin,
    is_admin,
    organization_id,
    hospital_id
  } = req.user;

  const filterHospitalId = req.query.hospitalId;

  try {
    let query;
    let params = [];

    // GLOBAL ACCESS
    if (has_global_access) {
      if (filterHospitalId) {
        query = `
          SELECT id, name, email
          FROM users
          WHERE is_admin = TRUE
            AND is_verified = TRUE
            AND is_approved = TRUE
            AND hospital_id = $1
          ORDER BY name ASC
        `;
        params = [filterHospitalId];
      } else {
        query = `
          SELECT id, name, email
          FROM users
          WHERE is_admin = TRUE
            AND is_verified = TRUE
            AND is_approved = TRUE
          ORDER BY name ASC
        `;
      }
    }

    // ORG SUPER ADMIN
    else if (is_super_admin) {
      if (filterHospitalId) {
        query = `
          SELECT id, name, email
          FROM users
          WHERE is_admin = TRUE
            AND is_verified = TRUE
            AND is_approved = TRUE
            AND organization_id = $1
            AND hospital_id = $2
          ORDER BY name ASC
        `;
        params = [organization_id, filterHospitalId];
      } else {
        query = `
          SELECT id, name, email
          FROM users
          WHERE is_admin = TRUE
            AND is_verified = TRUE
            AND is_approved = TRUE
            AND organization_id = $1
          ORDER BY name ASC
        `;
        params = [organization_id];
      }
    }

    // LOCAL ADMIN
    else if (is_admin) {
      query = `
        SELECT id, name, email
        FROM users
        WHERE is_admin = TRUE
          AND is_verified = TRUE
          AND is_approved = TRUE
          AND hospital_id = $1
        ORDER BY name ASC
      `;
      params = [hospital_id];
    }

    else return res.status(403).json({ error: "Access denied" });

    const { rows } = await pool.query(query, params);
    res.status(200).json(rows);
  } catch (err) {
    console.error("❌ Error fetching admins:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};


const getStaffs = async (req, res) => {
  const {
    id: currentUserId,
    has_global_access,
    is_super_admin,
    is_admin,
    is_staff,
    organization_id,
    hospital_id
  } = req.user;

  const filterHospitalId = req.query.hospitalId;

  try {
    let query;
    let params = [];

    // GLOBAL ACCESS
    if (has_global_access) {
      if (filterHospitalId) {
        query = `
          SELECT id, name, email, hospital_id
          FROM users
          WHERE is_staff = TRUE
            AND is_verified = TRUE
            AND is_approved = TRUE
            AND hospital_id = $1
          ORDER BY name ASC
        `;
        params = [filterHospitalId];
      } else {
        query = `
          SELECT id, name, email, hospital_id
          FROM users
          WHERE is_staff = TRUE
            AND is_verified = TRUE
            AND is_approved = TRUE
            AND id != $1
          ORDER BY name ASC
        `;
        params = [currentUserId];
      }
    }

    // ORG SUPER ADMIN
    else if (is_super_admin) {
      if (filterHospitalId) {
        query = `
          SELECT id, name, email, hospital_id
          FROM users
          WHERE is_staff = TRUE
            AND is_verified = TRUE
            AND is_approved = TRUE
            AND organization_id = $1
            AND hospital_id = $2
          ORDER BY name ASC
        `;
        params = [organization_id, filterHospitalId];
      } else {
        query = `
          SELECT id, name, email, hospital_id
          FROM users
          WHERE is_staff = TRUE
            AND is_verified = TRUE
            AND is_approved = TRUE
            AND organization_id = $1
          ORDER BY name ASC
        `;
        params = [organization_id];
      }
    }

    // LOCAL ADMIN
    else if (is_admin || is_staff) {
      query = `
        SELECT id, name, email, hospital_id
        FROM users
        WHERE is_staff = TRUE
          AND is_verified = TRUE
          AND is_approved = TRUE
          AND hospital_id = $1
        ORDER BY name ASC
      `;
      params = [hospital_id];
    }
    else return res.status(403).json({ error: "Access denied" });

    const { rows } = await pool.query(query, params);
    res.status(200).json(rows);
  } catch (err) {
    console.error("❌ Error fetching staff:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};


const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, password } = req.body;
   const { hospital_id } = req.user;
     const { rowCount } = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND hospital_id = $2`,
      [id, hospital_id]
    );
    if (rowCount === 0) {
      return res.status(403).json({ error: "Unauthorized or user not in your hospital" });
    }

    let query = `UPDATE users SET name = $1`;
    const values = [name];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `, password = $2`;
      values.push(hashedPassword);
    }

    query += ` WHERE id = $${values.length + 1} RETURNING id, name, email, is_admin, is_staff, is_verified`;
    values.push(id);

    const result = await pool.query(query, values);
    res.status(200).json({ message: "User updated", user: result.rows[0] });
  } catch (err) {
    console.error("❌ Error updating user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getStaffStarRating = async (req, res) => {
  const staffId = parseInt(req.params.id, 10);

  if (isNaN(staffId)) {
    return res.status(400).json({ error: "Invalid staff ID" });
  }

  const {
    has_global_access,
    is_super_admin,
    is_admin,
    organization_id,
    hospital_id
  } = req.user;

  const now = DateTime.local().setZone("America/New_York");
  const past30Days = now.minus({ days: 30 }).toUTC().toISO();
  const today = now.endOf("day").toUTC().toISO();

  try {
    // Base query – no restrictions yet
    let query = `
      SELECT pt.status, pt.due_date, pt.completed_at, p.hospital_id
      FROM patient_tasks pt
      JOIN patient_staff ps ON pt.patient_id = ps.patient_id
      JOIN patients p ON pt.patient_id = p.id
      WHERE ps.staff_id = $1
        AND pt.due_date >= $2
        AND pt.due_date <= $3
    `;

    const params = [staffId, past30Days, today];

    // ------------------------------
    // ROLE-BASED FILTERING
    // ------------------------------

    // 1. GLOBAL ADMIN → no hospital/org restriction
    if (has_global_access) {
      // no filters added
    }

    // 2. SUPER ADMIN (ORG-LEVEL) → filter by organization
    else if (is_super_admin) {
      query += ` AND p.hospital_id IN (
        SELECT id FROM hospitals WHERE organization_id = $4
      )`;
      params.push(organization_id);
    }

    // 3. ADMIN → restrict to their hospital
    else if (is_admin) {
      query += ` AND p.hospital_id = $4`;
      params.push(hospital_id);
    }

    // 4. STAFF → restrict to their hospital
    else {
      query += ` AND p.hospital_id = $4`;
      params.push(hospital_id);
    }

    const { rows: tasks } = await pool.query(query, params);

    // Calculate rating
    const total = tasks.length;

    const completedOnTime = tasks.filter(
      (t) =>
        t.status === "Completed" &&
        t.completed_at &&
        new Date(t.completed_at) <= new Date(t.due_date)
    ).length;

    const completionRate = total === 0 ? 0 : (completedOnTime / total) * 100;

    let stars = 0;
    if (completionRate >= 95) stars = 5;
    else if (completionRate >= 85) stars = 4;
    else if (completionRate >= 70) stars = 3;
    else if (completionRate >= 50) stars = 2;
    else if (completionRate > 0) stars = 1;

    return res.json({
      staffId,
      total,
      completedOnTime,
      completionRate,
      stars
    });

  } catch (err) {
    console.error("❌ Error getting star rating:", err);
    return res.status(500).json({ error: "Failed to get rating" });
  }
};


module.exports = {
  getAdmins,
  getStaffs,
  updateUser,
  getAllUsers,
  getStaffStarRating
};