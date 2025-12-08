  const pool = require("../models/db");
  const dayjs = require('dayjs');
  const isoWeek = require('dayjs/plugin/isoWeek');
  dayjs.extend(isoWeek);

  const { DateTime } = require('luxon');
const getHospitalFilter = (req) => {
  const user = req.user;

  const isSuper = user.is_super_admin;
  const isAdmin = user.is_admin;
  const isStaff = user.is_staff;

  const selectedHospital = req.query.hospitalId ? Number(req.query.hospitalId) : null;
  const orgId = Number(user.organization_id);

  if (isSuper) {
    if (selectedHospital) {
      return {
        sql: "p.hospital_id = $1",
        params: [selectedHospital],
        staffFilter: false
      };
    }

    return {
      sql: "p.hospital_id IN (SELECT id FROM hospitals WHERE organization_id = $1)",
      params: [orgId],
      staffFilter: false
    };
  }

  if (isAdmin) {
    return {
      sql: "p.hospital_id = $1",
      params: [Number(user.hospital_id)],
      staffFilter: false
    };
  }

  return {
    sql: "p.hospital_id = $1",
    params: [Number(user.hospital_id)],
    staffFilter: true
  };
};

const getDailyReport = async (req, res) => {
  const timezone = req.headers["x-timezone"] || "America/New_York";
  const { adminId } = req.query;

  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: user not approved" });
  }

  try {
    const todayEndUTC = DateTime.now()
      .setZone(timezone)
      .endOf("day")
      .toUTC()
      .toISO();


    const { sql: hospitalSQL, params: hospitalParams, staffFilter } = getHospitalFilter(req);
    const values = [todayEndUTC, ...hospitalParams];
    let paramIndex = values.length + 1;

    let query = `
      SELECT 
        p.id AS patient_id,
        p.last_name || ', ' || p.first_name AS name,
        t.name AS task_name,
        pt.status,
        pt.due_date,
        json_agg(DISTINCT u.name) FILTER (WHERE u.id IS NOT NULL) AS staff_names,
        u_added.name AS added_by
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      JOIN tasks t ON pt.task_id = t.id
      LEFT JOIN patient_staff ps ON ps.patient_id = p.id
      LEFT JOIN users u ON u.id = ps.staff_id
      LEFT JOIN users u_added 
        ON u_added.id = p.added_by_user_id 
       AND u_added.is_approved = true

      WHERE pt.status = 'Missed'
        AND pt.is_visible = TRUE
        AND pt.due_date <= $1::timestamp
        AND p.status != 'Discharged'
        AND COALESCE(p.is_archived, false) = false
        AND ${hospitalSQL.replace(/\$(\d+)/g, (_, i) => `$${Number(i) + 1}`)}
    `;

    if (staffFilter) {
      values.push(req.user.id);
      query += `
        AND EXISTS (
          SELECT 1 FROM patient_staff ps2
          WHERE ps2.patient_id = p.id
            AND ps2.staff_id = $${paramIndex}
        )
      `;
      paramIndex++;
    }
    if (adminId) {
      values.push(Number(adminId));
      query += ` AND p.added_by_user_id = $${paramIndex}`;
      paramIndex++;
    }
    query += `
      GROUP BY p.id, pt.id, t.id, u_added.name
      ORDER BY pt.due_date ASC
    `;

    const { rows } = await pool.query(query, values);

    return res.json(
      rows.map((row) => ({
        patient_id: row.patient_id,
        patient_name: row.name,
        task_name: row.task_name,
        status: row.status,
        due_date: row.due_date,
        staff_names: row.staff_names || [],
        added_by: row.added_by || "Unknown",
      }))
    );

  } catch (err) {
    console.error("❌ Error fetching daily report:", err);
    return res.status(500).json({ error: "Failed to fetch daily report" });
  }
};



