const express = require("express");
const router  = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { getPatientNotes, addPatientNote, updatePatientNote, deletePatientNote } = require("../controller/noteController");
 
router.get("/:patientId",          verifyToken, getPatientNotes);
router.post("/:patientId",         verifyToken, addPatientNote);
router.put("/update/:noteId",      verifyToken, updatePatientNote);
router.delete("/:noteId",          verifyToken, deletePatientNote);
 
module.exports = router;