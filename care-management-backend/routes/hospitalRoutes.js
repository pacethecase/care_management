const express = require("express");
const router  = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { getHospitals, updateDailyRoomCost, updateHospitalTimezone } = require("../controller/hospitalController");
 
router.get("/",              verifyToken, getHospitals);
router.patch("/:id/rate",    verifyToken, updateDailyRoomCost);
router.patch("/:id/timezone",verifyToken, updateHospitalTimezone);
 
module.exports = router;