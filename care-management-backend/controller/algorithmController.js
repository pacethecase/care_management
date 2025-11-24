const pool = require('../models/db');

/* ============================================================
   GET PATIENT COUNTS BY ALGORITHM
   Supports: super admin hospital filter (?hospitalId=)
============================================================ */
const getPatientCountsByAlgorithm = async (req, res) => {
  const {
    is_admin,
    is_super_admin,
    id: staffId,
    organization_id,
    hospital_id,
    is_approved
  } = req.user;

  const selectedHospital = req.query.hospitalId || null;

  if (!is_approved) {
    return res.status(403).json({ error: "Access denied. User is not approved." });
  }

  try {
    /* ---------------------------------------------------------
       SUPER ADMIN — CAN FILTER BY hospitalId OR SEE ALL
    --------------------------------------------------------- */
    if (is_super_admin) {
      let filter = "";
      let params = [];

      if (selectedHospital) {
        filter = `AND p.hospital_id = $1`;
        params = [selectedHospital];
      } else {
        filter = `AND h.organization_id = $1`;
        params = [organization_id];
      }

      const query = `
        SELECT 'Behavioral' AS algorithm, COUNT(*) AS count
        FROM patients p
        JOIN hospitals h ON p.hospital_id = h.id
        WHERE p.is_behavioral = TRUE
          AND p.status = 'Admitted'
          AND COALESCE(p.is_archived, false) = false
          ${filter}

        UNION ALL

        SELECT 'Guardianship', COUNT(*)
        FROM patients p
        JOIN hospitals h ON p.hospital_id = h.id
        WHERE p.is_guardianship = TRUE
          AND p.status = 'Admitted'
          AND COALESCE(p.is_archived, false) = false
          ${filter}

        UNION ALL

        SELECT 'LTC', COUNT(*)
        FROM patients p
        JOIN hospitals h ON p.hospital_id = h.id
        WHERE p.is_ltc = TRUE
          AND p.status = 'Admitted'
          AND COALESCE(p.is_archived, false) = false
          ${filter}
      `;

      const result = await pool.query(query, params);
      return res.json(result.rows);
    }

    /* ---------------------------------------------------------
       ADMIN — ONLY THEIR HOSPITAL
    --------------------------------------------------------- */
    if (is_admin) {
      const query = `
        SELECT 'Behavioral' AS algorithm, COUNT(*) AS count
        FROM patients
        WHERE is_behavioral = TRUE AND status = 'Admitted'
          AND COALESCE(is_archived, false) = false
          AND hospital_id = $1

        UNION ALL
        SELECT 'Guardianship', COUNT(*)
        FROM patients
        WHERE is_guardianship = TRUE AND status = 'Admitted'
          AND COALESCE(is_archived, false) = false
          AND hospital_id = $1

        UNION ALL
        SELECT 'LTC', COUNT(*)
        FROM patients
        WHERE is_ltc = TRUE AND status = 'Admitted'
          AND COALESCE(is_archived, false) = false
          AND hospital_id = $1
      `;
      const result = await pool.query(query, [hospital_id]);
      return res.json(result.rows);
    }

    /* ---------------------------------------------------------
       STAFF — ONLY ASSIGNED PATIENTS
    --------------------------------------------------------- */
    const query = `
      SELECT 'Behavioral', COUNT(*)
      FROM patients p
      JOIN patient_staff ps ON p.id = ps.patient_id
      WHERE p.is_behavioral = TRUE 
        AND p.status = 'Admitted'
        AND COALESCE(p.is_archived, false) = false
        AND ps.staff_id = $1 
        AND p.hospital_id = $2

      UNION ALL

      SELECT 'Guardianship', COUNT(*)
      FROM patients p
      JOIN patient_staff ps ON p.id = ps.patient_id
      WHERE p.is_guardianship = TRUE
        AND p.status = 'Admitted'
        AND COALESCE(p.is_archived, false) = false
        AND ps.staff_id = $1 
        AND p.hospital_id = $2

      UNION ALL

      SELECT 'LTC', COUNT(*)
      FROM patients p
      JOIN patient_staff ps ON p.id = ps.patient_id
      WHERE p.is_ltc = TRUE
        AND p.status = 'Admitted'
        AND COALESCE(p.is_archived, false) = false
        AND ps.staff_id = $1 
        AND p.hospital_id = $2
    `;

    const result = await pool.query(query, [staffId, hospital_id]);
    return res.json(result.rows);

  } catch (err) {
    console.error("❌ Error fetching algorithm counts:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/* ============================================================
   GET PATIENTS BY ALGORITHM
   Supports: super admin hospital filter (?hospitalId=)
============================================================ */
const getPatientsByAlgorithm = async (req, res) => {
  const { algorithm } = req.params;
  const {
    is_admin,
    is_super_admin,
    id: staffId,
    organization_id,
    hospital_id,
    is_approved
  } = req.user;

  const selectedHospital = req.query.hospitalId || null;

  if (!is_approved) {
    return res.status(403).json({ error: "Access denied. User is not approved." });
  }

  const mapping = {
    Behavioral: "is_behavioral",
    Guardianship: "is_guardianship",
    LTC: "is_ltc",
  };

  const column = mapping[algorithm];
  if (!column) return res.status(400).json({ error: "Invalid algorithm type" });

  try {
    /* ---------------------------------------------------------
       SUPER ADMIN — WITH OPTIONAL hospitalId FILTER
    --------------------------------------------------------- */
    if (is_super_admin) {
      let filter = "";
      let params = [];

      if (selectedHospital) {
        filter = `AND p.hospital_id = $1`;
        params = [selectedHospital];
      } else {
        filter = `AND h.organization_id = $1`;
        params = [organization_id];
      }

      const query = `
        SELECT 
          p.id, p.first_name, p.last_name, p.birth_date, p.room_no,
          p.created_at, p.admitted_date, p.hospital_id,
          h.name AS hospital_name
        FROM patients p
        JOIN hospitals h ON p.hospital_id = h.id
        WHERE p.${column} = TRUE
          AND p.status = 'Admitted'
          AND COALESCE(p.is_archived, FALSE) = FALSE
          ${filter}
        ORDER BY p.last_name ASC
      `;

      const { rows } = await pool.query(query, params);
      return res.json(rows);
    }

    /* ---------------------------------------------------------
       NORMAL ADMIN — THEIR HOSPITAL ONLY
    --------------------------------------------------------- */
    if (is_admin) {
      const query = `
        SELECT 
          p.id, p.first_name, p.last_name, p.birth_date, p.room_no,
          p.created_at, p.admitted_date, p.hospital_id,
          h.name AS hospital_name
        FROM patients p
        JOIN hospitals h ON p.hospital_id = h.id
        WHERE p.${column} = TRUE
          AND p.status = 'Admitted'
          AND COALESCE(p.is_archived, FALSE) = FALSE
          AND p.hospital_id = $1
        ORDER BY p.last_name ASC
      `;
      const { rows } = await pool.query(query, [hospital_id]);
      return res.json(rows);
    }

    /* ---------------------------------------------------------
       STAFF — ONLY ASSIGNED PATIENTS
    --------------------------------------------------------- */
    const query = `
      SELECT 
        p.id, p.first_name, p.last_name, p.birth_date, p.room_no,
        p.created_at, p.admitted_date, p.hospital_id,
        h.name AS hospital_name
      FROM patients p
      JOIN patient_staff ps ON p.id = ps.patient_id
      JOIN hospitals h ON p.hospital_id = h.id
      WHERE p.${column} = TRUE
        AND p.status = 'Admitted'
        AND COALESCE(p.is_archived, FALSE) = FALSE
        AND ps.staff_id = $1
        AND p.hospital_id = $2
      ORDER BY p.last_name ASC
    `;
    const { rows } = await pool.query(query, [staffId, hospital_id]);
    return res.json(rows);

  } catch (err) {
    console.error("❌ Error fetching patients:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  getPatientCountsByAlgorithm,
  getPatientsByAlgorithm,
};
