// jobs/missedTaskJob.js
const { CronJob } = require("cron");
const { DateTime } = require("luxon");
const pool = require("../models/db");

function setupMissedTaskJob(io) {
  const job = new CronJob(
    "0 * * * *",
    async () => {
      const nowUTC = DateTime.utc().toISO();
      console.log("Running missed task check at UTC:", nowUTC);

      try {
        const { rows: overdueTasks } = await pool.query(`
          SELECT
            pt.id                              AS patient_task_id,
            pt.patient_id,
            pt.due_date,
            p.first_name || ' ' || p.last_name AS patient_name,
            p.hospital_id,
            t.name                             AS task_name
          FROM patient_tasks pt
          JOIN patients p ON pt.patient_id = p.id
          JOIN tasks t    ON pt.task_id    = t.id
          WHERE pt.status IN ('Pending', 'In Progress')
            AND pt.is_visible = TRUE
            AND pt.due_date < NOW()
            AND p.status = 'Admitted'
            AND p.is_archived = FALSE
        `);

        if (!overdueTasks.length) {
          console.log("No overdue tasks found.");
          return;
        }

        console.log(`Found ${overdueTasks.length} overdue tasks to mark as missed.`);

        for (const task of overdueTasks) {
          const client = await pool.connect();
          try {
            await client.query("BEGIN");

            await client.query(
              `UPDATE patient_tasks SET status = 'Missed' WHERE id = $1`,
              [task.patient_task_id]
            );

            await client.query(
              `INSERT INTO patient_task_status_history
                (patient_task_id, old_status, new_status, changed_at, note)
               VALUES ($1, $2, 'Missed', $3, 'Auto-marked missed by system')`,
              [task.patient_task_id, task.status ?? 'Pending', nowUTC]
            );

            await client.query("COMMIT");
            console.log(`Task ${task.patient_task_id} for patient ${task.patient_id} marked as missed.`);

          } catch (err) {
            await client.query("ROLLBACK");
            console.error(`Failed to mark task ${task.patient_task_id} as missed:`, err);
            continue; 
          } finally {
            client.release();
          }

    
          const { rows: staffRows } = await pool.query(
            `SELECT ps.staff_id
             FROM patient_staff ps
             JOIN users u ON ps.staff_id = u.id
             WHERE ps.patient_id = $1
               AND u.is_approved = TRUE`,
            [task.patient_id]
          );

          if (!staffRows.length) {
            console.log(`No approved staff assigned to patient ${task.patient_id} — skipping notification.`);
            continue;
          }

          const title   = "Task Missed";
          const message = `Task "${task.task_name}" for ${task.patient_name} was auto-marked as missed. Please review and add a reason.`;

          for (const { staff_id } of staffRows) {
            const { rows: [notif] } = await pool.query(
              `INSERT INTO notifications
                (user_id, patient_id, patient_task_id, title, message, type)
               VALUES ($1, $2, $3, $4, $5, 'missed')
               RETURNING *`,
              [staff_id, task.patient_id, task.patient_task_id, title, message]
            );

            io?.to?.(`user-${staff_id}`)?.emit("notification", notif);
            console.log(`Notification sent to staff ${staff_id} for task ${task.patient_task_id}.`);
          }
        }

        console.log("Missed task job complete.");

      } catch (err) {
        console.error("Error in missed task job:", err);
      }
    },
    null,
    true,
    "UTC"
  );

  job.start();
}

module.exports = setupMissedTaskJob;