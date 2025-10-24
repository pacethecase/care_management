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
const { verifyToken,requireEditAccess } = require("../middleware/authMiddleware");


router.post("/:taskId/start", verifyToken,requireEditAccess, startTask);
router.post("/:taskId/complete", verifyToken,requireEditAccess, completeTask);
router.post("/:taskId/missed", verifyToken,requireEditAccess, markTaskAsMissed);
router.get("/priority", verifyToken, getPriorityTasks);
router.get("/missed", verifyToken, getMissedTasks);
router.post("/:taskId/follow-up",verifyToken,requireEditAccess, followUpCourtTask);
router.patch("/patient_tasks/:taskId/note", verifyToken,requireEditAccess, updateTaskNote);
router.patch("/:id/acknowledge", verifyToken,requireEditAccess, acknowledgeTask);
router.post("/patients/:id/manual-task",verifyToken,requireEditAccess, addManualTaskForPatient);
router.get("/task-names",verifyToken, getTaskNames);
router.post("/:taskId/override", verifyToken,requireEditAccess, overrideTask);
router.patch("/:taskId/overridedecision", verifyToken, handleOverrideDecision);

module.exports = router;
