const { CronJob } = require("cron");
const { DateTime } = require("luxon");
const pool = require("../models/db");

function setupCourtReminderJob(io) {
  const job = new CronJob(
    "0 0 * * *",
    async () => {
      try {
        const timezone = "America/New_York";
        const now = DateTime.local().setZone(timezone);
        const todayStart = now.startOf("day").toUTC();
        const todayEnd = now.endOf("day").toUTC();

        console.log("📅 Running court reminder job at", now.toISO());

        const { rows: patientsWithCourt } = await pool.query(`
          SELECT 
            p.id AS patient_id,
            p.first_name || ' ' || p.last_name AS patient_name,
            p.guardianship_court_datetime,
            p.ltc_court_datetime,
            ps.staff_id,
            u.is_approved,
            pt.id AS patient_task_id
          FROM patients p
          JOIN patient_staff ps ON p.id = ps.patient_id
          JOIN users u ON u.id = ps.staff_id
          LEFT JOIN patient_tasks pt 
            ON pt.patient_id = p.id 
           AND pt.task_id IN (
                SELECT id FROM tasks WHERE is_court_date = true
           )
          WHERE p.status = 'Admitted'
            AND u.is_approved = true
            AND (
              (p.guardianship_court_datetime >= $1 AND p.guardianship_court_datetime <= $2)
              OR
              (p.ltc_court_datetime >= $1 AND p.ltc_court_datetime <= $2)
            )
        `, [todayStart.toISO(), todayEnd.toISO()]);

        console.log(`🔍 Found ${patientsWithCourt.length} court date patients for today`);

        for (const patient of patientsWithCourt) {
          const types = [
            { type: "Guardianship", datetime: patient.guardianship_court_datetime },
            { type: "LTC", datetime: patient.ltc_court_datetime }
          ];

          for (const { type, datetime } of types) {
            if (!datetime) continue;

            const dt = DateTime.fromJSDate(new Date(datetime));
            if (dt < todayStart || dt > todayEnd) continue;

            const formattedTime = dt.setZone(timezone).toFormat("h:mm a");

            const title = "Court Date Reminder";
            const message = `Reminder: ${patient.patient_name} has a ${type} court date today at ${formattedTime}.`;


            const { rows: [notif] } = await pool.query(`
              INSERT INTO notifications (user_id, patient_id, patient_task_id, title, message, type)
              SELECT $1, $2, $3, $4, $5, $6
              WHERE NOT EXISTS (
                SELECT 1 FROM notifications
                WHERE user_id = $1 
                  AND patient_id = $2 
                  AND patient_task_id = $3
                  AND type = $6
                  AND DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE $7) = $8
              )
              RETURNING *
            `, [
              patient.staff_id,                
              patient.patient_id,              
              patient.patient_task_id,         
              title,                           
              message,                         
              "court-reminder",                 
              timezone,                       
              now.toFormat("yyyy-MM-dd")        
            ]);

           
            if (notif) {
              io?.to?.(`user-${patient.staff_id}`)?.emit("notification", notif);
              console.log(`📨 Sent ${type} court reminder → user ${patient.staff_id} (patient ${patient.patient_id}, task ${patient.patient_task_id})`);
            } else {
              console.log(`↪︎ Skipped duplicate ${type} reminder for user ${patient.staff_id} (patient ${patient.patient_id})`);
            }
          }
        }
      } catch (err) {
        console.error("❌ Error in court reminder job:", err);
      }
    },
    null,
    true,
    "America/New_York" 
  );

  job.start();
}

module.exports = setupCourtReminderJob;
