const express = require('express');
const router = express.Router();
const { getUserNotifications, markNotificationRead, markAllRead } = require('../controller/notificationController');
const { verifyToken } = require("../middleware/authMiddleware");

router.get('/', verifyToken, getUserNotifications);
router.patch('/:id/read', verifyToken, markNotificationRead);
router.patch('/mark-all-read', verifyToken, markAllRead);

module.exports = router;
