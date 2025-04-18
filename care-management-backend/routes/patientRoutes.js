const express = require("express");
const router = express.Router();
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");
const {
  getPatients,
  addPatient,
  getPatientById,
  getPatientTasks,
  getDischargedPatients,dischargePatient
} = require("../controller/patientController");

router.get('/discharged', verifyToken, getDischargedPatients);
router.get("/", verifyToken, getPatients);
router.post("/", verifyToken, requireAdmin, addPatient);
router.get("/:patientId", verifyToken, getPatientById);
router.get("/:patientId/tasks", verifyToken, getPatientTasks);
router.post("/:patientId/discharge", verifyToken, dischargePatient);



module.exports = router;