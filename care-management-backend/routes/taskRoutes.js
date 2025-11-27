// routes/taskRoutes.js
const express = require("express");
const router = express.Router();
const {
  startTask,
  completeTask,
  markTaskAsMissed,
  getMissedTasks,
  getPriorityTasks,
  followUpCourtTask,
  updateTaskNote,
  acknowledgeTask,
  addManualTaskForPatient,
  getTaskNames,
  overrideTask,
  handleOverrideDecision
} = require("../controller/taskController");
const { verifyToken,requireEditAccess,blockNonClinicalUsers } = require("../middleware/authMiddleware");

router.post("/:taskId/start", verifyToken,requireEditAccess,blockNonClinicalUsers, startTask);
router.post("/:taskId/complete", verifyToken,requireEditAccess,blockNonClinicalUsers, completeTask);
router.post("/:taskId/missed", verifyToken,requireEditAccess,blockNonClinicalUsers, markTaskAsMissed);
router.get("/priority", verifyToken, getPriorityTasks);
router.get("/missed", verifyToken, getMissedTasks);
router.post("/:taskId/follow-up",verifyToken,requireEditAccess,blockNonClinicalUsers, followUpCourtTask);
router.patch("/patient_tasks/:taskId/note", verifyToken,requireEditAccess,blockNonClinicalUsers, updateTaskNote);
router.patch("/:id/acknowledge", verifyToken,requireEditAccess,blockNonClinicalUsers, acknowledgeTask);
router.post("/patients/:id/manual-task",verifyToken,requireEditAccess,blockNonClinicalUsers, addManualTaskForPatient);
router.get("/task-names",verifyToken, getTaskNames);
router.post("/:taskId/override", verifyToken,requireEditAccess,blockNonClinicalUsers, overrideTask);
router.patch("/:taskId/overridedecision", verifyToken, handleOverrideDecision);

module.exports = router;
