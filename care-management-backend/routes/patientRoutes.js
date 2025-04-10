const express = require("express");
const router = express.Router();
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");
const {
  getPatients,
  addPatient,
  getPatientById,
  getPatientTasks,
} = require("../controller/patientController");

router.get("/", verifyToken, getPatients);
router.post("/", verifyToken, requireAdmin, addPatient);
router.get("/:patientId", verifyToken, getPatientById);
router.get("/:patientId/tasks", verifyToken, getPatientTasks);

module.exports = router;