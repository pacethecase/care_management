const pool = require("../models/db");
const bcrypt = require("bcryptjs");

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
      `SELECT id, name, email FROM users WHERE is_staff = true AND is_verified = true  AND hospital_id = $1`
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


module.exports = {
  getAdmins,
  getStaffs,
  updateUser,
};