const express = require("express");
const router  = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { getUserNotifications, markNotificationRead, markAllRead, deleteAllNotifications, deleteNotification } = require("../controller/notificationController");
 
router.get("/",                 verifyToken, getUserNotifications);
router.patch("/mark-all-read",  verifyToken, markAllRead);
router.patch("/:id/read",       verifyToken, markNotificationRead);
router.delete("/clear",         verifyToken, deleteAllNotifications);
router.delete("/:id",           verifyToken, deleteNotification);
 
module.exports = router;