// routes/algorithmRoutes.js
const express = require("express");
const router = express.Router();
const {
  getPatientCountsByAlgorithm,
  getPatientsByAlgorithm,
} = require("../controller/algorithmController");

const { verifyToken } = require("../middleware/authMiddleware");

router.get("/counts", verifyToken,getPatientCountsByAlgorithm);
router.get("/:algorithm",verifyToken, getPatientsByAlgorithm);

module.exports = router;
