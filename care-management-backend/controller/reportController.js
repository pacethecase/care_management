const pool = require("../models/db");
const dayjs = require('dayjs');
const isoWeek = require('dayjs/plugin/isoWeek');
dayjs.extend(isoWeek);



// Daily Report Controller
const getDailyReport = async (req, res) => {
    const { date } = req.query; // Get date from the query parameter

    if (!date) {
      return res.status(400).json({ error: "Date parameter is required" });
    }

    try {
      const result = await pool.query(`
        SELECT 
          p.id AS patient_id,
          p.name AS patient_name,
          t.name AS task_name,
          pt.status,
          pt.due_date,
          pt.assigned_staff_id,
          u.name AS staff_name,  -- Join with users table to get staff name
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
        LEFT JOIN users u ON pt.assigned_staff_id = u.id 
        WHERE 
        pt.status IN ('Missed') 
        OR (pt.status = 'Pending' AND pt.due_date::date <= $1::date)
        AND p.status != 'Discharged'
      ORDER BY p.name;
      `, [date]);

      if (result.rows.length === 0) {
        return res.json({ message: "No tasks for the selected date." });
      }

      res.json(result.rows.map(row => ({
        patient_id: row.patient_id,
        patient_name: row.patient_name,
        task_name: row.task_name,
        status: row.status,
        due_date: row.due_date,
        staff_name: row.staff_name,  // Include staff name
        missed_reason: row.missed_reason || "No reason provided"
      })));
    } catch (err) {
      console.error("❌ Error fetching daily report:", err);
      res.status(500).json({ error: "Failed to fetch daily report" });
    }
};
const getPriorityReport = async (req, res) => {
    const { date } = req.query; // Get date from the query parameter

    if (!date) {
      return res.status(400).json({ error: "Date parameter is required" });
    }

    try {
      const result = await pool.query(`
        SELECT 
          p.id AS patient_id,
          p.name AS patient_name,
          t.name AS task_name,
          pt.due_date,
          pt.status,
          u.name AS staff_name -- Join users table to get staff name
        FROM patient_tasks pt
        JOIN patients p ON pt.patient_id = p.id
        JOIN tasks t ON pt.task_id = t.id
        LEFT JOIN users u ON pt.assigned_staff_id = u.id -- Join users table to get staff name
      WHERE pt.due_date >= $1::date
        AND pt.due_date < ($1::date + INTERVAL '1 day')
          AND pt.status IN ('Pending', 'In Progress', 'Missed')
          AND p.status != 'Discharged'
       ORDER BY 
        CASE pt.status
          WHEN 'Missed' THEN 1
          WHEN 'Pending' THEN 2
          WHEN 'In Progress' THEN 3
          ELSE 4
        END;
      `, [date]);

      if (result.rows.length === 0) {
        return res.json({ message: "No tasks due for the selected date." });
      }

      res.json(result.rows.map(row => ({
        patient_id: row.patient_id,
        patient_name: row.patient_name,
        task_name: row.task_name,
        due_date: row.due_date,
        status: row.status,
        staff_name: row.staff_name // Include staff name
      })));
    } catch (err) {
      console.error("❌ Error fetching priority report:", err);
      res.status(500).json({ error: "Failed to fetch priority report" });
    }
};



