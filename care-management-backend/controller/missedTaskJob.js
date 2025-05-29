const pool = require("../models/db");
const cron = require("node-cron");
const { DateTime } = require("luxon");

function setupMissedTaskJob(io) {
  // Runs every day at midnight (NY time)
  cron.schedule("0 0 * * *", async () => {
    try {
      const timezone = "America/New_York";
      const now = DateTime.local().setZone(timezone);

      // Get the start of today (00:00:00) so anything before that is overdue
      const todayStart = now.startOf('day');

      console.log("⏳ Running missed task job at", now.toFormat("yyyy-MM-dd HH:mm"));

      const { rows: overdueTasks } = await pool.query(`
        SELECT 
          pt.id, 
          pt.patient_id, 
          COALESCE(pt.due_date, pt.ideal_due_date) AS due_date,
          ps.staff_id AS assigned_staff_id, 
          p.first_name || ' ' || p.last_name AS patient_name
        FROM patient_tasks pt
        JOIN patients p ON pt.patient_id = p.id
        LEFT JOIN patient_staff ps ON pt.patient_id = ps.patient_id
        WHERE pt.status IN ('Pending', 'In Progress')
          AND COALESCE(pt.due_date, pt.ideal_due_date) < $1::timestamptz
      `, [todayStart.toISO()]);

      console.log(`🔍 Found ${overdueTasks.length} overdue tasks`);

      for (let task of overdueTasks) {
        await pool.query(`
          UPDATE patient_tasks
          SET status = 'Missed',
              status_history = COALESCE(status_history, '[]'::jsonb) || jsonb_build_object(
                'status', 'Missed',
                'timestamp', NOW()
              )
          WHERE id = $1
        `, [task.id]);

        console.log(`🚨 Task ${task.id} for patient ${task.patient_id} marked as missed`);

        if (task.assigned_staff_id) {
          const { rows: [statusRow] } = await pool.query(
            `SELECT status FROM patients WHERE id = $1`,
            [task.patient_id]
          );

          if (statusRow?.status === 'Admitted') {
            io.to(`user-${task.assigned_staff_id}`).emit('notification', {
              title: 'Task Missed',
              message: `A task for patient ${task.patient_name} was auto-marked as missed. Please review and add a reason.`,
            });

            await pool.query(`
              INSERT INTO notifications (user_id, title, message)
              VALUES ($1, $2, $3)
            `, [
              task.assigned_staff_id,
              'Task Missed',
              `A task for patient ${task.patient_name} was auto-marked as missed. Please review and add a reason.`
            ]);
          } else {
            console.log(`⚠️ Skipping notification: Patient ${task.patient_id} is not active.`);
          }
        }
      }

    } catch (err) {
      console.error("❌ Error in missed task job:", err);
    }
  });
}

module.exports = setupMissedTaskJob;
