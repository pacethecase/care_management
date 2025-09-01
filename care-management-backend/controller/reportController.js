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
        u_added.name AS added_by
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
         AND COALESCE(p.is_archived, false) = false
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
          AND COALESCE(p.is_archived, false) = false
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
  const client = await pool.connect();
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
        pt.status,
        t.algorithm,
        pt.contact_info,
        pt.task_note
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      WHERE pt.patient_id = $1 AND pt.status IN ('Completed', 'Delayed Completed','Acknowledged')
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

    const taskQuery = await client.query(taskQueryText, params);

    // Grouping logic
    const grouped = {};
    for (const row of taskQuery.rows) {
      const algorithm = row.algorithm || "N/A";
      if (!grouped[algorithm]) {
        grouped[algorithm] = {
          algorithm,
          tasks_completed: [],
        };
      }

      grouped[algorithm].tasks_completed.push({
        task_name: row.task_name,
        completed_at: row.completed_at
          ? dayjs(row.completed_at).format("MM.DD.YY")
          : "N/A",
        contact_info: row.contact_info || "—",
        task_note: row.task_note || "—",
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
  } finally {
    client.release();
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
        WHERE pt.patient_id = $1 AND pt.status IN ('Completed','Delayed Completed','Acknowledged')
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
      const overrides = (
  Array.isArray(row.status_history)
    ? row.status_history
    : row.status_history
    ? JSON.parse(row.status_history)
    : []
)
  .filter((h) => h.status === "Overridden")
  .map((h) => ({
    staff_id: h.staff_id || null,
    reason: h.reason || null,
    timestamp: h.timestamp
      ? DateTime.fromJSDate(new Date(h.timestamp)) 
          .setZone(timezone)                     
          .toFormat("MM.dd.yy HH:mm a")
      : null,
  }));




        weeksMap[weekKey].push({
          task_name: row.task_name,
          completed_at: completedAt.format("MM.DD.YY"),
          task_note: row.task_note,
          contact_info: row.contact_info,
          include_note_in_report: row.include_note_in_report,
          delayed: isDelayed,
          delayed_reason,
          overrides
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
        if (task.is_non_blocking) return;

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

const getLengthOfStaySummary = async (req, res) => {
  const user = req.user;
  const hospitalId = user.hospital_id;
  const isStaff = user.is_staff;
  const staffId = user.id;
  const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
const algorithmFilter = req.query.algorithm || null; 


  const includeDischarged = req.query.includeDischarged === 'true';

  try {
    // Get national average for this hospital
    const { rows: hospitalRows } = await pool.query(
      `SELECT daily_bed_cost FROM hospitals WHERE id = $1`,
      [hospitalId]
    );
    const nationalAvg = hospitalRows[0]?.daily_bed_cost || 2883;

    // Build query
    let query = `
      SELECT
        p.id,
        p.admitted_date,
        p.discharge_date,
        p.created_at,
        p.is_behavioral,
        p.is_guardianship,
        p.is_ltc,
        p.status
      FROM patients p
      ${isStaff ? 'JOIN patient_staff ps ON ps.patient_id = p.id' : ''}
      WHERE p.hospital_id = $1
      ${isStaff ? 'AND ps.staff_id = $2' : ''}
      ${includeDischarged ? '' : 'AND p.status = \'Admitted\''}
      AND COALESCE(p.is_archived, false) = false
    `;
     const queryParams = isStaff ? [hospitalId, staffId] : [hospitalId];
    if (startDate) {
      query += ` AND p.admitted_date >= $${queryParams.length + 1}`;
      queryParams.push(startDate);
    }
    if (endDate) {
      query += ` AND p.admitted_date <= $${queryParams.length + 1}`;
      queryParams.push(endDate);
    }

    // Apply algorithm filter
    if (algorithmFilter) {
      if (algorithmFilter === 'Behavioral') query += ' AND p.is_behavioral = true';
      if (algorithmFilter === 'Guardianship') query += ' AND p.is_guardianship = true';
      if (algorithmFilter === 'LTC') query += ' AND p.is_ltc = true';
    }
   

    const { rows } = await pool.query(query, queryParams);
    const today = new Date();

    const summary = {
      behavioral: { totalDays: 0, count: 0, cost: 0 },
      guardianship: { totalDays: 0, count: 0, cost: 0 },
      ltc: { totalDays: 0, count: 0, cost: 0 }
    };

    for (const row of rows) {
      const admittedDate = new Date(row.admitted_date);
      const dischargeDate = row.discharge_date ? new Date(row.discharge_date) : today;
      const los = Math.max(Math.ceil((dischargeDate - admittedDate) / (1000 * 60 * 60 * 24)), 0);
      const costPerDay = nationalAvg;

      if (row.is_behavioral) {
        summary.behavioral.totalDays += los;
        summary.behavioral.count++;
        summary.behavioral.cost += los * costPerDay;
      }
      if (row.is_guardianship) {
        summary.guardianship.totalDays += los;
        summary.guardianship.count++;
        summary.guardianship.cost += los * costPerDay;
      }
      if (row.is_ltc) {
        summary.ltc.totalDays += los;
        summary.ltc.count++;
        summary.ltc.cost += los * costPerDay;
      }
    }

    for (const type of Object.keys(summary)) {
      const entry = summary[type];
      entry.avgDays = entry.count ? Math.round(entry.totalDays / entry.count) : 0;
    }

    res.json({
      ...summary,
      nationalAverage: Number(nationalAvg)
    });
  } catch (error) {
    console.error("Error generating LOS summary:", error);
    res.status(500).json({ error: "Failed to calculate LOS summary" });
  }
};
const getOpportunityDaysSummary = async (req, res) => {
  const user = req.user;
  const hospitalId = user.hospital_id;
  const isStaff = user.is_staff;
  const staffId = user.id;
  const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
  const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
  const algorithmFilter = req.query.algorithm || null; 

  const includeDischarged = req.query.includeDischarged === 'true';

  const computeTaskDelay = (algoTasks) => {
    if (algoTasks.length === 0) return 0;

    const maxIdealDue = algoTasks
      .filter(t => t.ideal_due_date)
      .map(t => new Date(t.ideal_due_date))
      .sort((a, b) => b - a)[0];

    const now = new Date();

    const maxCompletedAt = algoTasks
      .map(t => {
        if (t.completed_at) return new Date(t.completed_at);
        if (
          (!t.completed_at || t.status === 'Missed' || t.status === 'Pending') &&
          new Date(t.ideal_due_date) < now
        ) {
          return now;
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => b - a)[0];

    if (!maxIdealDue || !maxCompletedAt) return 0;

    const delay = Math.max(
      Math.ceil((maxCompletedAt - maxIdealDue) / (1000 * 60 * 60 * 24)),
      0
    );

    return delay;
  };

  try {
    const { rows: hospitalRows } = await pool.query(
      `SELECT daily_bed_cost FROM hospitals WHERE id = $1`,
      [hospitalId]
    );
    const nationalAvg = hospitalRows[0]?.daily_bed_cost || 2883;

    let patientQuery = `
      SELECT
        p.id,
        p.admitted_date,
        p.created_at,
        p.discharge_date,
        p.is_behavioral,
        p.is_guardianship,
        p.is_ltc,
        p.status
      FROM patients p
      ${isStaff ? 'JOIN patient_staff ps ON ps.patient_id = p.id' : ''}
      WHERE p.hospital_id = $1
      ${isStaff ? 'AND ps.staff_id = $2' : ''}
      ${includeDischarged ? '' : "AND p.status = 'Admitted'"}
      AND COALESCE(p.is_archived, false) = false
    `;

       const patientParams = isStaff ? [hospitalId, staffId] : [hospitalId];
    if (startDate) {
  patientQuery += ` AND p.admitted_date >= $${patientParams.length + 1}`;
  patientParams.push(startDate);
}
if (endDate) {
  patientQuery += ` AND p.admitted_date <= $${patientParams.length + 1}`;
  patientParams.push(endDate);
}

  // Apply algorithm filter
  if (algorithmFilter) {
    if (algorithmFilter === 'Behavioral') patientQuery += ' AND p.is_behavioral = true';
    if (algorithmFilter === 'Guardianship') patientQuery += ' AND p.is_guardianship = true';
    if (algorithmFilter === 'LTC') patientQuery += ' AND p.is_ltc = true';
  }

 
    const { rows: patients } = await pool.query(patientQuery, patientParams);

    const summary = {
      behavioral: { admissionDelay: 0, taskDelay: 0, totalDelay: 0, cost: 0, count: 0 },
      guardianship: { admissionDelay: 0, taskDelay: 0, totalDelay: 0, cost: 0, count: 0 },
      ltc: { admissionDelay: 0, taskDelay: 0, totalDelay: 0, cost: 0, count: 0 },
    };

    for (const patient of patients) {
      const { id, admitted_date, created_at, is_behavioral, is_guardianship, is_ltc } = patient;

      const admissionDelay = Math.max(
        Math.ceil((new Date(created_at) - new Date(admitted_date)) / (1000 * 60 * 60 * 24)),
        0
      );

      const { rows: tasks } = await pool.query(
        `SELECT pt.ideal_due_date, pt.completed_at, pt.status, t.algorithm
         FROM patient_tasks pt
         JOIN tasks t ON pt.task_id = t.id
         WHERE pt.patient_id = $1 AND pt.is_visible = true`,
        [id]
      );

      const behavioralTasks = tasks.filter(t => t.algorithm === 'Behavioral');
      const guardianshipTasks = tasks.filter(t => t.algorithm === 'Guardianship');
      const ltcTasks = tasks.filter(t => t.algorithm === 'LTC');

      const delays = {
        Behavioral: computeTaskDelay(behavioralTasks),
        Guardianship: computeTaskDelay(guardianshipTasks),
        LTC: computeTaskDelay(ltcTasks),
      };

      if (is_behavioral) {
        summary.behavioral.admissionDelay += admissionDelay;
        summary.behavioral.taskDelay += delays.Behavioral;
        summary.behavioral.totalDelay += admissionDelay + delays.Behavioral;
        summary.behavioral.cost += (admissionDelay + delays.Behavioral) * nationalAvg;
        summary.behavioral.count++;
      }

      if (is_guardianship) {
        summary.guardianship.admissionDelay += admissionDelay;
        summary.guardianship.taskDelay += delays.Guardianship;
        summary.guardianship.totalDelay += admissionDelay + delays.Guardianship;
        summary.guardianship.cost += (admissionDelay + delays.Guardianship) * nationalAvg;
        summary.guardianship.count++;
      }

      if (is_ltc) {
        summary.ltc.admissionDelay += admissionDelay;
        summary.ltc.taskDelay += delays.LTC;
        summary.ltc.totalDelay += admissionDelay + delays.LTC;
        summary.ltc.cost += (admissionDelay + delays.LTC) * nationalAvg;
        summary.ltc.count++;
      }
    }

    res.json({
      behavioral: summary.behavioral,
      guardianship: summary.guardianship,
      ltc: summary.ltc,
      nationalAverage: Number(nationalAvg),
    });
  } catch (error) {
    console.error("❌ Opportunity Days Summary Error:", error);
    res.status(500).json({ error: "Failed to calculate Opportunity Days Summary" });
  }
};

const getStaffPerformanceReport = async (req, res) => {
  const { start, end, staffId, taskName, includeDischarged } = req.query;
  const hospitalId = req.user.hospital_id;
  const startDate = DateTime.fromISO(start).toUTC().toISO();
  const endDate = DateTime.fromISO(end).endOf("day").toUTC().toISO();
  const dischargeFilter = includeDischarged === 'true' ? "AND COALESCE(p.is_archived, false) = false" : "AND p.status != 'Discharged'  AND COALESCE(p.is_archived, false) = false";
  try {
    if (staffId && taskName) {
  const summaryQuery = `
    SELECT
      COUNT(DISTINCT pt.id) AS total_tasks,
      COUNT(DISTINCT pt.id) FILTER (WHERE pt.status = 'Missed') AS missed_count,
      COUNT(DISTINCT pt.id) FILTER (
        WHERE pt.status = 'Delayed Completed')
      AS delayed_count,
   COUNT(DISTINCT pt.id) FILTER (WHERE COALESCE(pt.override_count, 0) > 0) AS overridden_count
    FROM patient_tasks pt
    JOIN tasks t ON pt.task_id = t.id
    JOIN patients p ON pt.patient_id = p.id
    JOIN patient_staff ps ON p.id = ps.patient_id
    WHERE ps.staff_id = $1
      AND t.name = $2
      AND p.hospital_id = $3
      AND pt.due_date BETWEEN $4 AND $5
      AND pt.is_visible = TRUE
      ${dischargeFilter}
  `;

  const drilldownQuery = `
    SELECT
      t.name AS task_name,
      p.last_name || ', ' || p.first_name AS patient_name,
      pt.status,
      COALESCE(pt.override_count,0) AS override_count,

      (
        SELECT sh.reason
        FROM jsonb_to_recordset(pt.status_history)
             AS sh(status TEXT, "timestamp" TIMESTAMPTZ, reason TEXT)
        WHERE sh.status = 'Missed'
        ORDER BY sh."timestamp" DESC
        LIMIT 1
      ) AS reason,

      (
        SELECT sh.reason
        FROM jsonb_to_recordset(pt.status_history)
             AS sh(status TEXT, "timestamp" TIMESTAMPTZ, reason TEXT)
        WHERE sh.status IN ('Override','Overridden','Override Applied')
              AND NULLIF(TRIM(sh.reason),'') IS NOT NULL
        ORDER BY sh."timestamp" DESC
        LIMIT 1
      ) AS override_reason,

      (
        SELECT sh."timestamp"
        FROM jsonb_to_recordset(pt.status_history)
             AS sh(status TEXT, "timestamp" TIMESTAMPTZ, reason TEXT)
        WHERE sh.status IN ('Override','Overridden','Override Applied')
        ORDER BY sh."timestamp" DESC
        LIMIT 1
      ) AS last_override_at

    FROM patient_tasks pt
    JOIN tasks t ON pt.task_id = t.id
    JOIN patients p ON pt.patient_id = p.id
    JOIN patient_staff ps ON p.id = ps.patient_id
   WHERE ps.staff_id = $1
  AND t.name = $2
  AND p.hospital_id = $3
  AND pt.due_date BETWEEN $4 AND $5
  AND pt.is_visible = TRUE
  ${dischargeFilter}
  AND (
    pt.status IN ('Missed','Delayed Completed')
    OR (pt.status = 'Pending' AND COALESCE(pt.override_count,0) > 0)
    OR (pt.status = 'Completed' AND COALESCE(pt.override_count,0) > 0)
  )

    
    ORDER BY patient_name
  `;

  const summaryResult = await pool.query(summaryQuery, [
    staffId,
    taskName,
    hospitalId,
    startDate,
    endDate,
  ]);

  const drilldownResult = await pool.query(drilldownQuery, [
    staffId,
    taskName,
    hospitalId,
    startDate,
    endDate,
  ]);

  return res.json({
    type: 'staff-task',
    data: summaryResult.rows[0],
    drilldown: drilldownResult.rows,
  });
}

else if (taskName) {
  // 🔹 Task-specific view
  const taskQuery = `
    SELECT
      t.name AS task_name,
      COUNT(DISTINCT pt.id) AS total_tasks,
      COUNT(DISTINCT pt.id) FILTER (WHERE pt.status = 'Missed') AS missed_count,
      COUNT(DISTINCT pt.id) FILTER (WHERE pt.status = 'Delayed Completed') AS delayed_count,
      COUNT(DISTINCT pt.id) FILTER (WHERE COALESCE(pt.override_count, 0) > 0) AS overridden_count,
      JSON_AGG(DISTINCT u.name) FILTER (WHERE pt.status = 'Missed') AS responsible_staff
    FROM patient_tasks pt
    JOIN tasks t ON pt.task_id = t.id
    JOIN patients p ON pt.patient_id = p.id
    JOIN patient_staff ps ON p.id = ps.patient_id
    JOIN users u ON ps.staff_id = u.id
    WHERE p.hospital_id = $1
      AND pt.due_date BETWEEN $2 AND $3
      ${dischargeFilter}
      AND pt.is_visible = TRUE
      AND t.name = $4
    GROUP BY t.name
  `;

  const taskResult = await pool.query(taskQuery, [
    hospitalId,
    startDate,
    endDate,
    taskName,
  ]);

  const detailQuery = `
    SELECT
      t.name AS task_name,
      p.last_name || ', ' || p.first_name AS patient_name,
      ARRAY_AGG(DISTINCT u.name) AS staff_names,
      pt.ideal_due_date,
      pt.status,
      COALESCE(pt.override_count, 0) AS override_count,
      mr.reason AS missed_reason,
      orr.reason AS override_reason,
      orr.last_override_at
    FROM patient_tasks pt
    JOIN tasks t ON pt.task_id = t.id
    JOIN patients p ON pt.patient_id = p.id
    LEFT JOIN patient_staff ps ON p.id = ps.patient_id
    LEFT JOIN users u ON ps.staff_id = u.id

    -- Last missed reason
    LEFT JOIN LATERAL (
      SELECT sh.reason
      FROM jsonb_to_recordset(pt.status_history)
           AS sh(status TEXT, changed_at TIMESTAMPTZ, reason TEXT)
      WHERE sh.status = 'Missed'
      ORDER BY changed_at DESC
      LIMIT 1
    ) mr ON TRUE


    LEFT JOIN LATERAL (
      SELECT sh.reason, sh."timestamp" AS last_override_at
      FROM jsonb_to_recordset(pt.status_history)
       AS sh(status TEXT, "timestamp" TIMESTAMPTZ, reason TEXT)

      WHERE sh.status IN ('Override','Overridden','Override Applied')
            AND NULLIF(TRIM(sh.reason), '') IS NOT NULL
      ORDER BY sh."timestamp" DESC
      LIMIT 1
    ) orr ON TRUE

    WHERE pt.is_visible = TRUE
      AND (
        pt.status IN ('Missed','Delayed Completed')
        OR (pt.status = 'Pending' AND COALESCE(pt.override_count,0) > 0)
        OR (pt.status = 'Completed' AND COALESCE(pt.override_count,0) > 0)
      )
      AND t.name = $1
      AND pt.due_date BETWEEN $2 AND $3
      AND p.hospital_id = $4
      ${dischargeFilter}

    GROUP BY
      p.id, t.name, pt.ideal_due_date, pt.status,
      pt.override_count, mr.reason, orr.reason, orr.last_override_at
    ORDER BY p.last_name ASC, p.first_name ASC
  `;

  const detailResult = await pool.query(detailQuery, [
    taskName,
    startDate,
    endDate,
    hospitalId,
  ]);

  return res.json({
    type: 'task',
    data: taskResult.rows,       
    drilldown: detailResult.rows 
  });
}

  else if (staffId) {
  // 🔹 Summary for staff
  const summaryQuery = `
    SELECT
      COUNT(*) AS total_tasks,
      COUNT(*) FILTER (WHERE pt.status = 'Missed') AS missed_count,
      COUNT(*) FILTER (
        WHERE pt.status = 'Delayed Completed'
      ) AS delayed_count,
    COUNT(*) FILTER (WHERE COALESCE(pt.override_count, 0) > 0) AS overridden_count
    FROM patient_tasks pt
    JOIN patients p ON pt.patient_id = p.id
    JOIN patient_staff ps ON p.id = ps.patient_id
    WHERE ps.staff_id = $1
      AND p.hospital_id = $2
      AND pt.due_date BETWEEN $3 AND $4
      AND pt.is_visible = TRUE
      ${dischargeFilter}
  `;

  const drilldownQuery = `
    SELECT
      t.name AS task_name,
      p.last_name || ', ' || p.first_name AS patient_name,
          pt.status,
    COALESCE(pt.override_count, 0) AS override_count,


    (
      SELECT sh.reason
      FROM jsonb_to_recordset(pt.status_history)
          AS sh(status TEXT, "timestamp" TIMESTAMPTZ, reason TEXT)
      WHERE sh.status = 'Missed'
      ORDER BY sh."timestamp" DESC
      LIMIT 1
    ) AS reason,


    (
      SELECT sh.reason
      FROM jsonb_to_recordset(pt.status_history)
          AS sh(status TEXT, "timestamp" TIMESTAMPTZ, reason TEXT)
      WHERE sh.status IN ('Override','Overridden','Override Applied')
            AND NULLIF(TRIM(sh.reason), '') IS NOT NULL
      ORDER BY sh."timestamp" DESC
      LIMIT 1
    ) AS override_reason,

    (
      SELECT sh."timestamp"
      FROM jsonb_to_recordset(pt.status_history)
          AS sh(status TEXT, "timestamp" TIMESTAMPTZ, reason TEXT)
      WHERE sh.status IN ('Override','Overridden','Override Applied')
      ORDER BY sh."timestamp" DESC
      LIMIT 1
    ) AS last_override_at
    FROM patient_tasks pt
    JOIN tasks t ON pt.task_id = t.id
    JOIN patients p ON pt.patient_id = p.id
    JOIN patient_staff ps ON p.id = ps.patient_id
    WHERE ps.staff_id = $1
      AND p.hospital_id = $2
      AND pt.due_date BETWEEN $3 AND $4
      AND pt.is_visible = TRUE
      ${dischargeFilter}
    AND (pt.status IN ('Missed','Delayed Completed')
    OR (pt.status = 'Pending' AND COALESCE(pt.override_count,0) > 0)
    OR (pt.status = 'Completed' AND COALESCE(pt.override_count,0) > 0)
)

    ORDER BY t.name, patient_name
  `;

  const summaryResult = await pool.query(summaryQuery, [staffId, hospitalId, startDate, endDate]);
  const drilldownResult = await pool.query(drilldownQuery, [staffId, hospitalId, startDate, endDate]);

  return res.json({
    type: 'staff',
    data: summaryResult.rows[0], // just one row for this staff
    drilldown: drilldownResult.rows,
  });
}
else {
const topMissedTasksQuery = `
  SELECT
    t.name AS task_name,
    COUNT(*) AS total_issues,
    SUM(CASE WHEN pt.status = 'Missed' THEN 1 ELSE 0 END) AS missed_count,
    SUM(CASE WHEN pt.status = 'Delayed Completed' THEN 1 ELSE 0 END) AS delayed_completed_count,
    JSON_AGG(DISTINCT u.name) AS responsible_staff
  FROM patient_tasks pt
  JOIN tasks t ON pt.task_id = t.id
  JOIN patients p ON pt.patient_id = p.id
  JOIN patient_staff ps ON p.id = ps.patient_id
  JOIN users u ON ps.staff_id = u.id
  WHERE pt.status IN ('Missed', 'Delayed Completed')
    AND p.hospital_id = $1
    AND pt.due_date BETWEEN $2 AND $3
    AND pt.is_visible = TRUE
    ${dischargeFilter}
  GROUP BY t.name
  ORDER BY total_issues DESC
  LIMIT 3;
`;

const topLaggingStaffQuery = `
  SELECT
    u.name AS staff_name,
    COUNT(*) FILTER (WHERE pt.status = 'Missed') AS missed_count,
    COUNT(*) FILTER (
      WHERE pt.status IN ('Completed', 'Delayed Completed') AND pt.completed_at > pt.ideal_due_date
    ) AS delayed_count
  FROM users u
  JOIN patient_staff ps ON u.id = ps.staff_id
  JOIN patients p ON ps.patient_id = p.id
  JOIN patient_tasks pt ON pt.patient_id = p.id
  WHERE p.hospital_id = $1
    AND pt.due_date BETWEEN $2 AND $3
    AND pt.is_visible = TRUE
    ${dischargeFilter}
  GROUP BY u.name
  ORDER BY missed_count DESC
  LIMIT 3
`;


    // Default: Patient-level summary
    const patientQuery = `
      SELECT
        p.id AS patient_id,
          p.last_name || ', ' || p.first_name AS patient_name,
        p.admitted_date,
        p.created_at,
        ARRAY_AGG(DISTINCT u.name) AS staff,
   COUNT(DISTINCT pt.id) AS total_tasks,

      COUNT(DISTINCT pt.id) FILTER (
        WHERE pt.status = 'Missed'
      ) AS missed,

      COUNT(DISTINCT pt.id) FILTER (
        WHERE pt.status = 'Pending'
      ) AS pending,

      COUNT(DISTINCT pt.id) FILTER (
        WHERE pt.status = 'Completed' 
      ) AS completed_on_time,

      COUNT(DISTINCT pt.id) FILTER (
        WHERE (pt.status = 'Delayed Completed')
      ) AS delayed_completed,

     COUNT(DISTINCT pt.id) FILTER (WHERE COALESCE(pt.override_count, 0) > 0) AS overridden,

   COUNT(DISTINCT pt.id) FILTER (WHERE t.is_manual = TRUE) AS manual
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      JOIN tasks t ON pt.task_id = t.id
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      WHERE p.hospital_id = $1
        AND pt.due_date BETWEEN $2 AND $3
        AND pt.is_visible = TRUE
        ${dischargeFilter}
    GROUP BY p.id, p.first_name, p.last_name, p.admitted_date, p.created_at
     ORDER BY p.last_name ASC, p.first_name ASC;
    `;

    const result = await pool.query(patientQuery, [hospitalId, startDate, endDate]);
const topTasksResult = await pool.query(topMissedTasksQuery, [hospitalId, startDate, endDate]);
const topStaffResult = await pool.query(topLaggingStaffQuery, [hospitalId, startDate, endDate]);

    return res.json({ type: 'summary', data: result.rows, topMissedTasks: topTasksResult.rows,
  topLaggingStaff: topStaffResult.rows, });
}

  } catch (err) {
    console.error("30-Day Delay Report Error:", err);
    res.status(500).json({ error: "Failed to generate 30-Day Delay Report." });
  }
};

  module.exports = { getDailyReport, getPriorityReport,getTransitionalCareReport ,getHistoricalTimelineReport,getProjectedTimelineReport,getLengthOfStaySummary,getOpportunityDaysSummary, getStaffPerformanceReport};