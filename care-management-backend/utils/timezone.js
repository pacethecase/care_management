// ─── utils/timezone.js ───────────────────────────────────────────────────────

const pool = require("../models/db");

// FIX: role check uses role string instead of is_super_admin boolean
// FIX: added getHospitalTimezone as a named export — used directly in
//      taskController, completeTask, overrideTask etc.
// FIX: added fallback to 'America/New_York' if timezone not found
//      rather than crashing with "Cannot read property 'timezone' of undefined"

const getTimezoneForUser = async (user) => {
  try {
    // Super admins are org-level — use org timezone for display context.
    // All patient task due dates still use the hospital's timezone at write time.
    if (user.role === 'super_admin') {
      const { rows } = await pool.query(
        `SELECT timezone FROM organizations WHERE id = $1`,
        [user.organization_id]
      );
      return rows[0]?.timezone ?? 'America/New_York';
    }

    // Admin and staff — use their hospital's timezone
    const { rows } = await pool.query(
      `SELECT timezone FROM hospitals WHERE id = $1`,
      [user.hospital_id]
    );
    return rows[0]?.timezone ?? 'America/New_York';

  } catch (err) {
    console.error("getTimezoneForUser error:", err.message);
    return 'America/New_York';
  }
};


const getHospitalTimezone = async (hospitalId) => {
  try {
    const { rows } = await pool.query(
      `SELECT timezone FROM hospitals WHERE id = $1`,
      [hospitalId]
    );
    return rows[0]?.timezone ?? 'America/New_York';
  } catch (err) {
    console.error("getHospitalTimezone error:", err.message);
    return 'America/New_York';
  }
};

module.exports = { getTimezoneForUser, getHospitalTimezone };