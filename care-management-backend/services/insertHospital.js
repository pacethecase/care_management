const pool = require("../models/db");
const bcrypt = require("bcrypt");

const insertHospitalAndAdmin = async () => {
  try {
    console.log("🏥 Inserting hospital and admin...");

    // Step 1: Insert the hospital
    const hospitalRes = await pool.query(
      `INSERT INTO hospitals (name, daily_room_cost)
       VALUES ($1, $2)
       RETURNING id`,
      [
        "Hospital A",
       "1883.00"
      ]
    );

    const hospitalId = hospitalRes.rows[0].id;
    console.log("✅ Hospital inserted with ID:", hospitalId);

    // Step 2: Hash password
    const password = "admin123"; // CHANGE THIS AFTER FIRST USE
    const hashedPassword = await bcrypt.hash(password, 10);

    // Step 3: Insert the admin user
    await pool.query(
      `INSERT INTO users (
        email,
        name,
        password,
        is_super_admin,
        is_approved,
        is_admin,
        is_verified,
        has_global_access,
        hospital_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7,$8,$9)`,
      [
        "admin@gmail.com",
        "Admin",
        hashedPassword,
        true,  // is_superuser
        true,
        true,  // is_staff
        true,  // is_verified
        true,  // is_global_admin
        hospitalId
      ]
    );

    console.log("✅ Admin user inserted: admin@gmail.com");

  } catch (err) {
    console.error("❌ Error inserting hospital/admin:", err.message);
  } finally {
    await pool.end();
  }
};

insertHospitalAndAdmin();
