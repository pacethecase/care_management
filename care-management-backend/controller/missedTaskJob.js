const pool = require("../models/db");
const cron = require("node-cron");

// Runs every day at 3:00 PM (or tweak as needed)
cron.schedule("0 15 * * *", async () => {
  try {
    console.log("⏳ Running missed task job...");

    // Get overdue tasks (Pending or In Progress) that aren't marked Completed or Missed
    const overdueTasks = await pool.query(`
      SELECT id, patient_id
      FROM patient_tasks 
      WHERE status IN ('Pending', 'In Progress')
        AND due_date::date <= CURRENT_DATE
    `);

    console.log(`🔍 Found ${overdueTasks.rows.length} overdue tasks`);
    if (overdueTasks.rows.length === 0) return;

    for (let task of overdueTasks.rows) {
      // Append to status_history
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
    }

  } catch (err) {
    console.error("❌ Error in missed task job:", err);
  }
});
