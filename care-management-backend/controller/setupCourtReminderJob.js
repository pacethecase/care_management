// jobs/courtReminderJob.js
const { CronJob } = require("cron");
const { DateTime } = require("luxon");
const pool = require("../models/db");

function setupCourtReminderJob(io) {
  const job = new CronJob(
    "0 * * * *",
    async () => {
      console.log("Running court reminder check at UTC:", DateTime.utc().toISO());
      try {
        const nowUTC = DateTime.utc();
        const from = nowUTC.toISO();
        const to   = nowUTC.plus({ hours: 24 }).toISO();

        // Find all admitted patients with a court date in the next 24 hours
        const { rows: patients } = await pool.query(`
          SELECT
            p.id                                AS patient_id,
            p.first_name || ' ' || p.last_name  AS patient_name,
            p.hospital_id,
            p.guardianship_court_date,
            p.ltc_court_date,
            h.timezone,
            ps.staff_id
          FROM patients p
          JOIN hospitals h      ON p.hospital_id  = h.id
          JOIN patient_staff ps ON p.id           = ps.patient_id
          JOIN users u          ON ps.staff_id    = u.id
          WHERE p.status = 'Admitted'
            AND p.is_archived = FALSE
            AND u.is_approved = TRUE
            AND (
              (p.guardianship_court_date >= $1 AND p.guardianship_court_date <= $2)
              OR
              (p.ltc_court_date >= $1 AND p.ltc_court_date <= $2)
            )
        `, [from, to]);

        if (!patients.length) {
          console.log("No upcoming court dates found.");
          return;
        }

        console.log(`Found ${patients.length} upcoming court date(s).`);

        for (const row of patients) {
          const {
            patient_id, patient_name, timezone, staff_id,
            guardianship_court_date, ltc_court_date,
          } = row;

          // Handle guardianship court date
          if (guardianship_court_date) {
            const courtTimeLocal = DateTime.fromJSDate(new Date(guardianship_court_date), { zone: "utc" })
              .setZone(timezone)
              .toFormat("MMM dd, yyyy h:mm a");

            const todayLocalDate = DateTime.utc().setZone(timezone).toISODate();
            const title   = "Court Date Reminder";
            const message = `Reminder: ${patient_name} has a Guardianship court date on ${courtTimeLocal}.`;

            const { rows: [notif] } = await pool.query(`
              INSERT INTO notifications
                (user_id, patient_id, title, message, type)
              SELECT $1, $2, $3, $4, 'court-reminder'
              WHERE NOT EXISTS (
                SELECT 1 FROM notifications
                WHERE user_id    = $1
                  AND patient_id = $2
                  AND type       = 'court-reminder'
                  AND message    LIKE '%Guardianship%'
                  AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE $5)::date = $6::date
              )
              RETURNING *
            `, [staff_id, patient_id, title, message, timezone, todayLocalDate]);

            if (notif) {
              io?.to?.(`user-${staff_id}`)?.emit("notification", notif);
              console.log(`Guardianship court reminder → staff ${staff_id} for patient ${patient_id}`);
            } else {
              console.log(`Skipped duplicate Guardianship reminder → staff ${staff_id} patient ${patient_id}`);
            }
          }

          // Handle LTC court date
          if (ltc_court_date) {
            const courtTimeLocal = DateTime.fromJSDate(new Date(ltc_court_date), { zone: "utc" })
              .setZone(timezone)
              .toFormat("MMM dd, yyyy h:mm a");

            const todayLocalDate = DateTime.utc().setZone(timezone).toISODate();
            const title   = "Court Date Reminder";
            const message = `Reminder: ${patient_name} has an LTC court date on ${courtTimeLocal}.`;

            const { rows: [notif] } = await pool.query(`
              INSERT INTO notifications
                (user_id, patient_id, title, message, type)
              SELECT $1, $2, $3, $4, 'court-reminder'
              WHERE NOT EXISTS (
                SELECT 1 FROM notifications
                WHERE user_id    = $1
                  AND patient_id = $2
                  AND type       = 'court-reminder'
                  AND message    LIKE '%LTC%'
                  AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE $5)::date = $6::date
              )
              RETURNING *
            `, [staff_id, patient_id, title, message, timezone, todayLocalDate]);

            if (notif) {
              io?.to?.(`user-${staff_id}`)?.emit("notification", notif);
              console.log(`LTC court reminder → staff ${staff_id} for patient ${patient_id}`);
            } else {
              console.log(`Skipped duplicate LTC reminder → staff ${staff_id} patient ${patient_id}`);
            }
          }
        }

        console.log("Court reminder job complete.");
      } catch (err) {
        console.error("Error in court reminder job:", err);
      }
    },
    null,
    true,
    "UTC"
  );

  job.start();
}

module.exports = setupCourtReminderJob;