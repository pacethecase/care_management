const express = require("express");
const router = express.Router();
const {
  getPatientNotes,
  addPatientNote,
  updatePatientNote,
  deletePatientNote
} = require("../controller/noteController");

const { verifyToken } = require("../middleware/authMiddleware");

router.get("/:patientId", verifyToken, getPatientNotes);
router.post("/:patientId", verifyToken, addPatientNote);
router.put("/update/:noteId", verifyToken, updatePatientNote);
router.delete("/:noteId",verifyToken, deletePatientNote); 
module.exports = router;
