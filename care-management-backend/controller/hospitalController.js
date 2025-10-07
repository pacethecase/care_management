const pool = require("../models/db");

const getHospitals = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name,daily_room_cost  FROM hospitals ORDER BY name");
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching hospitals:", error);
    res.status(500).json({ error: "Failed to load hospitals" });
  }
};

const updateDailyRoomCost = async (req, res) => {
  const user = req.user;
  const hospitalId = parseInt(req.params.id, 10);
  const { daily_room_cost } = req.body;

  if (isNaN(hospitalId) || isNaN(daily_room_cost)) {
    return res.status(400).json({ error: "Invalid input." });
  }

  // ✅ Only hospital admin of *their own hospital* can update
if (!user.is_admin || (!user.is_super_admin && user.hospital_id !== hospitalId)) {
    return res.status(403).json({ error: "Unauthorized to update rate for this hospital." });
  }

  try {
    await pool.query(
      "UPDATE hospitals SET daily_room_cost = $1 WHERE id = $2",
      [daily_room_cost, hospitalId]
    );
    res.json({ message: "Hospital rate updated successfully." });
  } catch (err) {
    console.error("❌ Error updating hospital rate:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


module.exports = {
  getHospitals,
updateDailyRoomCost
};
