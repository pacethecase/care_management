const pool = require("../models/db");
const cron = require("node-cron");
const { DateTime } = require("luxon");

function setupMissedTaskJob(io) {
  cron.schedule("0 * * * *", async () => {
    try {
      const now = DateTime.local().setZone("America/New_York"); // Your app's local zone
      const cutoff = now.set({ hour: 16, minute: 0, second: 0, millisecond: 0 });

      // Only run the marking logic if it's past 4 PM local time
      if (now < cutoff) {
        console.log("🕓 It is not yet 4 PM local time. Skipping missed task check.");
        return;
      }

      console.log("⏳ Running missed task job at", now.toFormat("HH:mm"));

      const overdueTasks = await pool.query(`
        SELECT pt.id, pt.patient_id, pt.assigned_staff_id, p.name AS patient_name
        FROM patient_tasks pt
        JOIN patients p ON pt.patient_id = p.id
        WHERE pt.status IN ('Pending', 'In Progress')
          AND pt.due_date <= $1
      `, [cutoff.toUTC().toISO()]); 

      console.log(`🔍 Found ${overdueTasks.rows.length} overdue tasks`);
      if (overdueTasks.rows.length === 0) return;

      for (let task of overdueTasks.rows) {
        await pool.query(`
          UPDATE patient_tasks
          SET status = 'Missed',
              status_history = COALESCE(status_history, '[]'::jsonb) || jsonb_build_object(
                'status', 'Missed',
                'timestamp', NOW()
              )
          WHERE id = $1
        `, [task.id]);

        console.log(task);
        console.log(`🚨 Task ${task.id} for patient ${task.patient_id} marked as missed`);

        if (task.assigned_staff_id) {
          io.to(`user-${task.assigned_staff_id}`).emit('notification', {
            title: 'Task Missed',
            message: `A task for patient ${task.patient_name} was auto-marked as missed. Please review and add a reason.`,
          });
          await pool.query(`
            INSERT INTO notifications (user_id, title, message)
            VALUES ($1, $2, $3)
          `, [task.assigned_staff_id, 'Task Missed', `A task for patient ${task.patient_name} was auto-marked as missed. Please review and add a reason.`]);
          
        }
      }

    } catch (err) {
      console.error("❌ Error in missed task job:", err);
    }
  });
}

module.exports = setupMissedTaskJob;
