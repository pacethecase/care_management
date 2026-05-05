// controller/organizationController.js
const pool = require("../models/db");
const { DateTime } = require("luxon");


const requireGlobalAdmin = (req, res) => {
  if (req.user?.role !== 'administration' || !req.user?.has_global_access) {
    res.status(403).json({ error: "Global admin access required." });
    return false;
  }
  return true;
};

// ─── Helper: validate IANA timezone ──────────────────────────────────────────
const isValidTimezone = (tz) => tz && DateTime.now().setZone(tz).isValid;

// ─── CREATE ORGANIZATION ──────────────────────────────────────────────────────
const createOrganization = async (req, res) => {
  if (!requireGlobalAdmin(req, res)) return;

  const { name, timezone } = req.body;

  if (!name?.trim())
    return res.status(400).json({ error: "Organization name is required." });
  if (!timezone)
    return res.status(400).json({ error: "Timezone is required." });
  if (!isValidTimezone(timezone))
    return res.status(400).json({ error: "Invalid IANA timezone string." });

  try {
    const { rows } = await pool.query(
      `INSERT INTO organizations (name, timezone)
       VALUES ($1, $2)
       RETURNING id, name, timezone, created_at`,
      [name.trim(), timezone]
    );

    return res.status(201).json({
      message: "Organization created successfully",
      organization: rows[0],
    });
  } catch (err) {
    console.error("Error creating organization:", err);
    return res.status(500).json({ error: "Failed to create organization" });
  }
};

// ─── GET ALL ORGANIZATIONS ────────────────────────────────────────────────────
// FIX: no global admin gate — super_admins need to see their own org too,
// and the frontend org selector needs this. Scope by role instead.
const getOrganizations = async (req, res) => {
  const { role, organization_id, has_global_access } = req.user;

  try {
    let query;
    let params = [];

    if (role === 'administration' && has_global_access) {
      // Global admin sees all orgs
      query = `
        SELECT o.id, o.name, o.timezone, o.created_at,
          (SELECT COUNT(*) FROM hospitals h WHERE h.organization_id = o.id) AS hospital_count
        FROM organizations o
        ORDER BY o.created_at DESC
      `;
    } else {
      // Org-level super admin sees only their org
      query = `
        SELECT o.id, o.name, o.timezone, o.created_at,
          (SELECT COUNT(*) FROM hospitals h WHERE h.organization_id = o.id) AS hospital_count
        FROM organizations o
        WHERE o.id = $1
        ORDER BY o.created_at DESC
      `;
      params = [organization_id];
    }

    const { rows } = await pool.query(query, params);
    return res.json({ organizations: rows });

  } catch (err) {
    console.error("Error fetching organizations:", err);
    return res.status(500).json({ error: "Failed to fetch organizations" });
  }
};

// ─── GET ORGANIZATION BY ID ───────────────────────────────────────────────────
const getOrganizationById = async (req, res) => {
  if (!requireGlobalAdmin(req, res)) return;

  const orgId = req.params.id;

  try {
    const { rows: orgRows } = await pool.query(
      `SELECT id, name, timezone, created_at FROM organizations WHERE id = $1`,
      [orgId]
    );
    if (!orgRows.length)
      return res.status(404).json({ error: "Organization not found" });

    const { rows: hospitalRows } = await pool.query(
      `SELECT id, name, daily_room_cost, timezone, created_at
       FROM hospitals WHERE organization_id = $1`,
      [orgId]
    );

    return res.json({ organization: orgRows[0], hospitals: hospitalRows });

  } catch (err) {
    console.error("Error fetching organization:", err);
    return res.status(500).json({ error: "Failed to fetch organization" });
  }
};

