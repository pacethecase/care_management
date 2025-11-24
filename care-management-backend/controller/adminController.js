const pool = require("../models/db");

// ================================================
// GET UNAPPROVED USERS
// ================================================
const getUnapprovedUsers = async (req, res) => {
  const { has_global_access, is_super_admin, is_admin, organization_id, hospital_id } = req.user;

  try {
    let query = "";
    let params = [];

    // 1️⃣ GLOBAL ADMIN → sees all
    if (has_global_access) {
      query = `SELECT * FROM users WHERE is_approved = false`;
    }

    // 2️⃣ SUPER ADMIN → sees users only inside org
    else if (is_super_admin) {
      query = `
        SELECT *
        FROM users
        WHERE is_approved = false
          AND organization_id = $1
      `;
      params = [organization_id];
    }

    // 3️⃣ HOSPITAL ADMIN → sees users only in hospital
    else if (is_admin) {
      query = `
        SELECT *
        FROM users
        WHERE is_approved = false
          AND hospital_id = $1
      `;
      params = [hospital_id];
    }

    const { rows } = await pool.query(query, params);
    return res.json(rows);

  } catch (err) {
    console.error("Error fetching unapproved users:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};


// ================================================
// APPROVE USER
// ================================================
const approveUser = async (req, res) => {
  const { id } = req.params;
  const {
    has_global_access,
    is_super_admin,
    is_admin,
    hospital_id,
    organization_id
  } = req.user;

  try {
    const { rows } = await pool.query(
      `SELECT id, hospital_id, organization_id FROM users WHERE id = $1`,
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    const target = rows[0];

    // 1️⃣ GLOBAL ADMIN → can approve any user
    if (has_global_access) {
      await pool.query(`UPDATE users SET is_approved = true WHERE id = $1`, [id]);
      return res.json({ message: "Approved globally" });
    }

    // 2️⃣ SUPER ADMIN → only approve users in their org
    if (is_super_admin) {
      if (target.organization_id !== organization_id)
        return res.status(403).json({ error: "User not in your organization" });

      await pool.query(`UPDATE users SET is_approved = true WHERE id = $1`, [id]);
      return res.json({ message: "Approved by organization super admin" });
    }

    // 3️⃣ HOSPITAL ADMIN → only approve users in their hospital
    if (is_admin) {
      if (target.hospital_id !== hospital_id)
        return res.status(403).json({ error: "User not in your hospital" });

      await pool.query(`UPDATE users SET is_approved = true WHERE id = $1`, [id]);
      return res.json({ message: "Approved by hospital admin" });
    }

    return res.status(403).json({ error: "Unauthorized" });

  } catch (err) {
    console.error("Approval error:", err);
    return res.status(500).json({ error: "Failed to approve user" });
  }
};


// ================================================
// ADD HOSPITAL (supports independent hospitals)
// ================================================
const addHospital = async (req, res) => {
  const { has_global_access, is_super_admin, organization_id } = req.user;
  const { name, organization_id: bodyOrgId } = req.body;

  if (!name) return res.status(400).json({ error: "Hospital name required" });

  try {
    // 1️⃣ GLOBAL ADMIN: can create hospital anywhere
    if (has_global_access) {
      const result = await pool.query(
        `INSERT INTO hospitals (name, organization_id)
         VALUES ($1, $2)
         RETURNING *`,
        [name, bodyOrgId || null]
      );
      return res.json({ message: "Hospital added globally", hospital: result.rows[0] });
    }

    // 2️⃣ SUPER ADMIN: can create hospital but ONLY INSIDE THEIR ORG
    if (is_super_admin) {
      const result = await pool.query(
        `INSERT INTO hospitals (name, organization_id)
         VALUES ($1, $2)
         RETURNING *`,
        [name, organization_id]
      );
      return res.json({ message: "Hospital added in organization", hospital: result.rows[0] });
    }

    return res.status(403).json({ error: "Not authorized to add hospitals" });

  } catch (err) {
    console.error("Add hospital error:", err);
    return res.status(500).json({ error: "Could not add hospital" });
  }
};


// ================================================
// DELETE HOSPITAL
// ================================================
const deleteHospital = async (req, res) => {
  const { has_global_access, is_super_admin, organization_id } = req.user;
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT organization_id FROM hospitals WHERE id = $1`,
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Hospital not found" });

    const hospitalOrg = rows[0].organization_id;

    // 1️⃣ GLOBAL ADMIN → delete any hospital
    if (has_global_access) {
      await pool.query(`DELETE FROM hospitals WHERE id = $1`, [id]);
      return res.json({ message: "Hospital deleted globally" });
    }

    // 2️⃣ SUPER ADMIN → can delete ONLY hospitals in their org
    if (is_super_admin) {
      if (hospitalOrg !== organization_id)
        return res.status(403).json({ error: "Hospital not in your organization" });

      await pool.query(`DELETE FROM hospitals WHERE id = $1`, [id]);
      return res.json({ message: "Hospital deleted by organization super admin" });
    }

    return res.status(403).json({ error: "Not authorized to delete this hospital" });

  } catch (err) {
    console.error("Delete hospital error:", err);
    return res.status(500).json({ error: "Failed to delete hospital" });
  }
};


// ================================================
// REVOKE USER ACCESS
// ================================================
const revokeUserAccess = async (req, res) => {
  const { id } = req.params;
  const { has_global_access, is_super_admin, is_admin, hospital_id, organization_id } = req.user;

  try {
    const { rows } = await pool.query(
      `SELECT id, hospital_id, organization_id, is_admin FROM users WHERE id = $1`,
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    const target = rows[0];

    // 1️⃣ GLOBAL ADMIN → can revoke anyone
    if (has_global_access) {
      // no restrictions
    }

    // 2️⃣ SUPER ADMIN → can revoke only inside org
    else if (is_super_admin) {
      if (target.organization_id !== organization_id)
        return res.status(403).json({ error: "User not in your organization" });
    }

    // 3️⃣ HOSPITAL ADMIN → can revoke only inside hospital
    else if (is_admin) {
      if (target.hospital_id !== hospital_id)
        return res.status(403).json({ error: "User not in your hospital" });
    }

    else {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // ❌ Cannot revoke admins
    if (target.is_admin) {
      return res.status(400).json({ error: "Cannot revoke an admin" });
    }

    await pool.query(
      `UPDATE users SET is_approved = false WHERE id = $1`,
      [id]
    );

    return res.json({ message: "Access revoked" });

  } catch (err) {
    console.error("Revoke error:", err);
    return res.status(500).json({ error: "Failed to revoke user" });
  }
};


module.exports = {
  getUnapprovedUsers,
  approveUser,
  addHospital,
  deleteHospital,
  revokeUserAccess
};
