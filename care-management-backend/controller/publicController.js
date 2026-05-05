// controller/publicController.js
const pool = require("../models/db");

// These endpoints are intentionally unauthenticated —
// used on the signup page to populate hospital/org dropdowns
// before a user has a token.
// IMPORTANT: only return id and name — never expose timezone,
// daily_room_cost, or other internal fields to unauthenticated requests.

const getPublicHospitals = async (req, res) => {
  try {
    const { organization_id } = req.query;
    let query  = `SELECT id, name, organization_id FROM hospitals`;
    let params = [];

    if (organization_id) {
      // FIX: validate organization_id is a number before using it
      const orgId = parseInt(organization_id, 10);
      if (isNaN(orgId))
        return res.status(400).json({ error: "Invalid organization_id." });

      query += " WHERE organization_id = $1";
      params = [orgId];
    }

    query += " ORDER BY name";

    const { rows } = await pool.query(query, params);
    return res.json(rows);

  } catch (err) {
    console.error("Error fetching public hospitals:", err);
    return res.status(500).json({ error: "Failed to load hospitals" });
  }
};

const getPublicOrganizations = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name FROM organizations ORDER BY name`
    );
    return res.json(rows);

  } catch (err) {
    console.error("Error fetching public organizations:", err);
    return res.status(500).json({ error: "Failed to load organizations" });
  }
};

module.exports = { getPublicHospitals, getPublicOrganizations };