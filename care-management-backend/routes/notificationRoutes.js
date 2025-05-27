const express = require('express');
const router = express.Router();
const { getUserNotifications, markNotificationRead, markAllRead,deleteAllNotifications,deleteNotification } = require('../controller/notificationController');
const { verifyToken } = require("../middleware/authMiddleware");

router.get('/', verifyToken, getUserNotifications);
router.patch('/:id/read', verifyToken, markNotificationRead);
router.patch('/mark-all-read', verifyToken, markAllRead);
router.delete('/clear', verifyToken, deleteAllNotifications);
router.delete('/:id', verifyToken, deleteNotification); 
module.exports = router;
