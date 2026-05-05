// controller/reportController.js
const pool = require("../models/db");
const { getHospitalTimezone } = require("../utils/timezone");
const dayjs = require("dayjs");
const { DateTime } = require("luxon");

// ─── Role helpers ─────────────────────────────────────────────────────────────
const isSuperAdmin = (u) => u.role === "super_admin";
const isAdmin      = (u) => u.role === "admin";
const isStaff      = (u) => u.role === "staff";

// ─── Hospital filter builder ──────────────────────────────────────────────────
// FIX: role checks use role string instead of boolean flags
const getHospitalFilter = (req) => {
  const user = req.user;
  const selectedHospital = req.query.hospitalId ? Number(req.query.hospitalId) : null;

  if (isSuperAdmin(user)) {
    if (selectedHospital) {
      return { sql: "p.hospital_id = $1", params: [selectedHospital], staffFilter: false };
    }
    return {
      sql: "p.hospital_id IN (SELECT id FROM hospitals WHERE organization_id = $1)",
      params: [Number(user.organization_id)],
      staffFilter: false,
    };
  }

  if (isAdmin(user)) {
    return { sql: "p.hospital_id = $1", params: [Number(user.hospital_id)], staffFilter: false };
  }

  // Staff — scoped to their hospital, and further filtered to their assigned patients
  return { sql: "p.hospital_id = $1", params: [Number(user.hospital_id)], staffFilter: true };
};

// ─── LOS calculator ───────────────────────────────────────────────────────────
const calcLOS = (from, to) => {
  const diffMs     = Math.max(to - from, 0);
  const totalHours = diffMs / (1000 * 60 * 60);
  return { days: Math.floor(totalHours / 24), hours: Math.round(totalHours % 24), totalHours };
};

// ─── GET DAILY REPORT ─────────────────────────────────────────────────────────
const getDailyReport = async (req, res) => {
  if (!req.user?.is_approved)
    return res.status(403).json({ error: "Access denied: user not approved" });

  const timezone = await getHospitalTimezone(req.user.hospital_id);
  const { adminId } = req.query;

  try {
    const todayEndUTC = DateTime.now().setZone(timezone).endOf("day").toUTC().toISO();
    const { sql: hospitalSQL, params: hospitalParams, staffFilter } = getHospitalFilter(req);

    // Offset all hospital params by 1 (slot 1 = todayEndUTC)
    const shiftedHospitalSQL = hospitalSQL.replace(/\$(\d+)/g, (_, i) => `$${Number(i) + 1}`);
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
      LEFT JOIN users u_added ON u_added.id = p.added_by_user_id AND u_added.is_approved = TRUE
      WHERE pt.status IN ('Missed', 'Pending')
        AND pt.is_visible = TRUE
        AND pt.due_date <= $1
        AND p.status != 'Discharged'
        AND p.is_archived = FALSE
        AND ${shiftedHospitalSQL}
    `;

    if (staffFilter) {
      values.push(req.user.id);
      query += ` AND EXISTS (SELECT 1 FROM patient_staff ps2 WHERE ps2.patient_id = p.id AND ps2.staff_id = $${paramIndex})`;
      paramIndex++;
    }

    if (adminId) {
      values.push(Number(adminId));
      query += ` AND p.added_by_user_id = $${paramIndex}`;
      paramIndex++;
    }

    query += ` GROUP BY p.id, pt.id, t.id, u_added.name ORDER BY pt.due_date ASC`;

    const { rows } = await pool.query(query, values);
    return res.json(rows.map(r => ({
      patient_id: r.patient_id, patient_name: r.name, task_name: r.task_name,
      status: r.status, due_date: r.due_date,
      staff_names: r.staff_names || [], added_by: r.added_by || "Unknown",
    })));

  } catch (err) {
    console.error("getDailyReport error:", err);
    return res.status(500).json({ error: "Failed to fetch daily report" });
  }
};

// ─── GET PRIORITY REPORT ──────────────────────────────────────────────────────
const getPriorityReport = async (req, res) => {
  if (!req.user?.is_approved)
    return res.status(403).json({ error: "Access denied: user not approved" });

  const { date, adminId } = req.query;
  if (!date) return res.status(400).json({ error: "Date parameter is required" });

  const timezone = await getHospitalTimezone(req.user.hospital_id);

  try {
    const startUTC = DateTime.fromISO(date, { zone: timezone }).startOf("day").toUTC().toISO();
    const endUTC   = DateTime.fromISO(date, { zone: timezone }).endOf("day").toUTC().toISO();

    const { sql: hospitalSQL, params: hospitalParams, staffFilter } = getHospitalFilter(req);
    const shiftedSQL = hospitalSQL.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 2}`);

    let values = [startUTC, endUTC, ...hospitalParams];
    let paramIndex = values.length + 1;

    let query = `
      SELECT
        p.id AS patient_id,
        p.last_name || ', ' || p.first_name AS name,
        t.name AS task_name, pt.due_date, pt.status,
        json_agg(DISTINCT u.name) FILTER (WHERE u.id IS NOT NULL) AS staff_names,
        u_added.name AS added_by
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      JOIN tasks t ON pt.task_id = t.id
      LEFT JOIN patient_staff ps ON ps.patient_id = p.id
      LEFT JOIN users u ON ps.staff_id = u.id
      LEFT JOIN users u_added ON u_added.id = p.added_by_user_id AND u_added.is_approved = TRUE
      WHERE pt.due_date >= $1 AND pt.due_date <= $2
        AND pt.status IN ('Pending', 'In Progress', 'Missed')
        AND p.status != 'Discharged'
        AND p.is_archived = FALSE
        AND pt.is_visible = TRUE
        AND ${shiftedSQL}
    `;

    if (staffFilter) {
      values.push(req.user.id);
      query += ` AND EXISTS (SELECT 1 FROM patient_staff ps2 WHERE ps2.patient_id = p.id AND ps2.staff_id = $${paramIndex})`;
      paramIndex++;
    }

    if (adminId) {
      values.push(Number(adminId));
      query += ` AND p.added_by_user_id = $${paramIndex}`;
    }

    query += `
      GROUP BY p.id, pt.id, t.id, u_added.name
      ORDER BY CASE pt.status WHEN 'Missed' THEN 1 WHEN 'Pending' THEN 2 WHEN 'In Progress' THEN 3 ELSE 4 END
    `;

    const { rows } = await pool.query(query, values);
    return res.json(rows.map(r => ({
      patient_id: r.patient_id, patient_name: r.name, task_name: r.task_name,
      due_date: r.due_date, status: r.status,
      staff_names: r.staff_names || [], added_by: r.added_by || "Unknown",
    })));

  } catch (err) {
    console.error("getPriorityReport error:", err);
    return res.status(500).json({ error: "Failed to fetch priority report" });
  }
};

