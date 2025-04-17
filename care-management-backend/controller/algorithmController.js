// controller/algorithmController.js
const pool = require('../models/db');

const getPatientCountsByAlgorithm = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 'Behavioral' AS algorithm, COUNT(*) AS count FROM patients WHERE is_behavioral = true AND status != 'Discharged'
      UNION ALL
      SELECT 'Guardianship' AS algorithm, COUNT(*) AS count FROM patients WHERE is_guardianship = true AND status != 'Discharged'
      UNION ALL
      SELECT 'LTC' AS algorithm, COUNT(*) AS count FROM patients WHERE is_ltc = true AND status != 'Discharged'
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching algorithm counts:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getPatientsByAlgorithm = async (req, res) => {
  const { algorithm } = req.params;
  const mapping = {
    Behavioral: 'is_behavioral',
    Guardianship: 'is_guardianship',
    LTC: 'is_ltc',
  };

  const column = mapping[algorithm];
  if (!column) return res.status(400).json({ error: 'Invalid algorithm' });

  try {
    const result = await pool.query(`
      SELECT id, name, birth_date, bed_id,created_at
      FROM patients
      WHERE ${column} = true  AND status != 'Discharged'
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching patients for algorithm:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  getPatientCountsByAlgorithm,
  getPatientsByAlgorithm,
};