// ─── UPDATE ORGANIZATION ──────────────────────────────────────────────────────
const updateOrganization = async (req, res) => {
  if (!requireGlobalAdmin(req, res)) return;

  const orgId = req.params.id;
  const { name, timezone } = req.body;

  if (!name?.trim())
    return res.status(400).json({ error: "Organization name is required." });
  if (timezone && !isValidTimezone(timezone))
    return res.status(400).json({ error: "Invalid IANA timezone string." });

  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE organizations
       SET name = $1, timezone = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, timezone, created_at, updated_at`,
      [name.trim(), timezone, orgId]
    );

    if (rowCount === 0)
      return res.status(404).json({ error: "Organization not found" });

  
    return res.json({
      message: "Organization updated successfully",
      organization: rows[0],
    });
  } catch (err) {
    console.error("Error updating organization:", err);
    return res.status(500).json({ error: "Failed to update organization" });
  }
};

// ─── DELETE ORGANIZATION ──────────────────────────────────────────────────────
const deleteOrganization = async (req, res) => {
  if (!requireGlobalAdmin(req, res)) return;

  const orgId = req.params.id;

  try {
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM hospitals WHERE organization_id = $1`,
      [orgId]
    );

    if (parseInt(countRows[0].count) > 0) {
      return res.status(400).json({
        error: "Cannot delete organization while hospitals exist under it. Remove or reassign hospitals first.",
      });
    }

    const { rows, rowCount } = await pool.query(
      `DELETE FROM organizations WHERE id = $1 RETURNING id, name`,
      [orgId]
    );

    if (rowCount === 0)
      return res.status(404).json({ error: "Organization not found" });

    return res.json({
      message: "Organization deleted successfully",
      organization: rows[0],
    });
  } catch (err) {
    console.error("Error deleting organization:", err);
    return res.status(500).json({ error: "Failed to delete organization" });
  }
};

// ─── ASSIGN HOSPITAL TO ORGANIZATION ─────────────────────────────────────────
const assignHospitalToOrganization = async (req, res) => {
  if (!requireGlobalAdmin(req, res)) return;

  const { organization_id, hospital_id } = req.body;

  if (!organization_id || !hospital_id)
    return res.status(400).json({ error: "organization_id and hospital_id are required." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: orgRows } = await client.query(
      `SELECT id, timezone FROM organizations WHERE id = $1`,
      [organization_id]
    );
    if (!orgRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Organization not found" });
    }

    const { rows: hospRows } = await client.query(
      `SELECT id FROM hospitals WHERE id = $1`,
      [hospital_id]
    );
    if (!hospRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Hospital not found" });
    }


    await client.query(
      `UPDATE hospitals SET organization_id = $1 WHERE id = $2`,
      [organization_id, hospital_id]
    );


    await client.query(
      `UPDATE users SET organization_id = $1 WHERE hospital_id = $2`,
      [organization_id, hospital_id]
    );

    await client.query("COMMIT");
    return res.json({ message: "Hospital assigned to organization successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error assigning hospital:", err);
    return res.status(500).json({ error: "Failed to assign hospital" });
  } finally {
    client.release();
  }
};

// ─── REMOVE HOSPITAL FROM ORGANIZATION ───────────────────────────────────────
const removeHospitalFromOrganization = async (req, res) => {
  if (!requireGlobalAdmin(req, res)) return;

  const { hospital_id } = req.params;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows, rowCount } = await client.query(
      `UPDATE hospitals SET organization_id = NULL WHERE id = $1 RETURNING id, name`,
      [hospital_id]
    );

    if (rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Hospital not found" });
    }

    await client.query(
      `UPDATE users SET organization_id = NULL WHERE hospital_id = $1`,
      [hospital_id]
    );

    await client.query("COMMIT");
    return res.json({
      message: "Hospital removed from organization and users unlinked",
      hospital: rows[0],
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error removing hospital:", err);
    return res.status(500).json({ error: "Failed to remove hospital" });
  } finally {
    client.release();  
  }                   
};                   

module.exports = {
  createOrganization,
  getOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
  assignHospitalToOrganization,
  removeHospitalFromOrganization,
};