const pool = require('../models/db');

const getPatientCountsByAlgorithm = async (req, res) => {
  const { is_admin, id: staffId } = req.user;

  try {
    let query;
    let params = [];

    if (is_admin) {
      query = `
        SELECT 'Behavioral' AS algorithm, COUNT(*) AS count FROM patients WHERE is_behavioral = true AND status != 'Discharged'
        UNION ALL
        SELECT 'Guardianship' AS algorithm, COUNT(*) AS count FROM patients WHERE is_guardianship = true AND status != 'Discharged'
        UNION ALL
        SELECT 'LTC' AS algorithm, COUNT(*) AS count FROM patients WHERE is_ltc = true AND status != 'Discharged'
      `;
    } else {
      query = `
        SELECT 'Behavioral' AS algorithm, COUNT(*) AS count
        FROM patients p
        JOIN patient_staff ps ON p.id = ps.patient_id
        WHERE p.is_behavioral = true AND p.status != 'Discharged' AND ps.staff_id = $1

        UNION ALL

        SELECT 'Guardianship' AS algorithm, COUNT(*) AS count
        FROM patients p
        JOIN patient_staff ps ON p.id = ps.patient_id
        WHERE p.is_guardianship = true AND p.status != 'Discharged' AND ps.staff_id = $1

        UNION ALL

        SELECT 'LTC' AS algorithm, COUNT(*) AS count
        FROM patients p
        JOIN patient_staff ps ON p.id = ps.patient_id
        WHERE p.is_ltc = true AND p.status != 'Discharged' AND ps.staff_id = $1
      `;
      params = [staffId];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching algorithm counts:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getPatientsByAlgorithm = async (req, res) => {
  const { algorithm } = req.params;
  const { is_admin, id: staffId } = req.user;

  const mapping = {
    Behavioral: 'is_behavioral',
    Guardianship: 'is_guardianship',
    LTC: 'is_ltc',
  };

  const column = mapping[algorithm];
  if (!column) {
    return res.status(400).json({ error: 'Invalid algorithm type' });
  }

  try {
    let query;
    let params = [];

    if (is_admin) {
      query = `
        SELECT id, first_name, last_name, birth_date, bed_id, created_at
        FROM patients
        WHERE ${column} = true AND status != 'Discharged'
      `;
    } else {
      query = `
        SELECT p.id, p.first_name , p.last_name AS name, p.birth_date, p.bed_id, p.created_at
        FROM patients p
        JOIN patient_staff ps ON p.id = ps.patient_id
        WHERE ${column} = true AND p.status != 'Discharged' AND ps.staff_id = $1
      `;
      params = [staffId];
    }

    const result = await pool.query(query, params);
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
