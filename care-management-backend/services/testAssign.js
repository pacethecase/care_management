// scripts/testAssign.js
const assignTasksToPatient = require("./assignTasksToPatient");
require("dotenv").config();
const pool = require("../models/db");

const run = async () => {
  try {
    // Step 1: Insert a mock patient with past admission date
    const { rows } = await pool.query(`
      INSERT INTO patients (
        name, birth_date, age, bed_id, assigned_staff_id,
        admitted_date, is_behavioral, is_guardianship,
        is_guardianship_financial, is_guardianship_person,
        is_guardianship_emergency, is_ltc, is_ltc_financial, is_ltc_medical
      ) VALUES (
        'Timeline Test Patient4', '1960-01-01', 64, 'B201', 2,
        '2025-04-1', false, true,
        true, true,
        false, true, true, true
      ) RETURNING id
    `);

    const patientId = rows[0].id;
    console.log("✅ Inserted test patient with ID:", patientId);

    // Step 2: Assign tasks using your logic
    await assignTasksToPatient(patientId);
    console.log("✅ Assigned tasks successfully.");

    process.exit(0);
  } catch (err) {
    console.error("❌ Error running test:", err);
    process.exit(1);
  }
};

run();
