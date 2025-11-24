const pool = require("../models/db");

const getPublicHospitals = async (req, res) => {
  try {
    const { organization_id } = req.query;

    let query = `
      SELECT id, name, organization_id 
      FROM hospitals
    `;
    let params = [];

    if (organization_id) {
      query += " WHERE organization_id = $1";
      params = [organization_id];
    }

    query += " ORDER BY name";

    const { rows } = await pool.query(query, params);
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching public hospitals:", err);
    res.status(500).json({ error: "Failed to load hospitals" });
  }
};

const getPublicOrganizations = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name 
      FROM organizations 
      ORDER BY name
    `);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching public organizations:", err);
    res.status(500).json({ error: "Failed to load organizations" });
  }
};

module.exports = {
  getPublicHospitals,
  getPublicOrganizations,
};
