const pool = require("../models/db");

const getHospitals = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name FROM hospitals ORDER BY name");
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching hospitals:", error);
    res.status(500).json({ error: "Failed to load hospitals" });
  }
};


module.exports = {
  getHospitals,

};
