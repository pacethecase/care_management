const express = require("express");
const router = express.Router();
const { getHospitals,updateDailyRoomCost } = require("../controller/hospitalController");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/",verifyToken, getHospitals);          // GET /hospitals
router.patch("/:id/rate", verifyToken, updateDailyRoomCost);

module.exports = router;
