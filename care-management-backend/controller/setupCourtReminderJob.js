const { DateTime } = require("luxon");
const pool = require("../models/db");
const cron = require("node-cron");

function setupCourtReminderJob(io) {
  cron.schedule("0 0 * * *", async () => {
    try {
      const timezone = "America/New_York";
      const now = DateTime.local().setZone(timezone);
      const todayStart = now.startOf('day');
      const todayEnd = now.endOf('day');

      console.log("📅 Running court reminder job at", now.toISO());

      const { rows: patientsWithCourt } = await pool.query(`
        SELECT 
          p.id AS patient_id,
          p.first_name || ' ' || p.last_name AS patient_name,
          p.guardianship_court_datetime,
          p.ltc_court_datetime,
          ps.staff_id
        FROM patients p
        JOIN patient_staff ps ON p.id = ps.patient_id
        WHERE (
          (p.guardianship_court_datetime >= $1 AND p.guardianship_court_datetime <= $2)
          OR
          (p.ltc_court_datetime >= $1 AND p.ltc_court_datetime <= $2)
        )
      `, [todayStart.toISO(), todayEnd.toISO()]);

      console.log(`🔍 Found ${patientsWithCourt.length} court date patients for today`);
for (const patient of patientsWithCourt) {
  const courtTime = patient.guardianship_court_datetime || patient.ltc_court_datetime;

  const formattedTime = courtTime
    ? DateTime.fromJSDate(new Date(courtTime)).setZone(timezone).toFormat("h:mm a")
    : "Unknown";

  const message = `Reminder: ${patient.patient_name} has a court date scheduled today at ${formattedTime}.`;

  io.to(`user-${patient.staff_id}`).emit("notification", {
    title: "Court Date Reminder",
    message,
  });

  await pool.query(
    `INSERT INTO notifications (user_id, patient_id, title, message)
     VALUES ($1, $2, $3, $4)`,
    [patient.staff_id, patient.patient_id, "Court Date Reminder", message]
  );

  console.log(`📨 Sent court reminder for patient ${patient.patient_id}`);
}


    } catch (err) {
      console.error("❌ Error in court reminder job:", err);
    }
  });
}

module.exports = setupCourtReminderJob;
