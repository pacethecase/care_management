const assignTasksToPatient = require("./assignTasksToPatient");
require("dotenv").config();
const pool = require("../models/db");

const run = async () => {
  try {
    // Step 1: Insert a mock patient (assuming user with ID 1 is the creator)
    const { rows } = await pool.query(`
      INSERT INTO patients (
        first_name, last_name, birth_date, age, bed_id,
        admitted_date, is_behavioral, is_guardianship,
        is_guardianship_financial, is_guardianship_person,
        is_guardianship_emergency, is_ltc, is_ltc_financial, is_ltc_medical,
        added_by_user_id, selected_algorithms
      ) VALUES (
        'Test', 'Patient1', '1960-01-01', 64, 'B201',
        '2025-04-01', false, true,
        true, true,
        false, true, true, true,
        1, ARRAY['Guardianship', 'LTC']
      ) RETURNING id
    `);

    const patientId = rows[0].id;
    console.log("✅ Inserted test patient with ID:", patientId);

    // Step 2: Assign tasks
    await assignTasksToPatient(patientId);
    console.log("✅ Assigned tasks successfully.");

    process.exit(0);
  } catch (err) {
    console.error("❌ Error running test:", err);
    process.exit(1);
  }
};

run();
