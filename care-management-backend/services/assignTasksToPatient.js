// services/assignTasksToPatient.js
const pool = require("../models/db");
const { DateTime } = require("luxon");

const assignTasksToPatient = async (
  patientId,
  timezone,
  _ignored      = [],
  addedAlgorithms   = [],
  removedAlgorithms = []
) => {
  try {
    const { rows: [patient] } = await pool.query(
      `SELECT * FROM patients WHERE id = $1`,
      [patientId]
    );
    if (!patient) return console.error("Patient not found:", patientId);

    const { rows: staffRows } = await pool.query(
      `SELECT staff_id FROM patient_staff WHERE patient_id = $1`,
      [patientId]
    );
    if (!staffRows.length) {
      console.warn("No staff assigned to patient", patientId, "— skipping task assignment.");
      return;
    }

    const { rows: taskRows } = await pool.query(`SELECT id, name, algorithm FROM tasks`);
    const taskMap = new Map(taskRows.map(t => [t.name, t.id]));

    // ── Hide/show a task and all its dependents recursively ──────────────────
    const toggleVisibilityRecursive = async (rootTaskId, isVisible) => {
      const visited = new Set();
      const queue   = [rootTaskId];

      while (queue.length) {
        const taskId = queue.pop();
        if (visited.has(taskId)) continue;
        visited.add(taskId);

        await pool.query(
          `UPDATE patient_tasks SET is_visible = $3
           WHERE patient_id = $1 AND task_id = $2`,
          [patientId, taskId, isVisible]
        );

        const { rows } = await pool.query(
          `SELECT task_id FROM task_dependencies WHERE depends_on_task_id = $1`,
          [taskId]
        );
        rows.forEach(r => queue.push(r.task_id));
      }
    };

    // ── Hide tasks for removed algorithms ─────────────────────────────────────
    for (const algorithm of removedAlgorithms) {
      const toHide = taskRows.filter(t => t.algorithm === algorithm);
      for (const task of toHide) {
        await toggleVisibilityRecursive(task.id, false);
      }
    }

    const assignTask = async (name, days = 0, condition = true, noDueDate = false) => {
      const taskId = taskMap.get(name);
      if (!taskId) return console.warn(`Task "${name}" not found in tasks table`);

      if (!condition) {
        await toggleVisibilityRecursive(taskId, false);
        return;
      }

      const { rows: existing } = await pool.query(
        `SELECT id, status FROM patient_tasks WHERE patient_id = $1 AND task_id = $2`,
        [patientId, taskId]
      );

      if (existing.length) {
        await toggleVisibilityRecursive(taskId, true);
        return;
      }


      let dueDate    = null;
      let idealDueDate = null;

      if (!noDueDate) {
        const localDue = DateTime.now()
          .setZone(timezone)
          .plus({ days })
          .set({ hour: 23, minute: 59, second: 0, millisecond: 0 });

        dueDate      = localDue.toUTC().toISO();
        idealDueDate = dueDate;
      }

      await pool.query(
        `INSERT INTO patient_tasks
           (patient_id, task_id, status, due_date, ideal_due_date, is_visible)
         VALUES ($1, $2, 'Pending', $3, $4, TRUE)`,
        [patientId, taskId, dueDate, idealDueDate]
      );
    };


    const { rows: currentAlgoRows } = await pool.query(
      `SELECT algorithm FROM patient_algorithms
       WHERE patient_id = $1 AND removed_at IS NULL`,
      [patientId]
    );
    const { rows: everAlgoRows } = await pool.query(
      `SELECT DISTINCT algorithm FROM patient_algorithms WHERE patient_id = $1`,
      [patientId]
    );

    const activeAlgorithms  = currentAlgoRows.map(r => r.algorithm);
    const historyAlgorithms = everAlgoRows.map(r => r.algorithm);
    const effectiveAlgorithms = Array.from(new Set([...historyAlgorithms, ...activeAlgorithms]));

    if (activeAlgorithms.includes("Behavioral")) {
      await assignTask("Behavioral Management Contract Created",                                   2, patient.is_behavioral);
      await assignTask("Behavioral Management Medication Assessment",                              1, patient.is_behavioral);
      await assignTask("Behavioral Management Daily Nursing Documentation",                        0, patient.is_behavioral);
      await assignTask("Behavioral Management Restraint Assessment of Appropriateness",            0, patient.is_restrained);
      await assignTask("Behavioral Intervention Team Consult",                                     0, patient.is_behavioral_team);
      await assignTask("Behavioral Management Psychiatry Consult",                                 2, !patient.is_geriatric_psych_available);
      await assignTask("Behavioral Management Geriatric Psychiatry Consult",                       2, patient.is_geriatric_psych_available);
      await assignTask("Behavioral - Family/Complex Care Meeting",                                 0, patient.is_behavioral, true);
      await assignTask("Behavioral - Attempt to negotiate skilled rate with insurance company as applicable", 0, patient.is_behavioral, true);
    }

    if (activeAlgorithms.includes("Guardianship")) {
      const { is_guardianship_financial, is_guardianship_person, is_guardianship_emergency } = patient;
      const needs = is_guardianship_financial || is_guardianship_person;

      if (needs) {
        await assignTask("Guardianship - Appropriate Office Contacted for Emergency Petition ASAP", 1, is_guardianship_emergency);
        await assignTask("Guardianship - Emergency Court Petition Initiated",                       2, is_guardianship_emergency);
        await assignTask("Guardianship - Identify Guardian",                                        3, !is_guardianship_emergency);
        await assignTask("Guardianship - Appropriate Office Contacted ASAP",                        5, !is_guardianship_emergency);
        await assignTask("Guardianship - Permanent Court Petition Initiated",                       7, !is_guardianship_emergency);
      }

      await assignTask("Guardianship - Family/Complex Care Meeting",                                0, patient.is_guardianship, true);
      await assignTask("Guardianship - Attempt to negotiate skilled rate with insurance company as applicable", 0, patient.is_guardianship, true);
      await assignTask("Guardianship - Is a financial inventory of patient assets required?",       1, is_guardianship_financial);
      await assignTask("Guardianship - Cognitive Status Check", 14, patient.is_guardianship);
    }

    if (activeAlgorithms.includes("LTC")) {
      await assignTask("LTC - Initiate appropriate application process",                            2, patient.is_ltc);
      await assignTask("LTC - Complete the Medical Eligibility Assessment application / required forms and compile supporting medical documentation", 5, patient.is_ltc_medical);
      await assignTask("LTC -  Complete Financial Screening and Determine Eligibility",             3, patient.is_ltc_financial);
      await assignTask("LTC - Family/Complex Care Meeting",                                         0, patient.is_ltc, true);
      await assignTask("LTC - Attempt to negotiate skilled rate with insurance company as applicable", 0, patient.is_ltc, true);
    }

  } catch (err) {
    console.error("Error in assignTasksToPatient:", err);
  }
};

module.exports = assignTasksToPatient;