// routes/algorithmRoutes.js
const express = require("express");
const router = express.Router();
const {
  getPatientCountsByAlgorithm,
  getPatientsByAlgorithm,
} = require("../controller/algorithmController");

router.get("/counts", getPatientCountsByAlgorithm);
router.get("/:algorithm", getPatientsByAlgorithm);

module.exports = router;
