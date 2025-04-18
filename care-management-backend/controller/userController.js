const pool = require("../models/db");
const bcrypt = require("bcrypt");

const getStaffs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email FROM users WHERE is_staff = true AND is_verified = true`
    );
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
  getStaffs,
  updateUser,
};