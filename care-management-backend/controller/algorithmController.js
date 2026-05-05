// controller/algorithmController.js
const pool = require('../models/db');

const ALGORITHM_COLUMN_MAP = Object.freeze({
  Behavioral:   'is_behavioral',
  Guardianship: 'is_guardianship',
  LTC:          'is_ltc',
});

// ─── GET PATIENT COUNTS BY ALGORITHM ─────────────────────────────────────────
const getPatientCountsByAlgorithm = async (req, res) => {
  const { role, id: staffId, organization_id, hospital_id, is_approved } = req.user;
  const selectedHospital = req.query.hospitalId || null;

  if (!is_approved)
    return res.status(403).json({ error: "Access denied. User is not approved." });

  try {
    // ── Super admin ──────────────────────────────────────────────────────────
    if (role === 'super_admin') {
      // If a specific hospital is selected use that, otherwise scope to org
      const filter = selectedHospital
        ? `AND p.hospital_id = $1`
        : `AND h.organization_id = $1`;
      const params = [selectedHospital || organization_id];

      const { rows } = await pool.query(`
        SELECT 'Behavioral'   AS algorithm, COUNT(*) AS count
        FROM patients p JOIN hospitals h ON p.hospital_id = h.id
        WHERE p.is_behavioral   = TRUE AND p.status = 'Admitted'
          AND p.is_archived = FALSE ${filter}
        UNION ALL
        SELECT 'Guardianship', COUNT(*)
        FROM patients p JOIN hospitals h ON p.hospital_id = h.id
        WHERE p.is_guardianship = TRUE AND p.status = 'Admitted'
          AND p.is_archived = FALSE ${filter}
        UNION ALL
        SELECT 'LTC', COUNT(*)
        FROM patients p JOIN hospitals h ON p.hospital_id = h.id
        WHERE p.is_ltc          = TRUE AND p.status = 'Admitted'
          AND p.is_archived = FALSE ${filter}
      `, params);

      return res.json(rows);
    }

    // ── Admin — their hospital only ──────────────────────────────────────────
    if (role === 'admin') {
      const { rows } = await pool.query(`
        SELECT 'Behavioral'   AS algorithm, COUNT(*) AS count
        FROM patients
        WHERE is_behavioral   = TRUE AND status = 'Admitted'
          AND is_archived = FALSE AND hospital_id = $1
        UNION ALL
        SELECT 'Guardianship', COUNT(*)
        FROM patients
        WHERE is_guardianship = TRUE AND status = 'Admitted'
          AND is_archived = FALSE AND hospital_id = $1
        UNION ALL
        SELECT 'LTC', COUNT(*)
        FROM patients
        WHERE is_ltc          = TRUE AND status = 'Admitted'
          AND is_archived = FALSE AND hospital_id = $1
      `, [hospital_id]);

      return res.json(rows);
    }

    // ── Staff — only their assigned patients ─────────────────────────────────
    const { rows } = await pool.query(`
      SELECT 'Behavioral'   AS algorithm, COUNT(*) AS count
      FROM patients p JOIN patient_staff ps ON p.id = ps.patient_id
      WHERE p.is_behavioral   = TRUE AND p.status = 'Admitted'
        AND p.is_archived = FALSE AND ps.staff_id = $1 AND p.hospital_id = $2
      UNION ALL
      SELECT 'Guardianship', COUNT(*)
      FROM patients p JOIN patient_staff ps ON p.id = ps.patient_id
      WHERE p.is_guardianship = TRUE AND p.status = 'Admitted'
        AND p.is_archived = FALSE AND ps.staff_id = $1 AND p.hospital_id = $2
      UNION ALL
      SELECT 'LTC', COUNT(*)
      FROM patients p JOIN patient_staff ps ON p.id = ps.patient_id
      WHERE p.is_ltc          = TRUE AND p.status = 'Admitted'
        AND p.is_archived = FALSE AND ps.staff_id = $1 AND p.hospital_id = $2
    `, [staffId, hospital_id]);

    return res.json(rows);

  } catch (err) {
    console.error("Error fetching algorithm counts:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ─── GET PATIENTS BY ALGORITHM ────────────────────────────────────────────────
const getPatientsByAlgorithm = async (req, res) => {
  // FIX: destructure role instead of 3 boolean flags
  const { role, id: staffId, organization_id, hospital_id, is_approved } = req.user;
  const { algorithm } = req.params;
  const selectedHospital = req.query.hospitalId || null;

  if (!is_approved)
    return res.status(403).json({ error: "Access denied. User is not approved." });

  const column = ALGORITHM_COLUMN_MAP[algorithm];
  if (!column)
    return res.status(400).json({ error: `Invalid algorithm. Must be one of: ${Object.keys(ALGORITHM_COLUMN_MAP).join(', ')}` });

  const SELECT_COLS = `
    p.id, p.first_name, p.last_name,
    TO_CHAR(p.birth_date, 'YYYY-MM-DD') AS birth_date,
    p.room_no, p.admitted_date, p.hospital_id,
    p.is_behavioral, p.is_guardianship, p.is_ltc,
    p.status, p.mrn,p.created_at,
    EXTRACT(YEAR FROM AGE(NOW(), p.birth_date))::INTEGER AS age,
    h.name AS hospital_name
  `;

  try {
    // ── Super admin ──────────────────────────────────────────────────────────
    if (role === 'super_admin') {
      const filter = selectedHospital
        ? `AND p.hospital_id = $1`
        : `AND h.organization_id = $1`;
      const params = [selectedHospital || organization_id];

      const { rows } = await pool.query(`
        SELECT ${SELECT_COLS}
        FROM patients p
        JOIN hospitals h ON p.hospital_id = h.id
        WHERE p.${column} = TRUE
          AND p.status = 'Admitted'
          AND p.is_archived = FALSE
          ${filter}
        ORDER BY p.last_name ASC
      `, params);

      return res.json(rows);
    }

    // ── Admin — their hospital only ──────────────────────────────────────────
    if (role === 'admin') {
      const { rows } = await pool.query(`
        SELECT ${SELECT_COLS}
        FROM patients p
        JOIN hospitals h ON p.hospital_id = h.id
        WHERE p.${column} = TRUE
          AND p.status = 'Admitted'
          AND p.is_archived = FALSE
          AND p.hospital_id = $1
        ORDER BY p.last_name ASC
      `, [hospital_id]);

      return res.json(rows);
    }

    // ── Staff — only their assigned patients ─────────────────────────────────
    const { rows } = await pool.query(`
      SELECT ${SELECT_COLS}
      FROM patients p
      JOIN patient_staff ps ON p.id = ps.patient_id
      JOIN hospitals h ON p.hospital_id = h.id
      WHERE p.${column} = TRUE
        AND p.status = 'Admitted'
        AND p.is_archived = FALSE
        AND ps.staff_id = $1
        AND p.hospital_id = $2
      ORDER BY p.last_name ASC
    `, [staffId, hospital_id]);

    return res.json(rows);

  } catch (err) {
    console.error("Error fetching patients by algorithm:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  getPatientCountsByAlgorithm,
  getPatientsByAlgorithm,
};