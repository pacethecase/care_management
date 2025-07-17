const pool = require("../models/db");
const bcrypt = require("bcryptjs");
const { DateTime } = require("luxon");

const getAllUsers = async (req, res) => {
  const { has_global_access, hospital_id, id: currentUserId } = req.user;

  try {
    const query = has_global_access
      ? `SELECT id, name, email, is_admin, is_staff, is_approved, hospital_id 
         FROM users 
         WHERE id != $1 
         ORDER BY created_at DESC`
      : `SELECT id, name, email, is_admin, is_staff, is_approved, hospital_id 
         FROM users 
         WHERE hospital_id = $1 AND id != $2 
         ORDER BY created_at DESC`;

    const params = has_global_access ? [currentUserId] : [hospital_id, currentUserId];

    const { rows } = await pool.query(query, params);
    res.status(200).json(rows);
  } catch (err) {
    console.error("Error fetching all users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};



const getAdmins = async (req, res) => {
   const { hospital_id } = req.user;
  try {
    const result = await pool.query(`
      SELECT id, name FROM users WHERE is_admin = true AND is_verified = true  AND hospital_id = $1
     `, [hospital_id]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching admins:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getStaffs = async (req, res) => {
  const { hospital_id } = req.user;
  try {
    const result = await pool.query(
      `SELECT id, name, email,is_approved FROM users WHERE is_staff = true AND is_verified = true  AND hospital_id = $1`
   , [hospital_id]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching staffs:", err);
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
  const hospitalId = req.user.hospital_id;
  const hasGlobalAccess = req.user.has_global_access;

  if (isNaN(staffId)) return res.status(400).json({ error: "Invalid staff ID" });

  const now = DateTime.local().setZone("America/New_York");
  const past30Days = now.minus({ days: 30 }).toUTC().toISO();
  const today = now.endOf("day").toUTC().toISO();

  try {
    let query = `
      SELECT pt.status, pt.due_date, pt.completed_at
      FROM patient_tasks pt
      JOIN patient_staff ps ON pt.patient_id = ps.patient_id
      JOIN patients p ON pt.patient_id = p.id
      WHERE ps.staff_id = $1
        AND pt.due_date >= $2
         AND pt.due_date <= $3
    `;

    const params = [staffId, past30Days,today];

    if (!hasGlobalAccess) {
      query += ` AND p.hospital_id = $4`;
      params.push(hospitalId);
    }

    const { rows: tasks } = await pool.query(query, params);

    const total = tasks.length;
    const completedOnTime = tasks.filter(
      (t) =>
        t.status === "Completed" &&
        t.completed_at &&
        t.due_date &&
        new Date(t.completed_at) <= new Date(t.due_date)
    ).length;

    const completionRate = total === 0 ? 0 : (completedOnTime / total) * 100;

    let stars = 0;
    if (completionRate >= 95) stars = 5;
    else if (completionRate >= 85) stars = 4;
    else if (completionRate >= 70) stars = 3;
    else if (completionRate >= 50) stars = 2;
    else if (completionRate > 0) stars = 1;

    return res.json({ staffId, total, completedOnTime, completionRate, stars });
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