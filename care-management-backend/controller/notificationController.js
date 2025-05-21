const pool = require('../models/db');

const getUserNotifications = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching notifications:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const markAllRead = async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET read = true WHERE user_id = $1`,
      [req.user.id]
    );
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteAllNotifications = async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM notifications WHERE user_id = $1`,
      [req.user.id]
    );
    res.status(200).json({ message: "All notifications deleted." });
  } catch (err) {
    console.error("Error deleting notifications:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getUserNotifications, markNotificationRead, markAllRead,deleteAllNotifications };