const getTransitionalCareReport = async (req, res) => {
  const patientId = req.params.id;

  try {
    // Get patient info
    const patientQuery = await pool.query(`
      SELECT id, name, mrn, birth_date,  admitted_date,
        CASE
          WHEN is_behavioral THEN 'Behavioral'
          WHEN is_guardianship THEN 'Guardianship'
          WHEN is_ltc THEN 'LTC'
          ELSE 'N/A'
        END AS algorithm
      FROM patients
      WHERE id = $1
    `, [patientId]);

    if (patientQuery.rowCount === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patient = patientQuery.rows[0];

    // Fetch completed tasks (with task algorithm + optional contact info)
    const taskQuery = await pool.query(`
      SELECT 
        t.name AS task_name,
        pt.completed_at,
        t.algorithm
      FROM patient_tasks pt
      JOIN tasks t ON pt.task_id = t.id
      WHERE pt.patient_id = $1 AND pt.status = 'Completed'
      ORDER BY pt.completed_at DESC
    `, [patientId]);

    const grouped = {};

    for (const row of taskQuery.rows) {
      const algorithm = row.algorithm || "N/A";
      const contact =  "";

      const key = `${algorithm}__${contact}`;
      if (!grouped[key]) {
        grouped[key] = {
          algorithm,
          contact_info: contact,
          tasks_completed: []
        };
      }

      grouped[key].tasks_completed.push({
        task_name: row.task_name,
        completed_at: dayjs(row.completed_at).format("MM.DD.YY")
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
      sections: Object.values(grouped)
    };

    res.json(report);
  } catch (err) {
    console.error("❌ Error generating transitional report:", err);
    res.status(500).json({ error: "Failed to generate transitional care report" });
  }
};


const getHistoricalTimelineReport = async (req, res) => {
  const patientId = req.params.id;

  try {
    const patientQuery = await pool.query(
      `SELECT id, name, birth_date, admitted_date, mrn FROM patients WHERE id = $1`,
      [patientId]
    );

    if (patientQuery.rowCount === 0) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const patient = patientQuery.rows[0];
    const admittedDate = dayjs(patient.admitted_date).startOf('day');

    const tasksQuery = await pool.query(
      `SELECT t.name AS task_name, pt.completed_at
       FROM patient_tasks pt
       JOIN tasks t ON pt.task_id = t.id
       WHERE pt.patient_id = $1 AND pt.status = 'Completed'
       ORDER BY pt.completed_at ASC`,
      [patientId]
    );

    const weeksMap = {};

    tasksQuery.rows.forEach(row => {
      const completedAt = dayjs(row.completed_at);
      const weekNumber = Math.floor(completedAt.diff(admittedDate, 'day') / 7) + 1;

      const weekStart = admittedDate.add((weekNumber - 1) * 7, 'day');
      const weekEnd = admittedDate.add(weekNumber * 7 - 1, 'day');
      const weekKey = `Week #${weekNumber} (${weekStart.format('MM.DD.YY')} - ${weekEnd.format('MM.DD.YY')})`;

      if (!weeksMap[weekKey]) {
        weeksMap[weekKey] = [];
      }

      weeksMap[weekKey].push({
        task_name: row.task_name,
        completed_at: completedAt.format('MM.DD.YY'),
      });
    });

    const timeline = Object.entries(weeksMap).map(([week, tasks]) => ({
      week,
      tasks,
    }));

    res.json({
      patient: {
        name: patient.name,
        admitted_date: admittedDate.format('MM.DD.YY'),
        mrn: patient.mrn || 'N/A',
      },
      timeline,
    });
  } catch (err) {
    console.error('❌ Error generating historical timeline report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
  };

  const getProjectedTimelineReport = async (req, res) => {
    try {
      const patientId = req.params.id;
  
      // Fetch all relevant tasks
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
        WHERE pt.patient_id = $1
          AND t.algorithm IN ('Guardianship', 'LTC')
        ORDER BY pt.completed_at NULLS LAST, pt.due_date
      `, [patientId]);
      
      const tasks = result.rows;
      if (tasks.length === 0) return res.json({ projected: {}, actual: {}, grouped: {} });
      const parseStatusHistory = (history) => {
        try {
          // Directly use it since it's already JSON (not a string)
          const completed = history.find(h => h.status === "Completed");
      
          const missed = [...history].reverse().find(h => h.status === "Missed" && h.reason) ||
                         [...history].reverse().find(h => h.status === "Missed");
      
          return {
            completedAt: completed?.timestamp || null,
            missedAt: missed?.timestamp || null,
            missedReason: missed?.reason || null,
          };
        } catch (err) {
          console.error("❌ Failed to read status_history:", err);
          return { completedAt: null, missedAt: null, missedReason: null };
        }
      };
      
      
      
      
      const grouped = { Guardianship: [], LTC: [] };
      const actualEnd = { Guardianship: null, LTC: null };
      const missedCounts = { Guardianship: 0, LTC: 0 };
      
      tasks.forEach(task => {
        if (task.is_non_blocking || task.is_repeating) return;
      
        const { missedAt, missedReason } = parseStatusHistory(task.status_history);
      
        let label = "⏳ Pending";
        if (task.status === "Completed") {
          label = new Date(task.completed_at) < new Date(task.ideal_due_date) ? "✅ On Time" : "⚠️ Late";
        } else if (task.status === "Missed") {
          label = "❌ Missed";
          missedCounts[task.algorithm]++;
        }
      
        grouped[task.algorithm].push({
          task_name: task.task_name,
          status: task.status,
          label,
          due_date: task.due_date,
          ideal_due_date: task.ideal_due_date, 
          completed_at: task.completed_at,
          missed_reason: missedReason,
        });
      });
      
      // Sort completed first by completed_at, then due_date
      for (const alg in grouped) {
        const completed = grouped[alg].filter(t => t.status === "Completed")
          .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));
      
        const remaining = grouped[alg].filter(t => t.status !== "Completed")
          .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
      
        grouped[alg] = [...completed, ...remaining];
      }
      
      const patient = tasks[0];
      const safeDateString = (date) => {
        const d = new Date(date);
        return d instanceof Date && !isNaN(d) ? d.toISOString().split('T')[0] : null;
      };
      
      const projected = {
        Guardianship: safeDateString(
          grouped.Guardianship
            .map(t => t.ideal_due_date)
            .filter(Boolean)
            .map(d => new Date(d))
            .sort((a, b) => b - a)[0]
        ),
        LTC: safeDateString(
          grouped.LTC
            .map(t => t.ideal_due_date)
            .filter(Boolean)
            .map(d => new Date(d))
            .sort((a, b) => b - a)[0]
        ),
      };
      const allCompleted = (tasks) => tasks.length > 0 && tasks.every(t => t.status === "Completed");

const actual = {
  Guardianship: allCompleted(grouped.Guardianship)
    ? safeDateString(
        grouped.Guardianship
          .map(t => t.completed_at)
          .filter(Boolean)
          .map(d => new Date(d))
          .sort((a, b) => b - a)[0]
      )
    : safeDateString(
        grouped.Guardianship
          .map(t => t.due_date)
          .filter(Boolean)
          .map(d => new Date(d))
          .sort((a, b) => b - a)[0]
      ),
  
  LTC: allCompleted(grouped.LTC)
    ? safeDateString(
        grouped.LTC
          .map(t => t.completed_at)
          .filter(Boolean)
          .map(d => new Date(d))
          .sort((a, b) => b - a)[0]
      )
    : safeDateString(
        grouped.LTC
          .map(t => t.due_date)
          .filter(Boolean)
          .map(d => new Date(d))
          .sort((a, b) => b - a)[0]
      ),
};

      
      
      
      
      res.json({
        projected,
        actual,
        grouped,
      });
      
    } catch (err) {
      console.error("❌ Projected Timeline Report Error:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };
  



module.exports = { getDailyReport, getPriorityReport,getTransitionalCareReport ,getHistoricalTimelineReport,getProjectedTimelineReport};