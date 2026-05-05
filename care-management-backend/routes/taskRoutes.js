const express = require("express");
const router  = express.Router();
const { verifyToken, requireEditAccess, blockNonClinicalUsers } = require("../middleware/authMiddleware");
const {
  startTask, completeTask, markTaskAsMissed, getMissedTasks,
  getPriorityTasks, followUpCourtTask, updateTaskNote, acknowledgeTask,
  addManualTaskForPatient, getTaskNames, overrideTask, handleOverrideDecision,
} = require("../controller/taskController");

router.get("/priority",    verifyToken, getPriorityTasks);
router.get("/missed",      verifyToken, getMissedTasks);
router.get("/task-names",  verifyToken, getTaskNames);
 
router.post("/patients/:id/manual-task", verifyToken, requireEditAccess, blockNonClinicalUsers, addManualTaskForPatient);
router.patch("/patient_tasks/:taskId/note", verifyToken, requireEditAccess, blockNonClinicalUsers, updateTaskNote);
 
router.post("/:taskId/start",           verifyToken, requireEditAccess, blockNonClinicalUsers, startTask);
router.post("/:taskId/complete",        verifyToken, requireEditAccess, blockNonClinicalUsers, completeTask);
router.post("/:taskId/missed",          verifyToken, requireEditAccess, blockNonClinicalUsers, markTaskAsMissed);
router.post("/:taskId/follow-up",       verifyToken, requireEditAccess, blockNonClinicalUsers, followUpCourtTask);
router.patch("/:taskId/overridedecision", verifyToken, handleOverrideDecision);
router.post("/:taskId/override",        verifyToken, requireEditAccess, blockNonClinicalUsers, overrideTask);
router.patch("/:taskId/acknowledge", verifyToken, requireEditAccess, blockNonClinicalUsers, acknowledgeTask);
 
module.exports = router;
 