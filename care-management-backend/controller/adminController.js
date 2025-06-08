// controllers/adminController.js
const pool = require("../models/db");

const getUnapprovedUsers = async (req, res) => {
  const { has_global_access, hospital_id } = req.user;

  try {
    const query = has_global_access
      ? `SELECT id, name, email, is_admin, is_staff, hospital_id FROM users WHERE is_approved = false`
      : `SELECT id, name, email, is_admin, is_staff FROM users WHERE is_approved = false AND hospital_id = $1`;

    const params = has_global_access ? [] : [hospital_id];

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching unapproved users:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const approveUser = async (req, res) => {
  const { id } = req.params;
  const { has_global_access, hospital_id } = req.user;

  try {
    const { rows } = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
    if (!rows.length) return res.status(404).json({ error: "User not found" });

    const targetUser = rows[0];

    // ❌ Local admin trying to approve admin or user from other hospital
    if (!has_global_access) {
      if (targetUser.is_admin || targetUser.hospital_id !== hospital_id) {
        return res.status(403).json({ error: "Unauthorized to approve this user" });
      }
    }

    // ✅ Global admin approving a hospital admin
    const updates = [];
    if (has_global_access && targetUser.is_admin) {
      updates.push(`is_super_admin = true`, `has_global_access = false`);
    }

    const updateQuery = `
      UPDATE users
      SET is_approved = true${updates.length ? `, ${updates.join(", ")}` : ""}
      WHERE id = $1
    `;

    await pool.query(updateQuery, [id]);
    res.json({ message: "User approved successfully." });
  } catch (err) {
    console.error("Approval error:", err);
    res.status(500).json({ error: "Failed to approve user" });
  }
};

const addHospital = async (req, res) => {
  if (!req.user?.has_global_access) {
    return res.status(403).json({ error: "Only global admins can add hospitals." });
  }

  const { name } = req.body;

  if (!name ) {
    return res.status(400).json({ error: "Name is required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO hospitals (name)
       VALUES ($1)
       RETURNING id, name`,
      [name]
    );
    res.status(201).json({ message: "Hospital added", hospital: result.rows[0] });
  } catch (err) {
    console.error("Add hospital error:", err);
    res.status(500).json({ error: "Could not add hospital" });
  }
};

const deleteHospital = async (req, res) => {
  const { id } = req.params;

  if (!req.user?.has_global_access) {
    return res.status(403).json({ error: "Only global admins can delete hospitals." });
  }

  try {
    // Optional: Prevent deletion if users still exist under this hospital
    const userCheck = await pool.query(`SELECT COUNT(*) FROM users WHERE hospital_id = $1`, [id]);
    if (parseInt(userCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: "Cannot delete hospital with existing users." });
    }

    const result = await pool.query(`DELETE FROM hospitals WHERE id = $1 RETURNING *`, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Hospital not found" });
    }

    res.json({ message: "Hospital deleted successfully", hospital: result.rows[0] });
  } catch (err) {
    console.error("Delete hospital error:", err);
    res.status(500).json({ error: "Failed to delete hospital" });
  }
};


const revokeUserAccess = async (req, res) => {
  const userId = parseInt(req.params.id);

  try {
    // ✅ Step 1: Fetch user
    const { rows } = await pool.query(
      "SELECT is_admin, is_staff FROM users WHERE id = $1",
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = rows[0];

    // ⛔ Step 2: Prevent revoking admin access
    if (user.is_admin) {
      return res.status(400).json({ error: "Cannot revoke access for admins at this time." });
    }

    // ⛔ Step 3: Prevent revoking staff with assigned patients
    if (user.is_staff) {
      const { rowCount } = await pool.query(
        "SELECT 1 FROM patient_staff WHERE staff_id = $1 LIMIT 1",
        [userId]
      );

      if (rowCount > 0) {
        return res.status(400).json({
          error: "This staff is assigned to patients. Reassign them before revoking access.",
        });
      }
    }

    // ✅ Step 4: Safe to revoke — now perform the update
    await pool.query(
      "UPDATE users SET is_approved = false WHERE id = $1",
      [userId]
    );

    res.status(200).json({ message: "Access revoked successfully." });
  } catch (err) {
    console.error("Error revoking access:", err);
    res.status(500).json({ error: "Failed to revoke access" });
  }
};




module.exports = {
  getUnapprovedUsers,
  approveUser,
   revokeUserAccess,
  addHospital,
  deleteHospital
};
