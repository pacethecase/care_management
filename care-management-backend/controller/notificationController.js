// controller/notificationController.js
const pool = require('../models/db');

// ─── Helper: approval gate ────────────────────────────────────────────────────
// Notifications are always scoped to req.user.id so no role checks needed here —
// every user can only read/write their own notifications.
const requireApproved = (req, res) => {
  if (!req.user.is_approved) {
    res.status(403).json({ error: 'Access denied. User not approved.' });
    return false;
  }
  return true;
};

// ─── GET USER NOTIFICATIONS ───────────────────────────────────────────────────
const getUserNotifications = async (req, res) => {
  if (!requireApproved(req, res)) return;

  try {
    const { rows } = await pool.query(
      `SELECT
         n.id,
         n.user_id,
         n.patient_id,
         n.patient_task_id,
         n.title,
         n.message,
         n.type,
         n.read,
         n.created_at,
         r.status AS request_status
       FROM notifications n
       LEFT JOIN task_override_requests r
         ON n.patient_task_id = r.task_id
         AND r.status = 'Pending'
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 100`,                          // FIX: cap at 100 — unbounded fetch
      [req.user.id]                         // grows forever otherwise
    );

    return res.json(rows);

  } catch (err) {
    console.error("Error fetching notifications:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── MARK ONE NOTIFICATION AS READ ───────────────────────────────────────────
const markNotificationRead = async (req, res) => {
  if (!requireApproved(req, res)) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id))
    return res.status(400).json({ error: 'Invalid notification ID.' });

  try {
    const { rowCount } = await pool.query(
      `UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    // FIX: 204 is fine but if rowCount is 0 the notification didn't exist
    // or belongs to another user — surface that instead of silently succeeding
    if (rowCount === 0)
      return res.status(404).json({ error: 'Notification not found.' });

    return res.sendStatus(204);

  } catch (err) {
    console.error("Error marking notification read:", err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── MARK ALL NOTIFICATIONS AS READ ──────────────────────────────────────────
const markAllRead = async (req, res) => {
  if (!requireApproved(req, res)) return;

  try {
    await pool.query(
      `UPDATE notifications SET read = TRUE WHERE user_id = $1`,
      [req.user.id]
    );
    return res.sendStatus(204);

  } catch (err) {
    console.error("Error marking all notifications read:", err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── DELETE ONE NOTIFICATION ──────────────────────────────────────────────────
const deleteNotification = async (req, res) => {
  if (!requireApproved(req, res)) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id))
    return res.status(400).json({ error: 'Invalid notification ID.' });

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    // FIX: surface 404 if notification didn't exist or belongs to another user
    if (rowCount === 0)
      return res.status(404).json({ error: 'Notification not found.' });

    return res.status(200).json({ message: 'Notification deleted.' });

  } catch (err) {
    console.error("Error deleting notification:", err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── DELETE ALL NOTIFICATIONS ─────────────────────────────────────────────────
const deleteAllNotifications = async (req, res) => {
  if (!requireApproved(req, res)) return;

  try {
    await pool.query(
      `DELETE FROM notifications WHERE user_id = $1`,
      [req.user.id]
    );
    return res.status(200).json({ message: 'All notifications deleted.' });

  } catch (err) {
    console.error("Error deleting all notifications:", err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getUserNotifications,
  markNotificationRead,
  markAllRead,
  deleteNotification,
  deleteAllNotifications,
};