const getPriorityReport = async (req, res) => {
  const { date, adminId } = req.query;
  const timezone = req.headers["x-timezone"] || "America/New_York";

  if (!date) {
    return res.status(400).json({ error: "Date parameter is required" });
  }

  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: user not approved" });
  }

  try {
    const startOfDayUTC = DateTime.fromISO(date, { zone: timezone })
      .startOf("day")
      .toUTC()
      .toISO();

    const endOfDayUTC = DateTime.fromISO(date, { zone: timezone })
      .endOf("day")
      .toUTC()
      .toISO();

  
    const hospitalFilter = getHospitalFilter(req);

    let values = [startOfDayUTC, endOfDayUTC];
    let paramIndex = 1;
    hospitalFilter.params.forEach(p => values.push(p));
    const hospitalOffset = paramIndex + hospitalFilter.params.length;

    let query = `
      SELECT 
        p.id AS patient_id,
        p.last_name || ', ' || p.first_name AS name,
        t.name AS task_name,
        pt.due_date,
        pt.status,
        json_agg(DISTINCT u.name) FILTER (WHERE u.id IS NOT NULL) AS staff_names,
        u_added.name AS added_by
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      JOIN tasks t ON pt.task_id = t.id
      LEFT JOIN patient_staff ps ON ps.patient_id = p.id
      LEFT JOIN users u ON ps.staff_id = u.id
      LEFT JOIN users u_added 
        ON u_added.id = p.added_by_user_id 
       AND u_added.is_approved = true

      WHERE pt.due_date >= $1::timestamp
        AND pt.due_date <= $2::timestamp
        AND pt.status IN ('Pending', 'In Progress', 'Missed')
        AND p.status != 'Discharged'
        AND COALESCE(p.is_archived, false) = false
        AND pt.is_visible = TRUE
        AND ${hospitalFilter.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 2}`)}
    `;

    paramIndex = 2 + hospitalFilter.params.length;

    if (hospitalFilter.staffFilter) {
      paramIndex++;
      values.push(req.user.id);
      query += `
        AND EXISTS (
          SELECT 1 FROM patient_staff ps2
          WHERE ps2.patient_id = p.id
            AND ps2.staff_id = $${paramIndex}
        )
      `;
    }

    if (adminId) {
      paramIndex++;
      values.push(Number(adminId));
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

    const { rows } = await pool.query(query, values);

    return res.json(rows.map(row => ({
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
    return res.status(500).json({ error: "Failed to fetch priority report" });
  }
};


const getTransitionalCareReport = async (req, res) => {
  const client = await pool.connect();
  const patientId = Number(req.params.id);
  const { start_date, end_date } = req.query;
  const timezone = req.headers["x-timezone"] || "America/New_York";

  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: user not approved" });
  }

  try {

    const hospitalFilter = getHospitalFilter(req);
    let patientQuery = `
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
      FROM patients p
      WHERE p.id = $1
        AND ${hospitalFilter.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 1}`)}
    `;

    const patientParams = [patientId, ...hospitalFilter.params];
    const patientResult = await client.query(patientQuery, patientParams);

    if (patientResult.rowCount === 0) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const patient = patientResult.rows[0];

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
      WHERE pt.patient_id = $1 
        AND pt.status IN ('Completed', 'Delayed Completed', 'Acknowledged')
    `;

    const params = [patientId];
    let paramIndex = 2;

    if (start_date) {
      const startUTC = DateTime.fromISO(start_date, { zone: timezone })
        .startOf("day")
        .toUTC()
        .toISO();

      taskQueryText += ` AND pt.completed_at >= $${paramIndex++}`;
      params.push(startUTC);
    }

    if (end_date) {
      const endUTC = DateTime.fromISO(end_date, { zone: timezone })
        .endOf("day")
        .toUTC()
        .toISO();

      taskQueryText += ` AND pt.completed_at <= $${paramIndex++}`;
      params.push(endUTC);
    }

    taskQueryText += ` ORDER BY pt.completed_at DESC`;

    const taskResult = await client.query(taskQueryText, params);
    const grouped = {};
    for (const row of taskResult.rows) {
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
  const patientId = Number(req.params.id);
  const { start_date, end_date } = req.query;
  const timezone = req.headers["x-timezone"] || "America/New_York";

  if (!req.user?.is_approved) {
    return res.status(403).json({ error: "Access denied: user not approved" });
  }

  try {
    const hospitalFilter = getHospitalFilter(req);
    let patientQuery = `
      SELECT 
        p.id,
        p.first_name,
        p.last_name,
        p.birth_date,
        p.admitted_date,
        p.mrn
      FROM patients p
      WHERE p.id = $1
        AND ${hospitalFilter.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + 1}`)}
    `;

    const patientParams = [patientId, ...hospitalFilter.params];
    const patientResult = await pool.query(patientQuery, patientParams);

    if (patientResult.rowCount === 0) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const patient = patientResult.rows[0];
    const admittedDate = dayjs(patient.admitted_date).startOf("day");

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
      WHERE pt.patient_id = $1 
        AND pt.status IN ('Completed','Delayed Completed','Acknowledged')
    `;

    const params = [patientId];
    let paramIndex = 2;
    if (start_date) {
      const startUTC = DateTime.fromISO(start_date, { zone: timezone })
        .startOf("day")
        .toUTC()
        .toISO();
      query += ` AND pt.completed_at >= $${paramIndex++}`;
      params.push(startUTC);
    }

    if (end_date) {
      const endUTC = DateTime.fromISO(end_date, { zone: timezone })
        .endOf("day")
        .toUTC()
        .toISO();
      query += ` AND pt.completed_at <= $${paramIndex++}`;
      params.push(endUTC);
    }

    query += ` ORDER BY pt.completed_at ASC`;

    const tasksQuery = await pool.query(query, params);


    const weeksMap = {};

    tasksQuery.rows.forEach((row) => {
      const completedAt = dayjs(row.completed_at);
      const weekNumber = Math.floor(completedAt.diff(admittedDate, "day") / 7) + 1;

      const weekStart = admittedDate.add((weekNumber - 1) * 7, "day");
      const weekEnd = admittedDate.add(weekNumber * 7 - 1, "day");

      const weekKey = `Week #${weekNumber} (${weekStart.format("MM.DD.YY")} - ${weekEnd.format("MM.DD.YY")})`;

      if (!weeksMap[weekKey]) weeksMap[weekKey] = [];

      const isDelayed = row.status === "Delayed Completed";
      let delayed_reason = null;

      if (isDelayed) {
        const history =
          Array.isArray(row.status_history)
            ? row.status_history
            : row.status_history
            ? JSON.parse(row.status_history)
            : [];

        const lastMissed = [...history].reverse().find(
          h => h.status === "Missed" && h.reason
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
        .filter(h => h.status === "Overridden")
        .map(h => ({
          staff_id: h.staff_id || null,
          reason: h.reason || null,
          timestamp: h.timestamp
            ? DateTime.fromJSDate(new Date(h.timestamp))
                .setZone(timezone)
                .toFormat("MM.dd.yy hh:mm a")
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

  const timezone = req.headers["x-timezone"] || "America/New_York";
  const patientId = Number(req.params.id);

  try {
    const hospitalFilter = getHospitalFilter(req);

    // Base params
    let values = [patientId];
    let paramIndex = 1;

    // Hospital filter params
    hospitalFilter.params.forEach(p => values.push(p));
    paramIndex = values.length + 1;

    // Build SQL
    let query = `
      SELECT 
        pt.id AS patient_task_id,
        pt.version,
        pt.updated_at,
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
      WHERE pt.patient_id = $1
        AND ${hospitalFilter.sql.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 1}`)}
        AND t.algorithm IN ('Guardianship', 'LTC')
    `;

    // Staff restriction
    if (hospitalFilter.staffFilter) {
      values.push(req.user.id);
      query += `
        AND EXISTS (
          SELECT 1 FROM patient_staff ps
          WHERE ps.patient_id = p.id
            AND ps.staff_id = $${paramIndex}
        )
      `;
      paramIndex++;
    }

    query += `
      ORDER BY pt.completed_at NULLS LAST, pt.due_date
    `;

    const result = await pool.query(query, values);
    const tasks = result.rows;

    if (!tasks.length) return res.json({ projected: {}, actual: {}, grouped: {} });

    const parseStatusHistory = (status, history) => {
      try {
        if (!Array.isArray(history)) return null;
        if (["Delayed Completed", "Missed"].includes(status)) {
          const lastMissed = [...history].reverse().find(h => h.status === "Missed" && h.reason);
          return lastMissed?.reason || null;
        }
      } catch (err) {
        console.error("❌ status_history parse error:", err);
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

    // Sort completed first
    for (const alg of ["Guardianship", "LTC"]) {
      grouped[alg] = [
        ...grouped[alg]
          .filter(t => ["Completed", "Delayed Completed"].includes(t.status))
          .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at)),
        ...grouped[alg]
          .filter(t => !["Completed", "Delayed Completed"].includes(t.status))
          .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      ];
    }

    const getProjectedCompletionDate = (tasks) => {
      const latest = tasks
        .map(t => t.ideal_due_date)
        .filter(Boolean)
        .map(d => DateTime.fromJSDate(new Date(d), { zone: "utc" }).setZone(timezone))
        .sort((a, b) => b - a)[0];

      return latest?.toFormat("MMMM d, yyyy");
    };

    const projected = {
      Guardianship: getProjectedCompletionDate(grouped.Guardianship),
      LTC: getProjectedCompletionDate(grouped.LTC)
    };

    const getActualCompletionDate = (tasks) => {
      const toLocal = dt =>
        DateTime.fromJSDate(new Date(dt), { zone: "utc" }).setZone(timezone);

      const pending = tasks.filter(
        t => !["Completed", "Delayed Completed"].includes(t.status)
      );

      if (!pending.length) {
        const completed = tasks
          .map(t => t.completed_at)
          .filter(Boolean)
          .map(toLocal)
          .sort((a, b) => b - a)[0];
        return completed?.toFormat("MMMM d, yyyy");
      }

      const dueDates = pending
        .map(t => t.due_date)
        .filter(Boolean)
        .map(toLocal);

      const today = DateTime.now().setZone(timezone);
      const latestDue = dueDates.sort((a, b) => b - a)[0];

      return (!latestDue || latestDue < today ? today : latestDue).toFormat("MMMM d, yyyy");
    };

    const actual = {
      Guardianship: getActualCompletionDate(grouped.Guardianship),
      LTC: getActualCompletionDate(grouped.LTC),
    };

    res.json({ projected, actual, grouped });

  } catch (err) {
    console.error("❌ Projected Timeline Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


  const getLengthOfStaySummary = async (req, res) => {
  try {
    const user = req.user;
    const isStaff = user.is_staff;
    const staffId = user.id;

    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const includeDischarged = req.query.includeDischarged === "true";
    const algorithmFilter = req.query.algorithm || null;

    // ---- Get hospital filtering logic ----
    const { sql: hospitalSQL, params: hospitalParams, staffFilter } = getHospitalFilter(req);

    // ---- FIX: Get hospital IDs for nationalAvg ----
    let hospitalIdQuery = `
      SELECT DISTINCT p.hospital_id 
      FROM patients p 
      WHERE ${hospitalSQL}
      LIMIT 1
    `;

    const hospitalIdResult = await pool.query(hospitalIdQuery, hospitalParams);
    const hospitalId = hospitalIdResult.rows[0]?.hospital_id;

    const costQuery = await pool.query(
      `SELECT daily_room_cost FROM hospitals WHERE id = $1`,
      [hospitalId]
    );

    const nationalAvg = costQuery.rows[0]?.daily_room_cost || 2883;

    // ---- MAIN QUERY ----
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
      ${staffFilter ? "JOIN patient_staff ps ON ps.patient_id = p.id" : ""}
      WHERE ${hospitalSQL}
      AND COALESCE(p.is_archived, false) = false
      ${!includeDischarged ? "AND p.status = 'Admitted'" : ""}
      ${staffFilter ? "AND ps.staff_id = $STAFF" : ""}
    `;

    let params = [...hospitalParams];

    // STAFF filter parameter
    if (staffFilter) {
      query = query.replace("$STAFF", "$" + (params.length + 1));
      params.push(staffId);
    }

    // DATE filters
    if (startDate) {
      query += ` AND p.admitted_date >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND p.admitted_date <= $${params.length + 1}`;
      params.push(endDate);
    }

    // Algorithm filter
    if (algorithmFilter) {
      if (algorithmFilter === "Behavioral") query += " AND p.is_behavioral = true";
      if (algorithmFilter === "Guardianship") query += " AND p.is_guardianship = true";
      if (algorithmFilter === "LTC") query += " AND p.is_ltc = true";
    }

    const { rows } = await pool.query(query, params);
    const today = new Date();

    const summary = {
      behavioral: { totalDays: 0, count: 0, cost: 0 },
      guardianship: { totalDays: 0, count: 0, cost: 0 },
      ltc: { totalDays: 0, count: 0, cost: 0 }
    };

    for (const row of rows) {
      const admitted = new Date(row.admitted_date);
      const discharged = row.discharge_date ? new Date(row.discharge_date) : today;

      const los = Math.max(Math.ceil((discharged - admitted) / 86400000), 0);

      if (row.is_behavioral) {
        summary.behavioral.totalDays += los;
        summary.behavioral.count++;
        summary.behavioral.cost += los * nationalAvg;
      }
      if (row.is_guardianship) {
        summary.guardianship.totalDays += los;
        summary.guardianship.count++;
        summary.guardianship.cost += los * nationalAvg;
      }
      if (row.is_ltc) {
        summary.ltc.totalDays += los;
        summary.ltc.count++;
        summary.ltc.cost += los * nationalAvg;
      }
    }

    // Add averages
    for (const key of Object.keys(summary)) {
      const entry = summary[key];
      entry.avgDays = entry.count ? Math.round(entry.totalDays / entry.count) : 0;
    }

    res.json({
      ...summary,
      nationalAverage: Number(nationalAvg)
    });

  } catch (err) {
    console.error("❌ LOS Summary Error:", err);
    res.status(500).json({ error: "Failed to calculate LOS summary" });
  }
};



const getOpportunityDaysSummary = async (req, res) => {
  try {
    const user = req.user;
    if (!user?.is_approved) {
      return res.status(403).json({ error: "Access denied: user not approved" });
    }

    const includeDischarged = req.query.includeDischarged === "true";
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const algorithmFilter = req.query.algorithm || null;

    // ---- Unified hospital filtering (same as LOS) ----
    const { sql: hospitalSQL, params: hospitalParams, staffFilter } = getHospitalFilter(req);

    // ---- Get national average using exact same logic as LOS ----
    const hospitalIdQuery = `
      SELECT DISTINCT p.hospital_id 
      FROM patients p 
      WHERE ${hospitalSQL}
      LIMIT 1
    `;

    const hospitalIdResult = await pool.query(hospitalIdQuery, hospitalParams);
    const hospitalId = hospitalIdResult.rows[0]?.hospital_id;

    const costQuery = await pool.query(
      `SELECT daily_room_cost FROM hospitals WHERE id = $1`,
      [hospitalId]
    );

    const nationalAvg = costQuery.rows[0]?.daily_room_cost || 2883;

    // -------------------------------------------------
    // FETCH PATIENTS — same logic as LengthOfStay
    // -------------------------------------------------
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
      ${staffFilter ? "JOIN patient_staff ps ON ps.patient_id = p.id" : ""}
      WHERE ${hospitalSQL}
      AND COALESCE(p.is_archived, false) = false
      ${!includeDischarged ? "AND p.status = 'Admitted'" : ""}
      ${staffFilter ? "AND ps.staff_id = $STAFF" : ""}
    `;

    let params = [...hospitalParams];

    // staff parameter
    if (staffFilter) {
      patientQuery = patientQuery.replace("$STAFF", "$" + (params.length + 1));
      params.push(user.id);
    }

    // date filters
    if (startDate) {
      patientQuery += ` AND p.admitted_date >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      patientQuery += ` AND p.admitted_date <= $${params.length + 1}`;
      params.push(endDate);
    }

    // algorithm filter
    if (algorithmFilter) {
      if (algorithmFilter === "Behavioral") patientQuery += " AND p.is_behavioral = true";
      if (algorithmFilter === "Guardianship") patientQuery += " AND p.is_guardianship = true";
      if (algorithmFilter === "LTC") patientQuery += " AND p.is_ltc = true";
    }

    const { rows: patients } = await pool.query(patientQuery, params);

    // --------------------------------------------------
    // SUMMARIES
    // --------------------------------------------------
    const summary = {
      behavioral: { admissionDelay: 0, taskDelay: 0, totalDelay: 0, cost: 0, count: 0 },
      guardianship: { admissionDelay: 0, taskDelay: 0, totalDelay: 0, cost: 0, count: 0 },
      ltc: { admissionDelay: 0, taskDelay: 0, totalDelay: 0, cost: 0, count: 0 },
    };

    // ---- TASK DELAY CALCULATOR ----
    const computeTaskDelay = (tasks) => {
      if (!tasks.length) return 0;

      const now = new Date();

      const idealMax = tasks
        .filter(t => t.ideal_due_date)
        .map(t => new Date(t.ideal_due_date))
        .sort((a, b) => b - a)[0];

      const compMax = tasks
        .map(t => {
          if (t.completed_at) return new Date(t.completed_at);

          if (new Date(t.ideal_due_date) < now)
            return now;

          return null;
        })
        .filter(Boolean)
        .sort((a, b) => b - a)[0];

      if (!idealMax || !compMax) return 0;

      return Math.max(
        Math.ceil((compMax - idealMax) / (1000 * 60 * 60 * 24)),
        0
      );
    };

    // --------------------------------------------------
    // PROCESS EACH PATIENT
    // --------------------------------------------------
    for (const p of patients) {
      const admitted = new Date(p.admitted_date);
      const created = new Date(p.created_at);

      const admissionDelay = Math.max(
        Math.ceil((created - admitted) / 86400000),
        0
      );

      const { rows: tasks } = await pool.query(
        `
        SELECT pt.ideal_due_date, pt.completed_at, pt.status, t.algorithm
        FROM patient_tasks pt
        JOIN tasks t ON pt.task_id = t.id
        WHERE pt.patient_id = $1 AND pt.is_visible = true
        `,
        [p.id]
      );

      const delays = {
        Behavioral: computeTaskDelay(tasks.filter(t => t.algorithm === 'Behavioral')),
        Guardianship: computeTaskDelay(tasks.filter(t => t.algorithm === 'Guardianship')),
        LTC: computeTaskDelay(tasks.filter(t => t.algorithm === 'LTC')),
      };

      // ---- Assign to correct bucket ----
      if (p.is_behavioral) {
        summary.behavioral.admissionDelay += admissionDelay;
        summary.behavioral.taskDelay += delays.Behavioral;
        summary.behavioral.totalDelay += admissionDelay + delays.Behavioral;
        summary.behavioral.cost += (admissionDelay + delays.Behavioral) * nationalAvg;
        summary.behavioral.count++;
      }

      if (p.is_guardianship) {
        summary.guardianship.admissionDelay += admissionDelay;
        summary.guardianship.taskDelay += delays.Guardianship;
        summary.guardianship.totalDelay += admissionDelay + delays.Guardianship;
        summary.guardianship.cost += (admissionDelay + delays.Guardianship) * nationalAvg;
        summary.guardianship.count++;
      }

      if (p.is_ltc) {
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
    console.error("❌ Opportunity Summary Error:", error);
    res.status(500).json({ error: "Failed to calculate Opportunity Days Summary" });
  }
};

const getStaffPerformanceReport = async (req, res) => {
  try {
    const user = req.user;
    const { sql: hospitalSQL, params: hospitalParams, staffFilter } = getHospitalFilter(req);

    const { start, end, staffId: staffQueryId, taskName, includeDischarged } = req.query;

    const enforcedStaffId = staffFilter
      ? user.id
      : (staffQueryId ? Number(staffQueryId) : null);

    const startDate = DateTime.fromISO(start).toUTC().toISO();
    const endDate = DateTime.fromISO(end).endOf("day").toUTC().toISO();

    const dischargeFilter =
      includeDischarged === "true"
        ? "AND COALESCE(p.is_archived, false) = false"
        : "AND p.status != 'Discharged' AND COALESCE(p.is_archived, false) = false";

    // =========================================================
    // CASE 1 — STAFF + TASKNAME
    // =========================================================
    if (enforcedStaffId && taskName) {
      const params = [
        ...hospitalParams,
        enforcedStaffId,
        taskName,
        startDate,
        endDate
      ];

      const summaryQuery = `
        SELECT
          COUNT(DISTINCT pt.id) AS total_tasks,
          COUNT(DISTINCT pt.id) FILTER (WHERE pt.status = 'Missed') AS missed_count,
          COUNT(DISTINCT pt.id) FILTER (WHERE pt.status = 'Delayed Completed') AS delayed_count,
          COUNT(DISTINCT pt.id) FILTER (WHERE COALESCE(pt.override_count, 0) > 0) AS overridden_count
        FROM patient_tasks pt
        JOIN tasks t ON pt.task_id = t.id
        JOIN patients p ON pt.patient_id = p.id
        JOIN patient_staff ps ON p.id = ps.patient_id
        WHERE ${hospitalSQL}
          AND ps.staff_id = $${hospitalParams.length + 1}
          AND t.name = $${hospitalParams.length + 2}
          AND pt.due_date BETWEEN $${hospitalParams.length + 3} AND $${hospitalParams.length + 4}
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
            ORDER BY sh."timestamp" DESC LIMIT 1
          ) AS missed_reason,
          (
            SELECT sh.reason
            FROM jsonb_to_recordset(pt.status_history)
              AS sh(status TEXT, "timestamp" TIMESTAMPTZ, reason TEXT)
            WHERE sh.status IN ('Override','Overridden','Override Applied')
              AND NULLIF(TRIM(sh.reason),'') IS NOT NULL
            ORDER BY sh."timestamp" DESC LIMIT 1
          ) AS override_reason,
          (
            SELECT sh."timestamp"
            FROM jsonb_to_recordset(pt.status_history)
              AS sh(status TEXT, "timestamp" TIMESTAMPTZ, reason TEXT)
            WHERE sh.status IN ('Override','Overridden','Override Applied')
            ORDER BY sh."timestamp" DESC LIMIT 1
          ) AS last_override_at
        FROM patient_tasks pt
        JOIN tasks t ON pt.task_id = t.id
        JOIN patients p ON pt.patient_id = p.id
        JOIN patient_staff ps ON p.id = ps.patient_id
        WHERE ${hospitalSQL}
          AND ps.staff_id = $${hospitalParams.length + 1}
          AND t.name = $${hospitalParams.length + 2}
          AND pt.due_date BETWEEN $${hospitalParams.length + 3} AND $${hospitalParams.length + 4}
          AND pt.is_visible = TRUE
          ${dischargeFilter}
          AND (
            pt.status IN ('Missed','Delayed Completed')
            OR (pt.status = 'Pending' AND COALESCE(pt.override_count,0) > 0)
            OR (pt.status = 'Completed' AND COALESCE(pt.override_count,0) > 0)
          )
        ORDER BY patient_name
      `;

      const summary = await pool.query(summaryQuery, params);
      const drilldown = await pool.query(drilldownQuery, params);

      return res.json({
        type: "staff-task",
        data: summary.rows[0],
        drilldown: drilldown.rows
      });
    }

    // =========================================================
// CASE 2 — ALGORITHM ONLY
// =========================================================
if (req.query.algorithm) {
  const algorithm = req.query.algorithm;

  const algoParams = [...hospitalParams];
  const staffParamIndex = enforcedStaffId ? hospitalParams.length + 1 : null;

  if (enforcedStaffId) algoParams.push(enforcedStaffId);

  algoParams.push(startDate, endDate, algorithm);

  const startIdx = hospitalParams.length + (enforcedStaffId ? 2 : 1);

  const summaryQuery = `
    SELECT
      t.algorithm,
      COUNT(*) FILTER (WHERE pt.status = 'Missed') AS missed_count,
      COUNT(*) FILTER (WHERE pt.status = 'Delayed Completed') AS delayed_count,
      COUNT(*) FILTER (WHERE COALESCE(pt.override_count,0) > 0) AS overridden_count
    FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      JOIN patients p ON pt.patient_id = p.id
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
    WHERE ${hospitalSQL}
      ${enforcedStaffId ? `AND ps.staff_id = $${staffParamIndex}` : ""}
      AND pt.due_date BETWEEN $${startIdx} AND $${startIdx + 1}
      AND t.algorithm = $${algoParams.length}
      AND pt.is_visible = TRUE
      ${dischargeFilter}
    GROUP BY t.algorithm
  `;

  const summaryResult = await pool.query(summaryQuery, algoParams);

  // DRILLDOWN (only missed / delayed / overridden)
  const detailParams = [
    algorithm,  // $1
    startDate,  // $2
    endDate,    // $3
    ...hospitalParams  // $4, $5
  ];

  if (enforcedStaffId) detailParams.push(enforcedStaffId);

  const detailQuery = `
    SELECT
      t.algorithm,
      t.name AS task_name,
      p.last_name || ', ' || p.first_name AS patient_name,
      ARRAY_AGG(DISTINCT u.name) AS staff_names,
      pt.status,
      COALESCE(pt.override_count,0) AS override_count,
      mr.reason AS missed_reason,
      orr.reason AS override_reason,
      orr.last_override_at
    FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      JOIN patients p ON pt.patient_id = p.id
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id

      LEFT JOIN LATERAL (
        SELECT sh.reason
        FROM jsonb_to_recordset(pt.status_history)
            AS sh(status TEXT, changed_at TIMESTAMPTZ, reason TEXT)
        WHERE sh.status = 'Missed'
        ORDER BY changed_at DESC LIMIT 1
      ) mr ON TRUE

      LEFT JOIN LATERAL (
        SELECT sh.reason, sh."timestamp" AS last_override_at
        FROM jsonb_to_recordset(pt.status_history)
            AS sh(status TEXT, "timestamp" TIMESTAMPTZ, reason TEXT)
        WHERE sh.status IN ('Override','Overridden','Override Applied')
          AND NULLIF(TRIM(sh.reason), '') IS NOT NULL
        ORDER BY sh."timestamp" DESC LIMIT 1
      ) orr ON TRUE

    WHERE t.algorithm = $1
      AND pt.due_date BETWEEN $2 AND $3
      AND pt.is_visible = TRUE
      AND ${hospitalSQL.replace(/\$1/g, "$4").replace(/\$2/g, "$5")}
      ${enforcedStaffId ? `AND ps.staff_id = $${detailParams.length}` : ""}
      ${dischargeFilter}
      AND (
        pt.status IN ('Missed','Delayed Completed')
        OR (COALESCE(pt.override_count,0) > 0)
      )

    GROUP BY
      t.algorithm, t.name, p.id, pt.status, pt.override_count,
      mr.reason, orr.reason, orr.last_override_at
    ORDER BY t.name, p.last_name, p.first_name
  `;

  const detailResult = await pool.query(detailQuery, detailParams);

  return res.json({
    type: "algorithm",
    data: summaryResult.rows,
    drilldown: detailResult.rows
  });
}


    // =========================================================
    // CASE 3 — STAFF ONLY
    // =========================================================
    if (enforcedStaffId) {
      const params = [
        ...hospitalParams,
        enforcedStaffId,
        startDate,
        endDate
      ];

      const summaryQuery = `
        SELECT
          COUNT(*) AS total_tasks,
          COUNT(*) FILTER (WHERE pt.status = 'Missed') AS missed_count,
          COUNT(*) FILTER (WHERE pt.status = 'Delayed Completed') AS delayed_count,
          COUNT(*) FILTER (WHERE COALESCE(pt.override_count, 0) > 0) AS overridden_count
        FROM patient_tasks pt
        JOIN patients p ON pt.patient_id = p.id
        JOIN patient_staff ps ON p.id = ps.patient_id
        WHERE ${hospitalSQL}
          AND ps.staff_id = $${hospitalParams.length + 1}
          AND pt.due_date BETWEEN $${hospitalParams.length + 2} AND $${hospitalParams.length + 3}
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
            ORDER BY sh."timestamp" DESC LIMIT 1
          ) AS missed_reason,
          (
            SELECT sh.reason
            FROM jsonb_to_recordset(pt.status_history)
              AS sh(status TEXT, "timestamp" TIMESTAMPTZ, reason TEXT)
            WHERE sh.status IN ('Override','Overridden','Override Applied')
              AND NULLIF(TRIM(sh.reason), '') IS NOT NULL
            ORDER BY sh."timestamp" DESC LIMIT 1
          ) AS override_reason,
          (
            SELECT sh."timestamp"
            FROM jsonb_to_recordset(pt.status_history)
              AS sh(status TEXT, "timestamp" TIMESTAMPTZ, reason TEXT)
            WHERE sh.status IN ('Override','Overridden','Override Applied')
            ORDER BY sh."timestamp" DESC LIMIT 1
          ) AS last_override_at
        FROM patient_tasks pt
        JOIN tasks t ON pt.task_id = t.id
        JOIN patients p ON pt.patient_id = p.id
        JOIN patient_staff ps ON p.id = ps.patient_id
        WHERE ${hospitalSQL}
          AND ps.staff_id = $${hospitalParams.length + 1}
          AND pt.due_date BETWEEN $${hospitalParams.length + 2} AND $${hospitalParams.length + 3}
          AND pt.is_visible = TRUE
          ${dischargeFilter}
          AND (
            pt.status IN ('Missed','Delayed Completed')
            OR (pt.status = 'Pending' AND COALESCE(pt.override_count,0) > 0)
            OR (pt.status = 'Completed' AND COALESCE(pt.override_count,0) > 0)
          )
        ORDER BY t.name, patient_name
      `;

      const summary = await pool.query(summaryQuery, params);
      const drilldown = await pool.query(drilldownQuery, params);

      return res.json({
        type: "staff",
        data: summary.rows[0],
        drilldown: drilldown.rows
      });
    }

    // =========================================================
    // DEFAULT — FULL SUMMARY VIEW
    // =========================================================
    const params = [...hospitalParams, startDate, endDate];

    const patientQuery = `
      SELECT
        p.id AS patient_id,
        p.last_name || ', ' || p.first_name AS patient_name,
        p.admitted_date,
        p.created_at,
        ARRAY_AGG(DISTINCT u.name) AS staff,
        COUNT(DISTINCT pt.id) AS total_tasks,
        COUNT(DISTINCT pt.id) FILTER (WHERE pt.status = 'Missed') AS missed,
        COUNT(DISTINCT pt.id) FILTER (WHERE pt.status = 'Pending') AS pending,
        COUNT(DISTINCT pt.id) FILTER (WHERE pt.status = 'Completed') AS completed_on_time,
        COUNT(DISTINCT pt.id) FILTER (WHERE pt.status = 'Delayed Completed') AS delayed_completed,
        COUNT(DISTINCT pt.id) FILTER (WHERE COALESCE(pt.override_count, 0) > 0) AS overridden,
        COUNT(DISTINCT pt.id) FILTER (WHERE t.is_manual = TRUE) AS manual
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      JOIN tasks t ON pt.task_id = t.id
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      WHERE ${hospitalSQL}
        AND pt.due_date BETWEEN $${hospitalParams.length + 1} AND $${hospitalParams.length + 2}
        AND pt.is_visible = TRUE
        ${dischargeFilter}
      GROUP BY p.id, p.first_name, p.last_name, p.admitted_date, p.created_at
      ORDER BY p.last_name ASC, p.first_name ASC;
    `;

    const summaryResult = await pool.query(patientQuery, params);

    const topTasksQuery = `
      SELECT
        t.name AS task_name,
        COUNT(*) AS total_issues,
        SUM(CASE WHEN pt.status = 'Missed' THEN 1 ELSE 0 END) AS missed_count,
        SUM(CASE WHEN pt.status = 'Delayed Completed' THEN 1 ELSE 0 END) AS delayed_completed_count,
        JSON_AGG(DISTINCT u.name) AS responsible_staff
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      JOIN patients p ON pt.patient_id = p.id
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      WHERE ${hospitalSQL}
        AND pt.status IN ('Missed', 'Delayed Completed')
        AND pt.due_date BETWEEN $${hospitalParams.length + 1} AND $${hospitalParams.length + 2}
        AND pt.is_visible = TRUE
        ${dischargeFilter}
      GROUP BY t.name
      ORDER BY total_issues DESC
      LIMIT 3;
    `;

    const topStaffQuery = `
      SELECT
        u.name AS staff_name,
        COUNT(*) FILTER (WHERE pt.status = 'Missed') AS missed_count,
        COUNT(*) FILTER (
          WHERE pt.status IN ('Completed', 'Delayed Completed')
            AND pt.completed_at > pt.ideal_due_date
        ) AS delayed_count
      FROM users u
      JOIN patient_staff ps ON u.id = ps.staff_id
      JOIN patients p ON ps.patient_id = p.id
      JOIN patient_tasks pt ON pt.patient_id = p.id
      WHERE ${hospitalSQL}
        AND pt.due_date BETWEEN $${hospitalParams.length + 1} AND $${hospitalParams.length + 2}
        AND pt.is_visible = TRUE
        ${dischargeFilter}
      GROUP BY u.name
      ORDER BY missed_count DESC
      LIMIT 3
    `;

    const topTasksResult = await pool.query(topTasksQuery, params);
    const topStaffResult = await pool.query(topStaffQuery, params);

    return res.json({
      type: "summary",
      data: summaryResult.rows,
      topMissedTasks: topTasksResult.rows,
      topLaggingStaff: topStaffResult.rows
    });
  } catch (err) {
    console.error("Staff Performance Report Error:", err);
    return res
      .status(500)
      .json({ error: "Failed to generate Staff Performance Report." });
  }
};


  module.exports = { getDailyReport, getPriorityReport,getTransitionalCareReport ,getHistoricalTimelineReport,getProjectedTimelineReport,getLengthOfStaySummary,getOpportunityDaysSummary, getStaffPerformanceReport};