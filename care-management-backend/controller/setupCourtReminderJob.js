const { DateTime } = require("luxon");
const pool = require("../models/db");
const cron = require("node-cron");

function setupCourtReminderJob(io) {
  cron.schedule("0 0 * * *", async () => {
    try {
      const timezone = "America/New_York";
      const now = DateTime.local().setZone(timezone);
      const todayStart = now.startOf('day').toUTC().toJSDate();
      const todayEnd = now.endOf('day').toUTC().toJSDate();

      console.log("📅 Running court reminder job at", now.toISO());

      const { rows: patientsWithCourt } = await pool.query(`
        SELECT 
          p.id AS patient_id,
          p.first_name || ' ' || p.last_name AS patient_name,
          p.guardianship_court_datetime,
          p.ltc_court_datetime,
          ps.staff_id,
          u.is_approved
        FROM patients p
        JOIN patient_staff ps ON p.id = ps.patient_id
        JOIN users u ON u.id = ps.staff_id
        WHERE u.is_approved = true AND (
          (p.guardianship_court_datetime >= $1 AND p.guardianship_court_datetime <= $2)
          OR
          (p.ltc_court_datetime >= $1 AND p.ltc_court_datetime <= $2)
        )
      `, [todayStart, todayEnd]);

      console.log(`🔍 Found ${patientsWithCourt.length} court date patients for today`);

      for (const patient of patientsWithCourt) {
        const types = [
          { type: "Guardianship", datetime: patient.guardianship_court_datetime },
          { type: "LTC", datetime: patient.ltc_court_datetime }
        ];

        for (const { type, datetime } of types) {
          if (!datetime || datetime < todayStart || datetime > todayEnd) continue;

          const formattedTime = DateTime.fromJSDate(new Date(datetime))
            .setZone(timezone)
            .toFormat("h:mm a");

          const message = `Reminder: ${patient.patient_name} has a ${type} court date today at ${formattedTime}.`;

          // Emit socket notification
          io.to(`user-${patient.staff_id}`).emit("notification", {
            title: "Court Date Reminder",
            message,
          });

          // Insert only if not already sent today
          await pool.query(`
            INSERT INTO notifications (user_id, patient_id, title, message)
            SELECT $1, $2, $3, $4
            WHERE NOT EXISTS (
              SELECT 1 FROM notifications
              WHERE user_id = $1 AND patient_id = $2 AND title = $3 AND DATE(created_at) = CURRENT_DATE
            )
          `, [patient.staff_id, patient.patient_id, "Court Date Reminder", message]);

          console.log(`📨 Sent ${type} court reminder for patient ${patient.patient_id}`);
        }
      }

    } catch (err) {
      console.error("❌ Error in court reminder job:", err);
    }
  });
}

module.exports = setupCourtReminderJob;
