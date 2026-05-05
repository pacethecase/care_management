// controller/hospitalController.js
const pool = require("../models/db");
const { DateTime } = require("luxon");

const isValidTimezone = (tz) => DateTime.now().setZone(tz).isValid;

const getHospitals = async (req, res) => {
  const { role, organization_id, hospital_id, has_global_access } = req.user;

  try {
    let query  = "";
    let params = [];

    if (role === 'administration' && has_global_access) {
      query = `
        SELECT id, name, daily_room_cost, organization_id, timezone
        FROM hospitals
        ORDER BY name
      `;
    } else if (role === 'super_admin') {
      query = `
        SELECT id, name, daily_room_cost, organization_id, timezone
        FROM hospitals
        WHERE organization_id = $1
        ORDER BY name
      `;
      params = [organization_id];
    } else if (role === 'admin' || role === 'staff') {
      query = `
        SELECT id, name, daily_room_cost, organization_id, timezone
        FROM hospitals
        WHERE id = $1
        ORDER BY name
      `;
      params = [hospital_id];
    } else {
      return res.status(403).json({ error: "Unauthorized to access hospitals." });
    }

    const { rows } = await pool.query(query, params);
    return res.status(200).json(rows);

  } catch (err) {
    console.error("Error fetching hospitals:", err);
    return res.status(500).json({ error: "Failed to load hospitals" });
  }
};


const updateDailyRoomCost = async (req, res) => {
  const { role, organization_id, hospital_id, has_global_access } = req.user;
  const hospitalId    = Number(req.params.id);
  const daily_room_cost = Number(req.body.daily_room_cost);

  if (isNaN(hospitalId))
    return res.status(400).json({ error: "Invalid hospital ID." });
  if (isNaN(daily_room_cost) || daily_room_cost < 0)
    return res.status(400).json({ error: "Invalid daily room cost." });

  try {
    if (role === 'administration' && has_global_access) {
      await pool.query(
        `UPDATE hospitals SET daily_room_cost = $1 WHERE id = $2`,
        [daily_room_cost, hospitalId]
      );
      return res.json({ message: "Rate updated." });
    }

    if (role === 'super_admin') {
      const { rows } = await pool.query(
        `SELECT id FROM hospitals WHERE id = $1 AND organization_id = $2`,
        [hospitalId, organization_id]
      );
      if (rows.length === 0)
        return res.status(403).json({ error: "Hospital not in your organization." });

      await pool.query(
        `UPDATE hospitals SET daily_room_cost = $1 WHERE id = $2`,
        [daily_room_cost, hospitalId]
      );
      return res.json({ message: "Rate updated." });
    }

    if (role === 'admin') {
      if (hospital_id !== hospitalId)
        return res.status(403).json({ error: "Unauthorized for this hospital." });

      await pool.query(
        `UPDATE hospitals SET daily_room_cost = $1 WHERE id = $2`,
        [daily_room_cost, hospitalId]
      );
      return res.json({ message: "Rate updated." });
    }

    return res.status(403).json({ error: "Staff cannot modify room rates." });

  } catch (err) {
    console.error("Error updating hospital rate:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const updateHospitalTimezone = async (req, res) => {
  const { role, organization_id, hospital_id, has_global_access } = req.user;
  const hospitalId = Number(req.params.id);
  const { timezone } = req.body;

  if (isNaN(hospitalId))
    return res.status(400).json({ error: "Invalid hospital ID." });
  if (!timezone || typeof timezone !== "string")
    return res.status(400).json({ error: "Timezone is required." });
  if (!isValidTimezone(timezone))
    return res.status(400).json({ error: "Invalid IANA timezone string." });

  try {
    if (role === 'administration' && has_global_access) {
      await pool.query(
        `UPDATE hospitals SET timezone = $1 WHERE id = $2`,
        [timezone, hospitalId]
      );
      return res.json({ message: "Timezone updated." });
    }

    if (role === 'super_admin') {
      const { rows } = await pool.query(
        `SELECT id FROM hospitals WHERE id = $1 AND organization_id = $2`,
        [hospitalId, organization_id]
      );
      if (rows.length === 0)
        return res.status(403).json({ error: "Hospital not in your organization." });

      await pool.query(
        `UPDATE hospitals SET timezone = $1 WHERE id = $2`,
        [timezone, hospitalId]
      );
      return res.json({ message: "Timezone updated." });
    }

    if (role === 'admin') {
      if (hospital_id !== hospitalId)
        return res.status(403).json({ error: "Unauthorized for this hospital." });

      await pool.query(
        `UPDATE hospitals SET timezone = $1 WHERE id = $2`,
        [timezone, hospitalId]
      );
      return res.json({ message: "Timezone updated." });
    }

    return res.status(403).json({ error: "Staff cannot modify timezone." });

  } catch (err) {
    console.error("Error updating hospital timezone:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  getHospitals,
  updateDailyRoomCost,
  updateHospitalTimezone,
};