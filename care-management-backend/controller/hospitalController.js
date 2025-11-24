const pool = require("../models/db");

const getHospitals = async (req, res) => {
  const { has_global_access, is_super_admin, is_admin, organization_id, hospital_id } = req.user;

  try {
    let query = "";
    let params = [];

    // 🌍 GLOBAL ADMIN → gets all hospitals
    if (has_global_access) {
      query = `
        SELECT id, name, daily_room_cost, organization_id
        FROM hospitals
        ORDER BY name;
      `;
    }

    // 🏢 SUPER ADMIN → gets all hospitals in their organization
    else if (is_super_admin) {
      query = `
        SELECT id, name, daily_room_cost, organization_id
        FROM hospitals
        WHERE organization_id = $1
        ORDER BY name;
      `;
      params = [organization_id];
    }

    // 🏥 HOSPITAL ADMIN → gets only THEIR hospital
    else if (is_admin) {
      query = `
        SELECT id, name, daily_room_cost, organization_id
        FROM hospitals
        WHERE id = $1
        ORDER BY name;
      `;
      params = [hospital_id];
    }

    // 👨‍⚕️ STAFF → forbidden
    else {
      return res.status(403).json({ error: "Unauthorized to access hospitals." });
    }

    const { rows } = await pool.query(query, params);
    return res.status(200).json(rows);

  } catch (error) {
    console.error("❌ Error fetching hospitals:", error);
    return res.status(500).json({ error: "Failed to load hospitals" });
  }
};

/**
 * UPDATE DAILY ROOM COST
 */
const updateDailyRoomCost = async (req, res) => {
  const user = req.user;
  const hospitalId = Number(req.params.id);
  const { daily_room_cost } = req.body;

  if (isNaN(hospitalId) || isNaN(daily_room_cost)) {
    return res.status(400).json({ error: "Invalid input." });
  }

  try {
    // 🌍 GLOBAL ADMIN CAN EDIT ANY HOSPITAL
    if (user.has_global_access) {
      await pool.query(
        `UPDATE hospitals SET daily_room_cost = $1 WHERE id = $2`,
        [daily_room_cost, hospitalId]
      );
      return res.json({ message: "Rate updated (global admin)." });
    }

    // 🏢 SUPER ADMIN CAN EDIT ANY HOSPITAL IN THEIR ORGANIZATION
    if (user.is_super_admin) {
      const { rows } = await pool.query(
        `SELECT id FROM hospitals WHERE id = $1 AND organization_id = $2`,
        [hospitalId, user.organization_id]
      );

      if (rows.length === 0) {
        return res.status(403).json({ error: "Hospital not part of your organization." });
      }

      await pool.query(
        `UPDATE hospitals SET daily_room_cost = $1 WHERE id = $2`,
        [daily_room_cost, hospitalId]
      );
      return res.json({ message: "Rate updated (super admin)." });
    }

    // 🏥 ADMIN CAN EDIT ONLY THEIR OWN HOSPITAL
    if (user.is_admin) {
      if (user.hospital_id !== hospitalId) {
        return res.status(403).json({ error: "Unauthorized for this hospital." });
      }

      await pool.query(
        `UPDATE hospitals SET daily_room_cost = $1 WHERE id = $2`,
        [daily_room_cost, hospitalId]
      );
      return res.json({ message: "Rate updated (hospital admin)." });
    }

    // 👨‍⚕️ STAFF CANNOT UPDATE
    return res.status(403).json({ error: "Unauthorized: staff cannot modify rates." });

  } catch (err) {
    console.error("❌ Error updating hospital rate:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  getHospitals,
  updateDailyRoomCost,
};
