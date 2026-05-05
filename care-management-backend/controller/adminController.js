// controller/adminController.js
const pool = require("../models/db");
const { DateTime } = require("luxon");
const nodemailer = require('nodemailer');
const emailTemplate = require('../utils/emailTemplate');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});
const isSuperAdmin     = (user) => user.role === "super_admin";
const isAdmin          = (user) => user.role === "admin";
const hasGlobalAccess  = (user) => user.role === "administration" && user.has_global_access;

// ─── GET UNAPPROVED USERS ─────────────────────────────────────────────────────
const getUnapprovedUsers = async (req, res) => {
  const { role, organization_id, hospital_id, has_global_access } = req.user;

  try {
    let query  = "";
    let params = [];

    if (hasGlobalAccess(req.user)) {
      query = `
        SELECT id, name, email, role, hospital_id, organization_id, is_approved, is_verified
        FROM users
        WHERE is_approved = FALSE
        ORDER BY created_at DESC
      `;
    } else if (isSuperAdmin(req.user)) {
      // Org-level super admin — only their org
      query = `
        SELECT id, name, email, role, hospital_id, organization_id, is_approved, is_verified
        FROM users
        WHERE is_approved = FALSE
          AND organization_id = $1
        ORDER BY created_at DESC
      `;
      params = [organization_id];
    } else if (isAdmin(req.user)) {
      // Hospital admin — only their hospital
      query = `
        SELECT id, name, email, role, hospital_id, organization_id, is_approved, is_verified
        FROM users
        WHERE is_approved = FALSE
          AND hospital_id = $1
        ORDER BY created_at DESC
      `;
      params = [hospital_id];
    } else {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { rows } = await pool.query(query, params);
    return res.json(rows);

  } catch (err) {
    console.error("Error fetching unapproved users:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
const approveUser = async (req, res) => {
  const { organization_id, hospital_id } = req.user;
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, name, email, hospital_id, organization_id, role, is_verified 
       FROM users WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found" });
    }

    const target = rows[0];

    if (!target.is_verified) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cannot approve user who has not verified their email yet." });
    }

    if (hasGlobalAccess(req.user)) {
      await client.query(`UPDATE users SET is_approved = TRUE WHERE id = $1`, [id]);
    } else if (isSuperAdmin(req.user)) {
      if (target.organization_id !== organization_id) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "User not in your organization" });
      }
      await client.query(`UPDATE users SET is_approved = TRUE WHERE id = $1`, [id]);
    } else if (isAdmin(req.user)) {
      if (target.hospital_id !== hospital_id) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "User not in your hospital" });
      }
      await client.query(`UPDATE users SET is_approved = TRUE WHERE id = $1`, [id]);
    } else {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Unauthorized" });
    }

    const io = req.app.get("io");

    const { rows: admins } = await client.query(
      `SELECT id FROM users
       WHERE is_approved = TRUE
         AND (
           (role = 'admin'       AND hospital_id     = $1)
           OR
           (role = 'super_admin' AND organization_id = $2)
         )`,
      [target.hospital_id, target.organization_id]
    );

    for (const admin of admins) {
      const { rows: [notif] } = await client.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, 'account_approved') RETURNING *`,
        [admin.id, "User Account Approved", `${target.name} (${target.email}) has been approved.`]
      );
      io?.to?.(`user-${admin.id}`)?.emit("notification", notif);
    }

    await client.query("COMMIT");
    try {
      await transporter.sendMail({
        from: `"Pace The Case" <${process.env.EMAIL_USERNAME}>`,
        to: target.email,
        subject: "Your Account Has Been Approved – Pace The Case",
        html: emailTemplate(
          `<p>Hi <strong>${target.name}</strong>,</p>
           <p>Great news! Your <strong>Pace The Case</strong> account has been
           <strong style="color:#1B3A5C;">approved</strong>.</p>
           <p>You can now sign in and start using the platform.</p>`,
          "Sign In Now",
          `${process.env.FRONTEND_URL}/login`
        ),
      });
    } catch (emailErr) {
      console.error("Approval email failed (non-fatal):", emailErr.message);
    }

    return res.json({ message: "User approved successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Approval error:", err);
    return res.status(500).json({ error: "Failed to approve user" });
  } finally {
    client.release();
  }
};

const revokeUserAccess = async (req, res) => {
  const { organization_id, hospital_id } = req.user;
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, name, email, hospital_id, organization_id, role FROM users WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found" });
    }

    const target = rows[0];

    if (target.role === "super_admin") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cannot revoke a super admin." });
    }

    if (target.role === "admin" && !isSuperAdmin(req.user) && !hasGlobalAccess(req.user)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Only a super admin can revoke an admin." });
    }

    if (hasGlobalAccess(req.user)) {
      // can revoke anyone
    } else if (isSuperAdmin(req.user)) {
      if (target.organization_id !== organization_id) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "User not in your organization." });
      }
    } else if (isAdmin(req.user)) {
      if (target.hospital_id !== hospital_id) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "User not in your hospital." });
      }
    } else {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Unauthorized." });
    }

    if (target.role === "admin") {
      const { rows: patients } = await client.query(
        `SELECT 1 FROM patients WHERE added_by_user_id = $1 AND status = 'Admitted' LIMIT 1`,
        [target.id]
      );
      if (patients.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Cannot revoke this admin — they have active patients assigned. Please reassign patients first."
        });
      }
    }

    if (target.role === "staff") {
      const { rows: assignments } = await client.query(
        `SELECT 1 FROM patient_staff ps
         JOIN patients p ON p.id = ps.patient_id
         WHERE ps.staff_id = $1
           AND p.status = 'Admitted'
           AND p.is_archived = FALSE
         LIMIT 1`,
        [target.id]
      );
      if (assignments.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Cannot revoke this staff member — they have active patients assigned. Please reassign patients first."
        });
      }
    }

    await client.query(`UPDATE users SET is_approved = FALSE WHERE id = $1`, [id]);

    const io = req.app.get("io");

    const { rows: admins } = await client.query(
      `SELECT id FROM users
       WHERE is_approved = TRUE
         AND id != $3
         AND (
           (role = 'admin'       AND hospital_id     = $1)
           OR
           (role = 'super_admin' AND organization_id = $2)
         )`,
      [target.hospital_id, target.organization_id, target.id]
    );

    for (const admin of admins) {
      const { rows: [notif] } = await client.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, 'account_revoked') RETURNING *`,
        [
          admin.id,
          "User Access Revoked",
          `${target.name} (${target.email}) has had their access revoked.`,
        ]
      );
      io?.to?.(`user-${admin.id}`)?.emit("notification", notif);
    }

    await client.query("COMMIT");

    // ── Email to revoked user — best effort after commit ──
    try {
      await transporter.sendMail({
        from: `"Pace The Case" <${process.env.EMAIL_USERNAME}>`,
        to: target.email,
        subject: "Your Account Access Has Been Revoked – Pace The Case",
        html: emailTemplate(
          `<p>Hi <strong>${target.name}</strong>,</p>
           <p>Your <strong>Pace The Case</strong> account access has been
           <strong style="color:#c0392b;">revoked</strong> by an administrator.</p>
           <p>If you believe this is a mistake, please contact your administrator at
           <a href="mailto:${process.env.EMAIL_USERNAME}" style="color:#1B3A5C;">
             ${process.env.EMAIL_USERNAME}
           </a>.</p>`,
          "Visit Pace The Case",
          `${process.env.FRONTEND_URL}`
        ),
      });
    } catch (emailErr) {
      console.error("Revoke email failed (non-fatal):", emailErr.message);
    }
    return res.json({ message: "Access revoked successfully." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Revoke error:", err);
    return res.status(500).json({ error: "Failed to revoke user." });
  } finally {
    client.release();
  }
};
// ─── ADD HOSPITAL ─────────────────────────────────────────────────────────────
const addHospital = async (req, res) => {
  const { organization_id } = req.user;
  const { name, organization_id: bodyOrgId, timezone, daily_room_cost } = req.body;

  if (!name?.trim())
    return res.status(400).json({ error: "Hospital name is required." });

  if (!timezone)
    return res.status(400).json({ error: "Timezone is required." });

  if (!DateTime.now().setZone(timezone).isValid)
    return res.status(400).json({ error: "Invalid timezone. Please provide a valid IANA timezone string." });

  try {
    if (hasGlobalAccess(req.user)) {
      const result = await pool.query(
        `INSERT INTO hospitals (name, timezone, daily_room_cost)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name.trim(), timezone, daily_room_cost ?? 2883.00]
      );
      return res.status(201).json({ message: "Hospital added globally", hospital: result.rows[0] });
    }

    if (isSuperAdmin(req.user)) {
      const result = await pool.query(
        `INSERT INTO hospitals (name, organization_id, timezone, daily_room_cost)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name.trim(), organization_id, timezone, daily_room_cost ?? 2883.00]
      );
      return res.status(201).json({ message: "Hospital added", hospital: result.rows[0] });
    }

    return res.status(403).json({ error: "Not authorized to add hospitals." });

  } catch (err) {
    console.error("Add hospital error:", err);
    return res.status(500).json({ error: "Could not add hospital." });
  }
};

// ─── DELETE HOSPITAL ──────────────────────────────────────────────────────────
const deleteHospital = async (req, res) => {
  const { organization_id } = req.user;
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT organization_id FROM hospitals WHERE id = $1`,
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Hospital not found" });

    const hospitalOrg = rows[0].organization_id;

    if (hasGlobalAccess(req.user)) {
      await pool.query(`DELETE FROM hospitals WHERE id = $1`, [id]);
      return res.json({ message: "Hospital deleted globally" });
    }

    if (isSuperAdmin(req.user)) {
      if (hospitalOrg !== organization_id)
        return res.status(403).json({ error: "Hospital not in your organization" });

      await pool.query(`DELETE FROM hospitals WHERE id = $1`, [id]);
      return res.json({ message: "Hospital deleted" });
    }

    return res.status(403).json({ error: "Not authorized to delete hospitals." });

  } catch (err) {
    console.error("Delete hospital error:", err);
    return res.status(500).json({ error: "Failed to delete hospital." });
  }
};

module.exports = {
  getUnapprovedUsers,
  approveUser,
  revokeUserAccess,
  addHospital,
  deleteHospital,
};