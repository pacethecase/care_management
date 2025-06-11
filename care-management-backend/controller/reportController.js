  const pool = require("../models/db");
  const dayjs = require('dayjs');
  const isoWeek = require('dayjs/plugin/isoWeek');
  dayjs.extend(isoWeek);

  const { DateTime } = require('luxon');
    

  // Daily Report Controller
const getDailyReport = async (req, res) => {
  const timezone = req.headers["x-timezone"] || "America/New_York";
  const { adminId } = req.query;
  const { hospital_id } = req.user;
  if (!req.user?.is_approved) {
  return res.status(403).json({ error: "Access denied: user not approved" });
}


  try {
    // Get the end of today in UTC (i.e., include everything due until today)
    const todayEndUTC = DateTime.now().setZone(timezone).endOf("day").toUTC().toISO();

    const values = [todayEndUTC, hospital_id];

    let query = `
      SELECT 
        p.id AS patient_id,
        p.last_name || ', ' || p.first_name AS name,
        t.name AS task_name,
        pt.status,
        pt.due_date,
        json_agg(u.name) FILTER (WHERE u.id IS NOT NULL) AS staff_names,
        u_added.name AS added_by,
        (
          SELECT sh.value ->> 'reason' 
          FROM jsonb_array_elements(pt.status_history) AS sh
          WHERE sh.value ->> 'status' = 'Missed'
          ORDER BY (sh.value ->> 'timestamp')::timestamp DESC
          LIMIT 1
        ) AS missed_reason
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      JOIN tasks t ON pt.task_id = t.id
      LEFT JOIN patient_staff ps ON ps.patient_id = p.id
      LEFT JOIN users u ON u.id = ps.staff_id
      LEFT JOIN users u_added ON u_added.id = p.added_by_user_id AND u_added.is_approved = true
      WHERE pt.status = 'Missed'
        AND pt.due_date <= $1::timestamp
        AND pt.is_visible = TRUE
        AND p.status != 'Discharged'
        AND p.hospital_id = $2
    `;

      if (!req.user.is_admin) {
      values.push(req.user.id);
      query += ` AND EXISTS (
        SELECT 1 FROM patient_staff ps2
        WHERE ps2.patient_id = p.id AND ps2.staff_id = $3
      )`;
    } else if (adminId) {
      values.push(adminId);
      query += ` AND p.added_by_user_id = $3`;
    }

    query += `
      GROUP BY p.id, pt.id, t.id, u_added.name
      ORDER BY pt.due_date ASC
    `;

    const { rows } = await pool.query(query, values);

    if (!rows.length) {
      return res.json({ message: "No missed tasks up to today." });
    }

    return res.json(
      rows.map((row) => ({
        patient_id: row.patient_id,
        patient_name: row.name,
        task_name: row.task_name,
        status: row.status,
        due_date: row.due_date,
        staff_names: row.staff_names || [],
        added_by: row.added_by || "Unknown",
        missed_reason: row.missed_reason || "No reason provided",
      }))
    );
  } catch (err) {
    console.error("❌ Error fetching daily report:", err);
    return res.status(500).json({ error: "Failed to fetch daily report" });
  }
};



  const getPriorityReport = async (req, res) => {
    const { date, adminId } = req.query;
    const { hospital_id } = req.user;
    const timezone = req.headers['x-timezone'] || 'America/New_York';

    if (!date) {
      return res.status(400).json({ error: "Date parameter is required" });
    }
    if (!req.user?.is_approved) {
  return res.status(403).json({ error: "Access denied: user not approved" });
}


    const startOfDayUTC = DateTime.fromISO(date, { zone: timezone }).startOf('day').toUTC().toISO(); 
    const endOfDayUTC = DateTime.fromISO(date, { zone: timezone }).endOf('day').toUTC().toISO();    

    try {
      let query = `
        SELECT 
          p.id AS patient_id,
          p.last_name || ', ' || p.first_name AS name,
          t.name AS task_name,
          pt.due_date,
          pt.status,
          json_agg(u.name) FILTER (WHERE u.id IS NOT NULL) AS staff_names,
          u_added.name AS added_by
        FROM patient_tasks pt
        JOIN patients p ON pt.patient_id = p.id
        JOIN tasks t ON pt.task_id = t.id
        LEFT JOIN patient_staff ps ON ps.patient_id = p.id
        LEFT JOIN users u ON ps.staff_id = u.id
        LEFT JOIN users u_added ON u_added.id = p.added_by_user_id AND u_added.is_approved = true
        WHERE pt.due_date >= $1::timestamp
          AND pt.due_date <= $2::timestamp
          AND pt.status IN ('Pending', 'In Progress', 'Missed')
          AND p.status != 'Discharged'
          AND pt.is_visible = TRUE
          AND p.hospital_id = $3
      `;

          const values = [startOfDayUTC, endOfDayUTC, hospital_id]; // $1, $2, $3
      let paramIndex = 4;

      if (!req.user.is_admin) {
        values.push(req.user.id); // $4
        query += `
          AND EXISTS (
            SELECT 1 FROM patient_staff ps2
            WHERE ps2.patient_id = p.id AND ps2.staff_id = $${paramIndex}
          )`;
      } else if (adminId) {
        values.push(adminId); // $4
        query += ` AND p.added_by_user_id = $${paramIndex}`;
      }


      query += `
        GROUP BY p.id, pt.id, t.id, u_added.name
        ORDER BY 
          CASE pt.status
            WHEN 'Missed' THEN 1
            WHEN 'Pending' THEN 2
            WHEN 'In Progress' THEN 3
            ELSE 4
          END;
      `;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.json({ message: "No tasks due for the selected date." });
      }

      res.json(result.rows.map(row => ({
        patient_id: row.patient_id,
        patient_name: row.name,
        task_name: row.task_name,
        due_date: row.due_date,
        status: row.status,
        staff_names: row.staff_names || [],
        added_by: row.added_by || "Unknown"
      })));
    } catch (err) {
      console.error("❌ Error fetching priority report:", err);
      res.status(500).json({ error: "Failed to fetch priority report" });
    }
  };


  const getTransitionalCareReport = async (req, res) => {
    const patientId = req.params.id;
    const { hospital_id } = req.user;
    const { start_date, end_date } = req.query;
    const timezone = req.headers['x-timezone'] || 'America/New_York';
if (!req.user?.is_approved) {
  return res.status(403).json({ error: "Access denied: user not approved" });
}

    try {
      // Get patient info
      const patientQuery = await pool.query(
        `
        SELECT 
          id, 
          first_name || ' ' || last_name AS name,
          mrn, 
          birth_date,  
          admitted_date,
          CASE
            WHEN is_behavioral THEN 'Behavioral'
            WHEN is_guardianship THEN 'Guardianship'
            WHEN is_ltc THEN 'LTC'
            ELSE 'N/A'
          END AS algorithm
        FROM patients
        WHERE id = $1 AND hospital_id = $2
        `,
        [patientId, hospital_id]
      );

      if (patientQuery.rowCount === 0) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      const patient = patientQuery.rows[0];

      // Build task query
      let taskQueryText = `
        SELECT 
          t.name AS task_name,
          pt.completed_at,
          t.algorithm,
          pt.contact_info
        FROM patient_tasks pt
        JOIN tasks t ON pt.task_id = t.id
        WHERE pt.patient_id = $1 AND pt.status IN ('Completed', 'Delayed Completed')
      `;

      const params = [patientId];
      let paramIndex = 2;

      if (start_date) {
        const startUTC = DateTime.fromISO(start_date, { zone: timezone }).startOf('day').toUTC().toISO();
        taskQueryText += ` AND pt.completed_at >= $${paramIndex++}`;
        params.push(startUTC);
      }

      if (end_date) {
        const endUTC = DateTime.fromISO(end_date, { zone: timezone }).endOf('day').toUTC().toISO();
        taskQueryText += ` AND pt.completed_at <= $${paramIndex++}`;
        params.push(endUTC);
      }

      taskQueryText += ` ORDER BY pt.completed_at DESC`;

      const taskQuery = await pool.query(taskQueryText, params);

      // Grouping logic
      const grouped = {};

      for (const row of taskQuery.rows) {
        const algorithm = row.algorithm || "N/A";

      const key = algorithm;

        if (!grouped[key]) {
          grouped[key] = {
            algorithm,
            tasks_completed: [],
          };
        }

        grouped[key].tasks_completed.push({
          task_name: row.task_name,
          completed_at: dayjs(row.completed_at).format("MM.DD.YY"),
          contact_info: row.contact_info || "N/A"
        });
      }

      const report = {
        patient: {
          name: patient.name,
          mrn: patient.mrn || "N/A",
          dob: dayjs(patient.birth_date).format("MM.DD.YYYY"),
          admitted_date: dayjs(patient.admitted_date).format("MM.DD.YYYY"),
        },
        date_of_report: dayjs().format("MM.DD.YY"),
        sections: Object.values(grouped),
      };

      res.json(report);
    } catch (err) {
      console.error("❌ Error generating transitional report:", err);
      res.status(500).json({ error: "Failed to generate transitional care report" });
    }
  };


  const getHistoricalTimelineReport = async (req, res) => {
    const patientId = req.params.id;
    const { hospital_id } = req.user;
    const { start_date, end_date } = req.query;
    const timezone = req.headers['x-timezone'] || 'America/New_York';
if (!req.user?.is_approved) {
  return res.status(403).json({ error: "Access denied: user not approved" });
}

    try {
      const patientQuery = await pool.query(
        `
        SELECT id, first_name, last_name, birth_date, admitted_date, mrn
        FROM patients
        WHERE id = $1 AND hospital_id = $2
        `,
        [patientId, hospital_id]
      );

      if (patientQuery.rowCount === 0) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const patient = patientQuery.rows[0];
      const admittedDate = dayjs(patient.admitted_date).startOf("day");

      // Build task query with optional UTC date filtering
      let query = `
        SELECT 
          t.name AS task_name,
          pt.completed_at,
          pt.task_note,
          pt.include_note_in_report,
          pt.contact_info,
          pt.status,
          pt.status_history
        FROM patient_tasks pt
        JOIN tasks t ON pt.task_id = t.id
        WHERE pt.patient_id = $1 AND pt.status IN ('Completed','Delayed Completed')
      `;

      const params = [patientId];
      let paramIndex = 2;

      if (start_date) {
        const startUTC = DateTime.fromISO(start_date, { zone: timezone }).startOf('day').toUTC().toISO();
        query += ` AND pt.completed_at >= $${paramIndex++}`;
        params.push(startUTC);
      }

      if (end_date) {
        const endUTC = DateTime.fromISO(end_date, { zone: timezone }).endOf('day').toUTC().toISO();
        query += ` AND pt.completed_at <= $${paramIndex++}`;
        params.push(endUTC);
      }

      query += ` ORDER BY pt.completed_at ASC`;

      const tasksQuery = await pool.query(query, params);

      // Group tasks by week
      const weeksMap = {};

      tasksQuery.rows.forEach((row) => {
        const completedAt = dayjs(row.completed_at);
        const weekNumber = Math.floor(completedAt.diff(admittedDate, "day") / 7) + 1;

        const weekStart = admittedDate.add((weekNumber - 1) * 7, "day");
        const weekEnd = admittedDate.add(weekNumber * 7 - 1, "day");
        const weekKey = `Week #${weekNumber} (${weekStart.format("MM.DD.YY")} - ${weekEnd.format("MM.DD.YY")})`;

        if (!weeksMap[weekKey]) {
          weeksMap[weekKey] = [];
        }

        const isDelayed = row.status === 'Delayed Completed';
        let delayed_reason = null;

        if (isDelayed && Array.isArray(row.status_history)) {
          const lastMissed = [...row.status_history].reverse().find(
            h => h.status === 'Missed' && h.reason
          );
          delayed_reason = lastMissed?.reason || null;
        }

        weeksMap[weekKey].push({
          task_name: row.task_name,
          completed_at: completedAt.format("MM.DD.YY"),
          task_note: row.task_note,
          contact_info: row.contact_info,
          include_note_in_report: row.include_note_in_report,
          delayed: isDelayed,
          delayed_reason
        });
      });

      const timeline = Object.entries(weeksMap).map(([week, tasks]) => ({
        week,
        tasks,
      }));

      res.json({
        patient: {
          name: `${patient.last_name}, ${patient.first_name}`,
          admitted_date: admittedDate.format("MM.DD.YY"),
          mrn: patient.mrn || "N/A",
        },
        timeline,
      });
    } catch (err) {
      console.error("❌ Error generating historical timeline report:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };



  const getProjectedTimelineReport = async (req, res) => {
    if (!req.user?.is_approved) {
  return res.status(403).json({ error: "Access denied: user not approved" });
}

    try {
        const timezone = req.headers['x-timezone'] || 'America/New_York';   
        
      const patientId = req.params.id;
      const { hospital_id } = req.user;

      const result = await pool.query(`
        SELECT 
          pt.id AS patient_task_id,
          pt.task_id,
          t.name AS task_name,
          t.algorithm,
          t.is_non_blocking,
          t.is_repeating,
          pt.status,
          pt.due_date,
          pt.completed_at,
          pt.ideal_due_date,
          pt.status_history,
          p.is_guardianship_emergency,
          p.admitted_date
        FROM patient_tasks pt
        JOIN tasks t ON pt.task_id = t.id
        JOIN patients p ON pt.patient_id = p.id
        WHERE pt.patient_id = $1 AND p.hospital_id = $2
          AND t.algorithm IN ('Guardianship', 'LTC')
        ORDER BY pt.completed_at NULLS LAST, pt.due_date
      `, [patientId, hospital_id]);

      const tasks = result.rows;
      if (tasks.length === 0) return res.json({ projected: {}, actual: {}, grouped: {} });

      const parseStatusHistory = (status, history) => {
        try {
          if (!Array.isArray(history)) return null;
          if (status === "Delayed Completed" || status === "Missed") {
            const lastMissed = [...history].reverse().find(h => h.status === "Missed" && h.reason);
            return lastMissed?.reason || null;
          }
        } catch (err) {
          console.error("❌ Failed to parse status_history:", err);
        }
        return null;
      };

      const grouped = { Guardianship: [], LTC: [] };

      tasks.forEach(task => {
        if (task.is_non_blocking || task.is_repeating) return;

        const reason = parseStatusHistory(task.status, task.status_history);

        grouped[task.algorithm].push({
          task_name: task.task_name,
          status: task.status,
          due_date: task.due_date,
          completed_at: task.completed_at,
          ideal_due_date: task.ideal_due_date,
          missed_reason: reason,
        });
      });

      // Sort: completed → remaining
      for (const alg of ["Guardianship", "LTC"]) {
        grouped[alg] = [
          ...grouped[alg].filter(t => t.status === "Completed" || t.status === "Delayed Completed")
            .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at)),
          ...grouped[alg].filter(t => t.status !== "Completed" && t.status !== "Delayed Completed")
            .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        ];
      }


        const getProjectedCompletionDate = (tasks) => {
          const latest = tasks
            .map(t => t.ideal_due_date)
            .filter(Boolean)
            .map(d =>
              DateTime.fromJSDate(new Date(d), { zone: 'utc' }).setZone(timezone)
            )
            .sort((a, b) => b - a)[0];

          return latest?.toFormat("MMMM d, yyyy"); 
        };


      const projected = {
        Guardianship: getProjectedCompletionDate(grouped.Guardianship,timezone),
        LTC: getProjectedCompletionDate(grouped.LTC,timezone)
      };

      const getActualCompletionDate = (tasks, timezone) => {
        const toLocal = (dt) =>
          DateTime.fromJSDate(new Date(dt), { zone: 'utc' }).setZone(timezone);

        const pending = tasks.filter(
          t => !["Completed", "Delayed Completed"].includes(t.status)
        );

        if (pending.length === 0) {
          // All tasks completed → get latest completed_at in timezone
          const completedDates = tasks
            .map(t => t.completed_at)
            .filter(Boolean)
            .map(toLocal);

          const latestCompleted = completedDates.sort((a, b) => b - a)[0];

          return latestCompleted?.toFormat("MMMM d, yyyy");
        }

        // Some tasks pending → use latest due_date in timezone
        const dueDates = pending
          .map(t => t.due_date)
          .filter(Boolean)
          .map(toLocal);

        const today = DateTime.now().setZone(timezone);

        const latestDue = dueDates.sort((a, b) => b - a)[0];

        const result = (!latestDue || latestDue < today) ? today : latestDue;

        return result.toFormat("MMMM d, yyyy");
      };

      const actual = {
        Guardianship: getActualCompletionDate(grouped.Guardianship,timezone),
        LTC: getActualCompletionDate(grouped.LTC,timezone),
      };

      res.json({ projected, actual, grouped });
    } catch (err) {
      console.error("❌ Projected Timeline Report Error:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };



  module.exports = { getDailyReport, getPriorityReport,getTransitionalCareReport ,getHistoricalTimelineReport,getProjectedTimelineReport};