const { CronJob } = require("cron");
const { DateTime } = require("luxon");
const pool = require("../models/db");

function setupMissedTaskJob(io) {
  const job = new CronJob(
    "0 0 * * *",
    async () => {
      try {
        const timezone = "America/New_York";
        const now = DateTime.local().setZone(timezone);

        const todayStartUTC = now.startOf("day").toUTC();
        const nowUTC = now.toUTC();

        console.log("⏳ Running missed task job at:", now.toFormat("yyyy-MM-dd HH:mm z"));
        console.log("🔎 Checking tasks due before:", todayStartUTC.toISO());

        const { rows: overdueTasks } = await pool.query(
          `
          SELECT 
            pt.id AS patient_task_id,
            pt.patient_id,
            COALESCE(pt.due_date, pt.ideal_due_date) AS due_date,
            ps.staff_id AS assigned_staff_id,
            p.first_name || ' ' || p.last_name AS patient_name,
            t.name AS task_name
          FROM patient_tasks pt
          JOIN patients p ON pt.patient_id = p.id
          LEFT JOIN patient_staff ps ON pt.patient_id = ps.patient_id
          JOIN tasks t ON pt.task_id = t.id
          WHERE pt.status IN ('Pending', 'In Progress')
             AND pt.is_visible = TRUE
            AND COALESCE(pt.due_date, pt.ideal_due_date) < $1::timestamptz
            AND p.status = 'Admitted'
            AND COALESCE(p.is_archived, false) = false
          `,
          [todayStartUTC.toISO()]
        );

        console.log(`🔍 Found ${overdueTasks.length} overdue tasks`);

        for (const task of overdueTasks) {
          // ✅ use patient_task_id everywhere
          await pool.query(
            `
            UPDATE patient_tasks
            SET status = 'Missed',
                status_history = COALESCE(status_history, '[]'::jsonb) || jsonb_build_object(
                  'status', 'Missed',
                  'timestamp', $2::timestamptz
                )
            WHERE id = $1
            `,
            [task.patient_task_id, nowUTC.toISO()]
          );

          console.log(`🚨 Task ${task.patient_task_id} for patient ${task.patient_id} marked as missed`);

          if (!task.assigned_staff_id) continue;

          const { rows: [staffRow] } = await pool.query(
            `SELECT is_approved FROM users WHERE id = $1`,
            [task.assigned_staff_id]
          );
          if (!staffRow?.is_approved) {
            console.log(`🚫 Skipping notification: Staff ${task.assigned_staff_id} is not approved.`);
            continue;
          }

          const { rows: [statusRow] } = await pool.query(
            `SELECT status FROM patients WHERE id = $1`,
            [task.patient_id]
          );
          if (statusRow?.status !== 'Admitted') {
            console.log(`⚠️ Skipping notification: Patient ${task.patient_id} is not active.`);
            continue;
          }


          const title = 'Task Missed';
          const message = `Task "${task.task_name}" for patient ${task.patient_name} was auto-marked as missed. Please review and add a reason.`;

  
          const { rows: [notif] } = await pool.query(
            `
            INSERT INTO notifications
              (user_id, patient_id, patient_task_id, title, message, type)
            VALUES
              ($1, $2, $3, $4, $5, $6)
            RETURNING *
            `,
            [
              task.assigned_staff_id,
              task.patient_id,
              task.patient_task_id,
              title,
              message,
              'missed'
            ]
          );
          io?.to?.(`user-${task.assigned_staff_id}`)?.emit('notification', notif);
        }
      } catch (err) {
        console.error("❌ Error in missed task job:", err);
      }
    },
    null,
    true,
    "America/New_York"
  );

  job.start();
}

module.exports = setupMissedTaskJob;
