// routes/taskRoutes.js
const express = require("express");
const router = express.Router();
const {
  startTask,
  completeTask,
  markTaskAsMissed,
  getMissedTasks,
  getPriorityTasks,
  addMissedReason,
} = require("../controller/taskController");
const { verifyToken } = require("../middleware/authMiddleware");


router.post("/:taskId/start", verifyToken, startTask);

router.post("/:taskId/complete", verifyToken, completeTask);

router.post("/:taskId/missed", verifyToken, markTaskAsMissed);

router.put("/:taskId/missed/reason", verifyToken, addMissedReason);

router.get("/priority", verifyToken, getPriorityTasks);

router.get("/missed", verifyToken, getMissedTasks);

module.exports = router;
