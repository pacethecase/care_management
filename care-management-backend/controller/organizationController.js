const pool = require("../models/db");

const requireGlobalAdmin = (req, res) => {
  if (!req.user?.has_global_access) {
    res.status(403).json({ error: "Global admin access required." });
    return false;
  }
  return true;
};


const createOrganization = async (req, res) => {
  if (!requireGlobalAdmin(req, res)) return;

  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Organization name is required." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO organizations (name)
       VALUES ($1)
       RETURNING id, name, created_at`,
      [name]
    );

    res.status(201).json({
      message: "Organization created successfully",
      organization: result.rows[0],
    });
  } catch (err) {
    console.error("Error creating organization:", err);
    res.status(500).json({ error: "Failed to create organization" });
  }
};


const getOrganizations = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.id, o.name, o.created_at,
        (
          SELECT COUNT(*) FROM hospitals h WHERE h.organization_id = o.id
        ) AS hospital_count
      FROM organizations o
      ORDER BY o.created_at DESC
    `);

    res.json({ organizations: rows });
  } catch (err) {
    console.error("Error fetching organizations:", err);
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
};


const getOrganizationById = async (req, res) => {
  if (!requireGlobalAdmin(req, res)) return;

  try {
    const orgId = req.params.id;

    const org = await pool.query(
      `SELECT id, name, created_at FROM organizations WHERE id = $1`,
      [orgId]
    );

    if (org.rowCount === 0) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const hospitals = await pool.query(
      `SELECT id, name, daily_room_cost, created_at
       FROM hospitals
       WHERE organization_id = $1`,
      [orgId]
    );

    res.json({
      organization: org.rows[0],
      hospitals: hospitals.rows,
    });
  } catch (err) {
    console.error("Error fetching organization:", err);
    res.status(500).json({ error: "Failed to fetch organization" });
  }
};


const updateOrganization = async (req, res) => {
  if (!requireGlobalAdmin(req, res)) return;

  const orgId = req.params.id;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Organization name is required" });
  }

  try {
    const result = await pool.query(
      `
      UPDATE organizations
      SET name = $1
      WHERE id = $2
      RETURNING id, name, created_at
      `,
      [name, orgId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Organization not found" });
    }

    res.json({
      message: "Organization updated successfully",
      organization: result.rows[0],
    });
  } catch (err) {
    console.error("Error updating organization:", err);
    res.status(500).json({ error: "Failed to update organization" });
  }
};


const deleteOrganization = async (req, res) => {
  if (!requireGlobalAdmin(req, res)) return;

  const orgId = req.params.id;

  try {
    const hospitalCheck = await pool.query(
      `SELECT COUNT(*) FROM hospitals WHERE organization_id = $1`,
      [orgId]
    );

    if (parseInt(hospitalCheck.rows[0].count) > 0) {
      return res.status(400).json({
        error:
          "Cannot delete organization because hospitals exist under it. Remove or reassign hospitals first.",
      });
    }

    // Safe to delete
    const result = await pool.query(
      `DELETE FROM organizations WHERE id = $1 RETURNING *`,
      [orgId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Organization not found" });
    }

    res.json({
      message: "Organization deleted successfully",
      organization: result.rows[0],
    });
  } catch (err) {
    console.error("Error deleting organization:", err);
    res.status(500).json({ error: "Failed to delete organization" });
  }
};

const assignHospitalToOrganization = async (req, res) => {
  if (!requireGlobalAdmin(req, res)) return;

  const { organization_id, hospital_id } = req.body;

  if (!organization_id || !hospital_id) {
    return res.status(400).json({ error: "organization_id and hospital_id are required" });
  }

  try {
    await pool.query("BEGIN");

    // 1. Check if org exists
    const org = await pool.query(
      `SELECT id FROM organizations WHERE id = $1`,
      [organization_id]
    );
    if (org.rowCount === 0) {
      await pool.query("ROLLBACK");
      return res.status(404).json({ error: "Organization not found" });
    }

    // 2. Check if hospital exists
    const hospital = await pool.query(
      `SELECT id FROM hospitals WHERE id = $1`,
      [hospital_id]
    );
    if (hospital.rowCount === 0) {
      await pool.query("ROLLBACK");
      return res.status(404).json({ error: "Hospital not found" });
    }

    // 3. Assign hospital → organization
    await pool.query(
      `UPDATE hospitals
       SET organization_id = $1
       WHERE id = $2`,
      [organization_id, hospital_id]
    );

    // 4. Assign all users in this hospital → organization
    await pool.query(
      `UPDATE users
       SET organization_id = $1
       WHERE hospital_id = $2`,
      [organization_id, hospital_id]
    );

    await pool.query("COMMIT");

    res.json({ message: "Hospital and users assigned to organization successfully" });

  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Error assigning hospital:", err);
    res.status(500).json({ error: "Failed to assign hospital" });
  }
};


const removeHospitalFromOrganization = async (req, res) => {
  if (!requireGlobalAdmin(req, res)) return;

  const { hospital_id } = req.params;

  try {
    await pool.query("BEGIN");

    // 1. Remove hospital from org
    const result = await pool.query(
      `UPDATE hospitals
       SET organization_id = NULL
       WHERE id = $1
       RETURNING *`,
      [hospital_id]
    );

    if (result.rowCount === 0) {
      await pool.query("ROLLBACK");
      return res.status(404).json({ error: "Hospital not found" });
    }

    // 2. Unassign all users in that hospital
    await pool.query(
      `UPDATE users
       SET organization_id = NULL
       WHERE hospital_id = $1`,
      [hospital_id]
    );

    await pool.query("COMMIT");

    res.json({
      message: "Hospital removed from organization and users unlinked",
      hospital: result.rows[0],
    });

  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Error removing hospital:", err);
    res.status(500).json({ error: "Failed to remove hospital" });
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
