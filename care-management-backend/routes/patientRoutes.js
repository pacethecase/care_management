const express = require("express");
const router = express.Router();
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");
const {
  getPatients,
  addPatient,
  getPatientById,
  getPatientTasks,
  getDischargedPatients,dischargePatient,updatePatient,getSearchedPatients,reactivatePatient,
  getPatientsByAdmin
} = require("../controller/patientController");

router.get('/discharged', verifyToken, getDischargedPatients);
router.get("/", verifyToken, getPatients);
router.get("/search", verifyToken, getSearchedPatients);
router.post("/", verifyToken, requireAdmin, addPatient);
router.get("/:patientId", verifyToken, getPatientById);
router.get("/:patientId/tasks", verifyToken, getPatientTasks);

router.post("/:patientId/discharge", verifyToken, dischargePatient);


router.patch("/:patientId/update", verifyToken, updatePatient);
router.patch('/:patientId/reactivate', verifyToken, reactivatePatient);
router.get('/by-admin/:adminId',verifyToken, getPatientsByAdmin);

module.exports = router;