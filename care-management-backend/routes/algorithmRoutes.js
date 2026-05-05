const express = require("express");
const router  = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { getPatientCountsByAlgorithm, getPatientsByAlgorithm } = require("../controller/algorithmController");
 
router.get("/counts",      verifyToken, getPatientCountsByAlgorithm);
router.get("/:algorithm",  verifyToken, getPatientsByAlgorithm);
 
module.exports = router;
 