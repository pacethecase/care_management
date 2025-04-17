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
} = require("../controller/taskController");
const { verifyToken } = require("../middleware/authMiddleware");


router.post("/:taskId/start", verifyToken, startTask);

router.post("/:taskId/complete", verifyToken, completeTask);

router.post("/:taskId/missed", verifyToken, markTaskAsMissed);


router.get("/priority", verifyToken, getPriorityTasks);

router.get("/missed", verifyToken, getMissedTasks);
router.post("/:taskId/follow-up", followUpCourtTask);

module.exports = router;