// ─── TRANSITIONAL CARE REPORT ─────────────────────────────────────────────────
const getTransitionalCareReport = async (req, res) => {
  if (!req.user?.is_approved)
    return res.status(403).json({ error: "Access denied: user not approved" });

  const client    = await pool.connect();
  const patientId = Number(req.params.id);
  const { start_date, end_date } = req.query;
  const timezone  = await getHospitalTimezone(req.user.hospital_id);

  try {
    const { sql: hospitalSQL, params: hospitalParams } = getHospitalFilter(req);
    const shiftedSQL = hospitalSQL.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 1}`);

    const { rows: patientRows } = await client.query(
      `SELECT id, first_name || ' ' || last_name AS name, mrn, birth_date, admitted_date
       FROM patients p WHERE p.id = $1 AND ${shiftedSQL}`,
      [patientId, ...hospitalParams]
    );
    if (!patientRows.length) return res.status(404).json({ error: "Patient not found" });

    const patient = patientRows[0];
    let taskSQL = `
      SELECT t.name AS task_name, pt.completed_at, pt.status, t.algorithm, pt.contact_info, pt.task_note
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      WHERE pt.patient_id = $1 AND pt.status IN ('Completed','Delayed Completed','Acknowledged')
    `;
    const params = [patientId];
    let idx = 2;

    if (start_date) {
      taskSQL += ` AND pt.completed_at >= $${idx++}`;
      params.push(DateTime.fromISO(start_date, { zone: timezone }).startOf("day").toUTC().toISO());
    }
    if (end_date) {
      taskSQL += ` AND pt.completed_at <= $${idx++}`;
      params.push(DateTime.fromISO(end_date, { zone: timezone }).endOf("day").toUTC().toISO());
    }
    taskSQL += ` ORDER BY pt.completed_at DESC`;

    const { rows: taskRows } = await client.query(taskSQL, params);
    const grouped = {};
    for (const row of taskRows) {
      const algo = row.algorithm || "N/A";
      if (!grouped[algo]) grouped[algo] = { algorithm: algo, tasks_completed: [] };
      grouped[algo].tasks_completed.push({
        task_name: row.task_name, completed_at: row.completed_at,
        contact_info: row.contact_info || "—", task_note: row.task_note || "—",
      });
    }

    return res.json({
      patient: {
        name: patient.name, mrn: patient.mrn || "N/A",
        dob: patient.birth_date,
        admitted_date:patient.admitted_date,
      },
      sections: Object.values(grouped),
    });

  } catch (err) {
    console.error("getTransitionalCareReport error:", err);
    return res.status(500).json({ error: "Failed to generate transitional care report" });
  } finally {
    client.release();
  }
};

// ─── HISTORICAL TIMELINE REPORT ───────────────────────────────────────────────
// FIX: status_history now comes from patient_task_status_history table
const getHistoricalTimelineReport = async (req, res) => {
  if (!req.user?.is_approved)
    return res.status(403).json({ error: "Access denied: user not approved" });

  const patientId = Number(req.params.id);
  const { start_date, end_date } = req.query;
  const timezone  = await getHospitalTimezone(req.user.hospital_id);

  try {
    const { sql: hospitalSQL, params: hospitalParams } = getHospitalFilter(req);
    const shiftedSQL = hospitalSQL.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 1}`);

    const { rows: patientRows } = await pool.query(
      `SELECT id, first_name, last_name, birth_date, admitted_date, mrn
       FROM patients p WHERE p.id = $1 AND ${shiftedSQL}`,
      [patientId, ...hospitalParams]
    );
    if (!patientRows.length) return res.status(404).json({ error: "Patient not found" });

    const patient     = patientRows[0];
    const admittedDate = dayjs(patient.admitted_date).startOf("day");

    // FIX: fetch status_history from patient_task_status_history table
    let query = `
      SELECT
        t.name AS task_name,
        pt.completed_at,
        pt.task_note,
        pt.include_note_in_report,
        pt.contact_info,
        pt.status,
        COALESCE(
          json_agg(
            json_build_object(
              'old_status', h.old_status,
              'new_status', h.new_status,
              'changed_at', h.changed_at,
              'note', h.note,
              'changed_by_user_id', h.changed_by_user_id
            ) ORDER BY h.changed_at
          ) FILTER (WHERE h.id IS NOT NULL),
          '[]'
        ) AS status_history
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      LEFT JOIN patient_task_status_history h ON h.patient_task_id = pt.id
      WHERE pt.patient_id = $1
        AND pt.status IN ('Completed','Delayed Completed','Acknowledged')
    `;
    const params = [patientId];
    let idx = 2;

    if (start_date) {
      query += ` AND pt.completed_at >= $${idx++}`;
      params.push(DateTime.fromISO(start_date, { zone: timezone }).startOf("day").toUTC().toISO());
    }
    if (end_date) {
      query += ` AND pt.completed_at <= $${idx++}`;
      params.push(DateTime.fromISO(end_date, { zone: timezone }).endOf("day").toUTC().toISO());
    }
    query += ` GROUP BY pt.id, t.name ORDER BY pt.completed_at ASC`;

    const { rows } = await pool.query(query, params);
    const weeksMap  = {};

    for (const row of rows) {
      const completedAt = dayjs(row.completed_at);
      const weekNumber  = Math.floor(completedAt.diff(admittedDate, "day") / 7) + 1;
      const weekStart   = admittedDate.add((weekNumber - 1) * 7, "day");
      const weekEnd     = admittedDate.add(weekNumber * 7 - 1, "day");
      const weekKey     = `Week #${weekNumber} (${weekStart.format("MM.DD.YY")} - ${weekEnd.format("MM.DD.YY")})`;

      if (!weeksMap[weekKey]) weeksMap[weekKey] = [];

      const history       = row.status_history || [];
      const isDelayed     = row.status === "Delayed Completed";
      const lastMissed    = [...history].reverse().find(h => h.new_status === "Missed" && h.note);
      const delayed_reason = isDelayed ? (lastMissed?.note ?? null) : null;

      const overrides = history
        .filter(h => h.new_status === "Overridden")
        .map(h => ({ reason: h.note ?? null, timestamp: h.changed_at, changed_by_user_id: h.changed_by_user_id }));

      weeksMap[weekKey].push({
        task_name: row.task_name,
        completed_at: row.completed_at,
        task_note: row.task_note,
        contact_info: row.contact_info,
        include_note_in_report: row.include_note_in_report,
        delayed: isDelayed,
        delayed_reason,
        overrides,
      });
    }

    return res.json({
      patient: { name: `${patient.last_name}, ${patient.first_name}`, admitted_date: patient.admitted_date, mrn: patient.mrn || "N/A" },
      timeline: Object.entries(weeksMap).map(([week, tasks]) => ({ week, tasks })),
    });

  } catch (err) {
    console.error("getHistoricalTimelineReport error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// ─── PROJECTED TIMELINE REPORT ────────────────────────────────────────────────
// FIX: status_history from table + active_algorithms from patient_algorithms
const getProjectedTimelineReport = async (req, res) => {
  if (!req.user?.is_approved)
    return res.status(403).json({ error: "Access denied: user not approved" });

  const patientId = Number(req.params.id);
  const timezone  = await getHospitalTimezone(req.user.hospital_id);

  try {
    const { sql: hospitalSQL, params: hospitalParams, staffFilter } = getHospitalFilter(req);
    const shiftedSQL = hospitalSQL.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 1}`);

    let values = [patientId, ...hospitalParams];
    let paramIndex = values.length + 1;

    let query = `
      SELECT
        pt.id AS patient_task_id, pt.version, pt.updated_at, pt.task_id,
        t.name AS task_name, t.algorithm, t.is_non_blocking, t.is_repeating,
        pt.status, pt.due_date, pt.completed_at, pt.ideal_due_date,
        p.is_guardianship_emergency, p.admitted_date
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      JOIN patients p ON pt.patient_id = p.id
      WHERE pt.patient_id = $1 AND ${shiftedSQL}
        AND t.algorithm IN ('Guardianship', 'LTC')
    `;

    if (staffFilter) {
      values.push(req.user.id);
      query += ` AND EXISTS (SELECT 1 FROM patient_staff ps WHERE ps.patient_id = p.id AND ps.staff_id = $${paramIndex})`;
      paramIndex++;
    }

    query += ` ORDER BY pt.completed_at NULLS LAST, pt.due_date`;

    const { rows: tasks } = await pool.query(query, values);
    if (!tasks.length) return res.json({ projected: {}, actual: {}, grouped: {} });

    // FIX: fetch status_history from table for missed reason lookup
    const taskIds = tasks.map(t => t.patient_task_id);
    const { rows: historyRows } = await pool.query(
      `SELECT patient_task_id, new_status, note FROM patient_task_status_history
       WHERE patient_task_id = ANY($1) AND new_status = 'Missed' AND note IS NOT NULL`,
      [taskIds]
    );
    const missedReasonMap = new Map(historyRows.map(h => [h.patient_task_id, h.note]));

    const grouped = { Guardianship: [], LTC: [] };
    for (const task of tasks) {
      if (task.is_non_blocking) continue;
      grouped[task.algorithm]?.push({
        task_name:       task.task_name,
        status:          task.status,
        due_date:        task.due_date,
        completed_at:    task.completed_at,
        ideal_due_date:  task.ideal_due_date,
        missed_reason:   missedReasonMap.get(task.patient_task_id) ?? null,
      });
    }

    for (const alg of ["Guardianship", "LTC"]) {
      grouped[alg] = [
        ...grouped[alg].filter(t => ["Completed","Delayed Completed"].includes(t.status)).sort((a,b) => new Date(a.completed_at) - new Date(b.completed_at)),
        ...grouped[alg].filter(t => !["Completed","Delayed Completed"].includes(t.status)).sort((a,b) => new Date(a.due_date) - new Date(b.due_date)),
      ];
    }

    const toLocal = dt => DateTime.fromJSDate(new Date(dt), { zone: "utc" }).setZone(timezone);

    const getProjectedDate = (tasks) => {
      const latest = tasks.map(t => t.ideal_due_date).filter(Boolean).map(toLocal).sort((a,b) => b-a)[0];
      return latest?.toFormat("MMMM d, yyyy") ?? null;
    };

    const getActualDate = (tasks) => {
      const pending = tasks.filter(t => !["Completed","Delayed Completed"].includes(t.status));
      if (!pending.length) {
        const latest = tasks.map(t => t.completed_at).filter(Boolean).map(toLocal).sort((a,b) => b-a)[0];
        return latest?.toFormat("MMMM d, yyyy") ?? null;
      }
      const today   = DateTime.now().setZone(timezone);
      const latestDue = pending.map(t => t.due_date).filter(Boolean).map(toLocal).sort((a,b) => b-a)[0];
      return (!latestDue || latestDue < today ? today : latestDue).toFormat("MMMM d, yyyy");
    };

    // FIX: get active_algorithms from patient_algorithms table
    const { rows: algoRows } = await pool.query(
      `SELECT algorithm FROM patient_algorithms WHERE patient_id = $1 AND removed_at IS NULL`,
      [patientId]
    );
    const activeAlgorithms = algoRows.map(r => r.algorithm);

    return res.json({
      projected: { Guardianship: getProjectedDate(grouped.Guardianship), LTC: getProjectedDate(grouped.LTC) },
      actual:    { Guardianship: getActualDate(grouped.Guardianship),    LTC: getActualDate(grouped.LTC) },
      grouped,
      activeAlgorithms,
    });

  } catch (err) {
    console.error("getProjectedTimelineReport error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ─── LENGTH OF STAY SUMMARY ───────────────────────────────────────────────────
// FIX: uses patient_algorithms table for exact per-algorithm LOS.
// No duplication — each algorithm's LOS is measured from its own
// assigned_at to removed_at (or discharge/today), not the full stay.
const getLengthOfStaySummary = async (req, res) => {
  try {
    if (!req.user?.is_approved)
      return res.status(403).json({ error: "Access denied: user not approved" });

    const staffId         = req.user.id;
    const startDate       = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate         = req.query.endDate   ? new Date(req.query.endDate)   : null;
    const includeDischarged = req.query.includeDischarged === "true";
    const algorithmFilter = req.query.algorithm || null;

    const { sql: hospitalSQL, params: hospitalParams, staffFilter } = getHospitalFilter(req);

    // Get daily room cost for the hospital(s) in scope
    const { rows: costRows } = await pool.query(
      `SELECT AVG(daily_room_cost) AS avg_cost FROM hospitals
       WHERE id IN (SELECT DISTINCT hospital_id FROM patients p WHERE ${hospitalSQL})`,
      hospitalParams
    );
    const nationalAvg = Number(costRows[0]?.avg_cost ?? 2883);

    // Fetch patients
    let patientQuery = `
      SELECT p.id, p.admitted_date, p.discharge_date, p.status
      FROM patients p
      ${staffFilter ? "JOIN patient_staff ps ON ps.patient_id = p.id" : ""}
      WHERE ${hospitalSQL}
        AND p.is_archived = FALSE
        ${!includeDischarged ? "AND p.status = 'Admitted'" : ""}
        ${staffFilter ? `AND ps.staff_id = $${hospitalParams.length + 1}` : ""}
    `;
    let params = [...hospitalParams];
    if (staffFilter) params.push(staffId);
    if (startDate) { patientQuery += ` AND p.admitted_date >= $${params.length + 1}`; params.push(startDate); }
    if (endDate)   { patientQuery += ` AND p.admitted_date <= $${params.length + 1}`; params.push(endDate); }

    const { rows: patients } = await pool.query(patientQuery, params);

    const summary = {
      behavioral:   { totalHours: 0, totalDays: 0, count: 0, cost: 0 },
      guardianship: { totalHours: 0, totalDays: 0, count: 0, cost: 0 },
      ltc:          { totalHours: 0, totalDays: 0, count: 0, cost: 0 },
    };
    const countedPatients = { behavioral: new Set(), guardianship: new Set(), ltc: new Set() };
    const today = new Date();

    for (const patient of patients) {
      const dischargeDate = patient.discharge_date ? new Date(patient.discharge_date) : today;

      // FIX: get per-algorithm time windows from patient_algorithms table
      // This gives exact LOS per algorithm, not full stay for all algorithms
      const { rows: algoRows } = await pool.query(
        `SELECT algorithm, assigned_at, removed_at
         FROM patient_algorithms
         WHERE patient_id = $1
         ${algorithmFilter ? "AND algorithm = $2" : ""}
         ORDER BY assigned_at ASC`,
        algorithmFilter ? [patient.id, algorithmFilter] : [patient.id]
      );

      if (!algoRows.length) continue;

      for (const row of algoRows) {
        const key  = row.algorithm.toLowerCase();
        if (!summary[key]) continue;

        const from = new Date(row.assigned_at);
        // FIX: cap to discharge date — don't count time after discharge
        const to   = row.removed_at
          ? new Date(Math.min(new Date(row.removed_at), dischargeDate))
          : dischargeDate;

        const { totalHours } = calcLOS(from, to);

        summary[key].totalHours += totalHours;
        summary[key].totalDays   = Math.floor(summary[key].totalHours / 24);
        summary[key].cost       += (totalHours / 24) * nationalAvg;

        if (!countedPatients[key].has(patient.id)) {
          summary[key].count++;
          countedPatients[key].add(patient.id);
        }
      }
    }

    const uniquePatientHours = new Map(); // patient.id -> total hours
    for (const patient of patients) {
      const dischargeDate = patient.discharge_date ? new Date(patient.discharge_date) : today;
      const from = new Date(patient.admitted_date);
      const { totalHours } = calcLOS(from, dischargeDate);
      uniquePatientHours.set(patient.id, totalHours);
    }
    
    const uniqueTotalHours = [...uniquePatientHours.values()].reduce((a, b) => a + b, 0);
    const uniqueTotalDays  = Math.floor(uniqueTotalHours / 24);
    const uniqueTotalCost  = (uniqueTotalHours / 24) * nationalAvg;
    const uniqueCount      = uniquePatientHours.size;
    const avgHoursUnique   = uniqueCount ? uniqueTotalHours / uniqueCount : 0;
    
    const totalUnique = {
      count:        uniqueCount,
      totalDays:    uniqueTotalDays,
      totalHours:   uniqueTotalHours,
      avgDays:      Math.floor(avgHoursUnique / 24),
      avgHours:     Math.round(avgHoursUnique % 24),
      cost:         uniqueTotalCost,
      totalDisplay: `${uniqueTotalDays}d ${Math.round(uniqueTotalHours % 24)}h`,
      avgDisplay:   `${Math.floor(avgHoursUnique / 24)}d ${Math.round(avgHoursUnique % 24)}h`,
    };
    // Format averages
    for (const key of Object.keys(summary)) {
      const e = summary[key];
      const avgHours = e.count ? e.totalHours / e.count : 0;
      e.avgDays    = Math.floor(avgHours / 24);
      e.avgHours   = Math.round(avgHours % 24);
      e.totalDisplay = `${e.totalDays}d ${Math.round(e.totalHours % 24)}h`;
      e.avgDisplay   = `${e.avgDays}d ${e.avgHours}h`;
    }

    return res.json({ ...summary, nationalAverage: nationalAvg,totalUnique });

  } catch (err) {
    console.error("getLengthOfStaySummary error:", err);
    return res.status(500).json({ error: "Failed to calculate LOS summary" });
  }
};

// ─── OPPORTUNITY DAYS SUMMARY ─────────────────────────────────────────────────
// FIX: uses patient_algorithms for accurate per-algorithm attribution.
// Admission delay only charged to the FIRST algorithm at admission.
// Task delay attributed per algorithm based on task.algorithm column.
// No double-counting if algorithm changes mid-stay.
const getOpportunityDaysSummary = async (req, res) => {
  try {
    if (!req.user?.is_approved)
      return res.status(403).json({ error: "Access denied: user not approved" });

    const includeDischarged = req.query.includeDischarged === "true";
    const startDate  = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate    = req.query.endDate   ? new Date(req.query.endDate)   : null;
    const algorithmFilter = req.query.algorithm || null;

    const { sql: hospitalSQL, params: hospitalParams, staffFilter } = getHospitalFilter(req);

    const { rows: costRows } = await pool.query(
      `SELECT AVG(daily_room_cost) AS avg_cost FROM hospitals
       WHERE id IN (SELECT DISTINCT hospital_id FROM patients p WHERE ${hospitalSQL})`,
      hospitalParams
    );
    const nationalAvg = Number(costRows[0]?.avg_cost ?? 2883);

    let patientQuery = `
      SELECT p.id, p.admitted_date, p.created_at, p.discharge_date, p.status
      FROM patients p
      ${staffFilter ? "JOIN patient_staff ps ON ps.patient_id = p.id" : ""}
      WHERE ${hospitalSQL}
        AND p.is_archived = FALSE
        ${!includeDischarged ? "AND p.status = 'Admitted'" : ""}
        ${staffFilter ? `AND ps.staff_id = $${hospitalParams.length + 1}` : ""}
    `;
    let params = [...hospitalParams];
    if (staffFilter) params.push(req.user.id);
    if (startDate) { patientQuery += ` AND p.admitted_date >= $${params.length + 1}`; params.push(startDate); }
    if (endDate)   { patientQuery += ` AND p.admitted_date <= $${params.length + 1}`; params.push(endDate); }

    const { rows: patients } = await pool.query(patientQuery, params);

    const summary = {
      behavioral:   { admissionDelayHours: 0, taskDelayHours: 0, totalDelayHours: 0, cost: 0, count: 0 },
      guardianship: { admissionDelayHours: 0, taskDelayHours: 0, totalDelayHours: 0, cost: 0, count: 0 },
      ltc:          { admissionDelayHours: 0, taskDelayHours: 0, totalDelayHours: 0, cost: 0, count: 0 },
    };

    const computeTaskDelay = (tasks) => {
      if (!tasks.length) return { totalHours: 0 };
      const now = new Date();
      const idealMax = tasks.map(t => t.ideal_due_date).filter(Boolean).map(d => new Date(d)).sort((a,b) => b-a)[0];
      const compMax  = tasks.map(t => {
        if (t.completed_at) return new Date(t.completed_at);
        if (t.ideal_due_date && new Date(t.ideal_due_date) < now) return now;
        return null;
      }).filter(Boolean).sort((a,b) => b-a)[0];
      if (!idealMax || !compMax) return { totalHours: 0 };
      return calcLOS(idealMax, compMax);
    };

    for (const p of patients) {
      const admitted = new Date(p.admitted_date);
      const created  = new Date(p.created_at);
      const { totalHours: admissionDelayHours } = calcLOS(admitted, created);

      // FIX: get algorithm history from patient_algorithms table
      const { rows: algoRows } = await pool.query(
        `SELECT algorithm, assigned_at FROM patient_algorithms
         WHERE patient_id = $1 ORDER BY assigned_at ASC`,
        [p.id]
      );

      // FIX: first algorithm at admission time gets the admission delay charged to it
      // If multiple algorithms were assigned simultaneously, only charge the earliest
      const firstAlgo = algoRows[0]?.algorithm?.toLowerCase() ?? null;

      // Get tasks per algorithm for delay calculation
      const { rows: tasks } = await pool.query(
        `SELECT pt.ideal_due_date, pt.completed_at, pt.status, t.algorithm
         FROM patient_tasks pt
         JOIN tasks t ON pt.task_id = t.id
         WHERE pt.patient_id = $1 AND pt.is_visible = TRUE`,
        [p.id]
      );

      // FIX: get unique algorithms ever active for this patient
      const everAlgos = [...new Set(algoRows.map(r => r.algorithm))];
      const algosToProcess = algorithmFilter
        ? everAlgos.filter(a => a === algorithmFilter)
        : everAlgos;

      for (const algo of algosToProcess) {
        const key = algo.toLowerCase();
        if (!summary[key]) continue;

        const algoTasks       = tasks.filter(t => t.algorithm === algo);
        const { totalHours: taskDelayHours } = computeTaskDelay(algoTasks);

        // FIX: admission delay only attributed to the FIRST algorithm
        const algoAdmissionDelay = key === firstAlgo ? admissionDelayHours : 0;
        const totalDelayHours    = algoAdmissionDelay + taskDelayHours;

        summary[key].admissionDelayHours += algoAdmissionDelay;
        summary[key].taskDelayHours      += taskDelayHours;
        summary[key].totalDelayHours     += totalDelayHours;
        summary[key].cost                += (totalDelayHours / 24) * nationalAvg;
        summary[key].count++;
      }
    }

    for (const key of Object.keys(summary)) {
      const e = summary[key];
      e.admissionDelay          = Math.floor(e.admissionDelayHours / 24);
      e.admissionDelayHoursRem  = Math.round(e.admissionDelayHours % 24);
      e.taskDelay               = Math.floor(e.taskDelayHours / 24);
      e.taskDelayHoursRem       = Math.round(e.taskDelayHours % 24);
      e.totalDelay              = Math.floor(e.totalDelayHours / 24);
      e.totalDelayHoursRem      = Math.round(e.totalDelayHours % 24);
      e.admissionDelayDisplay   = `${e.admissionDelay}d ${e.admissionDelayHoursRem}h`;
      e.taskDelayDisplay        = `${e.taskDelay}d ${e.taskDelayHoursRem}h`;
      e.totalDelayDisplay       = `${e.totalDelay}d ${e.totalDelayHoursRem}h`;
    }

    return res.json({ behavioral: summary.behavioral, guardianship: summary.guardianship, ltc: summary.ltc, nationalAverage: nationalAvg });

  } catch (err) {
    console.error("getOpportunityDaysSummary error:", err);
    return res.status(500).json({ error: "Failed to calculate Opportunity Days Summary" });
  }
};

// ─── STAFF PERFORMANCE REPORT ─────────────────────────────────────────────────
// FIX: status_history queries now use patient_task_status_history table
// instead of JSONB jsonb_to_recordset calls
const getStaffPerformanceReport = async (req, res) => {
  try {
    if (!req.user?.is_approved)
      return res.status(403).json({ error: "Access denied: user not approved" });

    const { sql: hospitalSQL, params: hospitalParams, staffFilter } = getHospitalFilter(req);
    const { start, end, staffId: staffQueryId, includeDischarged, algorithm, hospitalId } = req.query;

    if (!start || !end)
      return res.status(400).json({ error: "start and end date are required" });

    const enforcedStaffId = staffFilter ? req.user.id : (staffQueryId ? Number(staffQueryId) : null);
    const startDate = DateTime.fromISO(start).toUTC().toISO();
    const endDate   = DateTime.fromISO(end).endOf("day").toUTC().toISO();

    const dischargeFilter = includeDischarged === "true"
      ? "AND p.is_archived = FALSE"
      : "AND p.status != 'Discharged' AND p.is_archived = FALSE";

    const missedReasonSQL = `(
      SELECT h.note FROM patient_task_status_history h
      WHERE h.patient_task_id = pt.id AND h.new_status = 'Missed' AND h.note IS NOT NULL
      ORDER BY h.changed_at DESC LIMIT 1
    ) AS missed_reason`;

    const overrideReasonSQL = `(
      SELECT h.note FROM patient_task_status_history h
      WHERE h.patient_task_id = pt.id AND h.new_status = 'Overridden' AND h.note IS NOT NULL
      ORDER BY h.changed_at DESC LIMIT 1
    ) AS override_reason`;

    const lastOverrideAtSQL = `(
      SELECT h.changed_at FROM patient_task_status_history h
      WHERE h.patient_task_id = pt.id AND h.new_status = 'Overridden'
      ORDER BY h.changed_at DESC LIMIT 1
    ) AS last_override_at`;

    // ── Case 1: Algorithm filter ──────────────────────────────────────────────
    if (algorithm && algorithm !== 'All') {
      let p = [...hospitalParams];
      const staffIdx = enforcedStaffId ? p.length + 1 : null;
      if (enforcedStaffId) p.push(enforcedStaffId);
      p.push(startDate, endDate, algorithm);
      const startIdx = hospitalParams.length + (enforcedStaffId ? 2 : 1);

      const summaryRes = await pool.query(`
        SELECT t.algorithm,
          COUNT(*) FILTER (WHERE pt.status = 'Missed') AS missed_count,
          COUNT(*) FILTER (WHERE pt.status = 'Delayed Completed') AS delayed_count,
          COUNT(*) FILTER (WHERE COALESCE(pt.override_count,0) > 0) AS overridden_count
        FROM patient_tasks pt
        JOIN tasks t ON pt.task_id = t.id
        JOIN patients p ON pt.patient_id = p.id
        LEFT JOIN patient_staff ps ON p.id = ps.patient_id
        WHERE ${hospitalSQL}
          ${enforcedStaffId ? `AND ps.staff_id = $${staffIdx}` : ""}
          AND pt.due_date BETWEEN $${startIdx} AND $${startIdx + 1}
          AND t.algorithm = $${p.length}
          AND pt.is_visible = TRUE ${dischargeFilter}
        GROUP BY t.algorithm
      `, p);

      const dp = [algorithm, startDate, endDate, ...hospitalParams];
      if (enforcedStaffId) dp.push(enforcedStaffId);
      const hShifted = hospitalSQL.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 3}`);

      const detailRes = await pool.query(`
        SELECT t.algorithm, t.name AS task_name,
               p.last_name || ', ' || p.first_name AS patient_name,
               ARRAY_AGG(DISTINCT u.name) AS staff_names,
               pt.status, COALESCE(pt.override_count,0) AS override_count,
               ${missedReasonSQL}, ${overrideReasonSQL}, ${lastOverrideAtSQL}
        FROM patient_tasks pt
        JOIN tasks t ON pt.task_id = t.id
        JOIN patients p ON pt.patient_id = p.id
        LEFT JOIN patient_staff ps ON p.id = ps.patient_id
        LEFT JOIN users u ON ps.staff_id = u.id
        WHERE t.algorithm = $1
          AND pt.due_date BETWEEN $2 AND $3
          AND pt.is_visible = TRUE
          AND ${hShifted}
          ${enforcedStaffId ? `AND ps.staff_id = $${dp.length}` : ""}
          ${dischargeFilter}
          AND (pt.status IN ('Missed','Delayed Completed') OR COALESCE(pt.override_count,0) > 0)
        GROUP BY t.algorithm, t.name, p.id, pt.id, pt.status, pt.override_count
        ORDER BY t.name, p.last_name, p.first_name
      `, dp);

      return res.json({ type: "algorithm", data: summaryRes.rows, drilldown: detailRes.rows });
    }

    // ── Case 2: Staff only ────────────────────────────────────────────────────
    if (enforcedStaffId) {
      const p = [...hospitalParams, enforcedStaffId, startDate, endDate];
      const hLen = hospitalParams.length;

      const summaryRes = await pool.query(`
        SELECT COUNT(*) AS total_tasks,
          COUNT(*) FILTER (WHERE pt.status = 'Missed') AS missed_count,
          COUNT(*) FILTER (WHERE pt.status = 'Delayed Completed') AS delayed_count,
          COUNT(*) FILTER (WHERE COALESCE(pt.override_count,0) > 0) AS overridden_count
        FROM patient_tasks pt
        JOIN patients p ON pt.patient_id = p.id
        JOIN patient_staff ps ON p.id = ps.patient_id
        WHERE ${hospitalSQL}
          AND ps.staff_id = $${hLen + 1}
          AND pt.due_date BETWEEN $${hLen + 2} AND $${hLen + 3}
          AND pt.is_visible = TRUE ${dischargeFilter}
      `, p);

      const drillRes = await pool.query(`
        SELECT t.name AS task_name,
               p.last_name || ', ' || p.first_name AS patient_name,
               pt.status, COALESCE(pt.override_count,0) AS override_count,
               ${missedReasonSQL}, ${overrideReasonSQL}, ${lastOverrideAtSQL}
        FROM patient_tasks pt
        JOIN tasks t ON pt.task_id = t.id
        JOIN patients p ON pt.patient_id = p.id
        JOIN patient_staff ps ON p.id = ps.patient_id
        WHERE ${hospitalSQL}
          AND ps.staff_id = $${hLen + 1}
          AND pt.due_date BETWEEN $${hLen + 2} AND $${hLen + 3}
          AND pt.is_visible = TRUE ${dischargeFilter}
          AND (pt.status IN ('Missed','Delayed Completed') OR COALESCE(pt.override_count,0) > 0)
        ORDER BY t.name, patient_name
      `, p);

      return res.json({ type: "staff", data: summaryRes.rows[0], drilldown: drillRes.rows });
    }

    // ── Default: Full summary ─────────────────────────────────────────────────
    const p = [...hospitalParams, startDate, endDate];
    const hLen = hospitalParams.length;

    const summaryRes = await pool.query(`
      SELECT p.id AS patient_id,
             p.last_name || ', ' || p.first_name AS patient_name,
             p.admitted_date, p.created_at,
             ARRAY_AGG(DISTINCT u.name) FILTER (WHERE u.id IS NOT NULL) AS staff,
             COUNT(DISTINCT pt.id) AS total_tasks,
             COUNT(DISTINCT pt.id) FILTER (WHERE pt.status = 'Missed') AS missed,
             COUNT(DISTINCT pt.id) FILTER (WHERE pt.status = 'Pending') AS pending,
             COUNT(DISTINCT pt.id) FILTER (WHERE pt.status = 'Completed') AS completed_on_time,
             COUNT(DISTINCT pt.id) FILTER (WHERE pt.status = 'Delayed Completed') AS delayed_completed,
             COUNT(DISTINCT pt.id) FILTER (WHERE COALESCE(pt.override_count,0) > 0) AS overridden,
             COUNT(DISTINCT pt.id) FILTER (WHERE t.is_manual = TRUE) AS manual
      FROM patient_tasks pt
      JOIN patients p ON pt.patient_id = p.id
      JOIN tasks t ON pt.task_id = t.id
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      WHERE ${hospitalSQL}
        AND pt.due_date BETWEEN $${hLen + 1} AND $${hLen + 2}
        AND pt.is_visible = TRUE ${dischargeFilter}
      GROUP BY p.id
      ORDER BY p.last_name, p.first_name
    `, p);

    // Top 3 most missed/delayed tasks
    const topTasksRes = await pool.query(`
      SELECT t.name AS task_name,
             COUNT(*) AS total_issues,
             SUM(CASE WHEN pt.status = 'Missed' THEN 1 ELSE 0 END) AS missed_count,
             SUM(CASE WHEN pt.status = 'Delayed Completed' THEN 1 ELSE 0 END) AS delayed_completed_count,
             JSON_AGG(DISTINCT u.name) FILTER (WHERE u.name IS NOT NULL) AS responsible_staff
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      JOIN patients p ON pt.patient_id = p.id
      LEFT JOIN patient_staff ps ON p.id = ps.patient_id
      LEFT JOIN users u ON ps.staff_id = u.id
      WHERE ${hospitalSQL}
        AND pt.status IN ('Missed','Delayed Completed')
        AND pt.due_date BETWEEN $${hLen + 1} AND $${hLen + 2}
        AND pt.is_visible = TRUE ${dischargeFilter}
      GROUP BY t.name
      ORDER BY total_issues DESC
      LIMIT 3
    `, p);

    // Top 3 lagging staff — only show staff WITH issues
    const topStaffRes = await pool.query(`
      SELECT u.name AS staff_name,
             COUNT(*) FILTER (WHERE pt.status = 'Missed') AS missed_count,
             COUNT(*) FILTER (
               WHERE pt.status IN ('Completed','Delayed Completed')
               AND pt.completed_at > pt.ideal_due_date
             ) AS delayed_count
      FROM users u
      JOIN patient_staff ps ON u.id = ps.staff_id
      JOIN patients p ON ps.patient_id = p.id
      JOIN patient_tasks pt ON pt.patient_id = p.id
      WHERE ${hospitalSQL}
        AND pt.due_date BETWEEN $${hLen + 1} AND $${hLen + 2}
        AND pt.is_visible = TRUE ${dischargeFilter}
      GROUP BY u.name
      HAVING
        COUNT(*) FILTER (WHERE pt.status = 'Missed') > 0
        OR COUNT(*) FILTER (
          WHERE pt.status IN ('Completed','Delayed Completed')
          AND pt.completed_at > pt.ideal_due_date
        ) > 0
      ORDER BY missed_count DESC
      LIMIT 3
    `, p);

    return res.json({
      type: "summary",
      data: summaryRes.rows,
      topMissedTasks: topTasksRes.rows,
      topLaggingStaff: topStaffRes.rows,
    });

  } catch (err) {
    console.error("getStaffPerformanceReport error:", err);
    return res.status(500).json({ error: "Failed to generate Staff Performance Report." });
  }
};

module.exports = {
  getDailyReport, getPriorityReport, getTransitionalCareReport,
  getHistoricalTimelineReport, getProjectedTimelineReport,
  getLengthOfStaySummary, getOpportunityDaysSummary, getStaffPerformanceReport,
};