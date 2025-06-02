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
} = require("../controller/taskController");
const { verifyToken } = require("../middleware/authMiddleware");


router.post("/:taskId/start", verifyToken, startTask);

router.post("/:taskId/complete", verifyToken, completeTask);

router.post("/:taskId/missed", verifyToken, markTaskAsMissed);


router.get("/priority", verifyToken, getPriorityTasks);

router.get("/missed", verifyToken, getMissedTasks);
router.post("/:taskId/follow-up",verifyToken, followUpCourtTask);
router.patch("/patient_tasks/:taskId/note", verifyToken, updateTaskNote);
router.patch("/:id/acknowledge", verifyToken, acknowledgeTask);


module.exports = router;
