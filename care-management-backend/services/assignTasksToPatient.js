const pool = require("../models/db");
const { DateTime } = require("luxon");

const assignTasksToPatient = async (
  patientId,
  timezone,
  _ignored = [],
  addedAlgorithms = [],
  removedAlgorithms = []
) => {
  try {
    const { rows: [patient] } = await pool.query(
      `SELECT * FROM patients WHERE id = $1`,
      [patientId]
    );
    if (!patient) return console.error("❌ Patient not found.");

    const staffResult = await pool.query(
      `SELECT staff_id FROM patient_staff WHERE patient_id = $1`,
      [patientId]
    );
    if (!staffResult.rows.length) {
      console.warn("⚠️ No staff assigned. Skipping tasks.");
      return;
    }

    const taskRes = await pool.query(`SELECT id, name, algorithm FROM tasks`);
    const tasks = taskRes.rows;
    const taskMap = new Map(tasks.map(t => [t.name, t.id]));

    const toggleVisibilityRecursive = async (rootTaskId, isVisible) => {
      const visited = new Set();
      const queue = [rootTaskId];

      while (queue.length) {
        const taskId = queue.pop();
        if (visited.has(taskId)) continue;
        visited.add(taskId);

        await pool.query(
          `UPDATE patient_tasks
           SET is_visible = $3
           WHERE patient_id = $1 AND task_id = $2`,
          [patientId, taskId, isVisible]
        );

        console.log(
          isVisible
            ? `👁️ UNHIDE Task ID ${taskId} for Patient ${patientId}`
            : `🙈 HIDE Task ID ${taskId} for Patient ${patientId}`
        );

        const { rows } = await pool.query(
          `SELECT task_id FROM task_dependencies WHERE depends_on_task_id = $1`,
          [taskId]
        );

        rows.forEach(r => queue.push(r.task_id));
      }
    };

    for (const algorithm of removedAlgorithms) {
      console.log(`🛑 Algorithm REMOVED: ${algorithm}`);
      const toHide = tasks.filter(t => t.algorithm === algorithm);

      for (const task of toHide) {
        await toggleVisibilityRecursive(task.id, false);
      }
    }

    const assignTask = async (name, days = 0, condition = true, noDueDate = false) => {
      const taskId = taskMap.get(name);
      if (!taskId) return console.warn(`⚠️ Task "${name}" not found`);

      if (!condition) {
        await toggleVisibilityRecursive(taskId, false);
        console.log(`🚫 Condition Off → Hide "${name}"`);
        return;
      }

      const { rows } = await pool.query(
        `SELECT id, status FROM patient_tasks WHERE patient_id=$1 AND task_id=$2`,
        [patientId, taskId]
      );

      if (rows.length) {
        await toggleVisibilityRecursive(taskId, true);
        console.log(`♻️ RESTORED "${name}"`);
        return;
      }


      let dueDate = null;
      let idealDueDate = null;

      if (!noDueDate) {
        const local = DateTime.now().setZone(timezone)
          .plus({ days })
          .set({ hour: 23, minute: 59, second: 0 });

        dueDate = local.toUTC().toJSDate();
        idealDueDate = dueDate;
      }

      await pool.query(
        `INSERT INTO patient_tasks
          (patient_id, task_id, status, due_date, ideal_due_date, is_visible)
         VALUES ($1,$2,'Pending',$3,$4,true)`,
        [patientId, taskId, dueDate, idealDueDate]
      );

      console.log(`✅ INSERTED NEW TASK "${name}"`);
    };

    const activeAlgorithms = [];
    if (patient.is_behavioral) activeAlgorithms.push("Behavioral");
    if (patient.is_guardianship) activeAlgorithms.push("Guardianship");
    if (patient.is_ltc) activeAlgorithms.push("LTC");


    const historyAlgorithms = patient.ever_selected_algorithms || [];
    const effectiveAlgorithms = Array.from(new Set([
      ...historyAlgorithms,
      ...activeAlgorithms
    ]));

    console.log("🧠 EVER USED:", historyAlgorithms);
    console.log("✅ CURRENT ACTIVE:", activeAlgorithms);
    console.log("🎯 EFFECTIVE ALGO:", effectiveAlgorithms);

    if (activeAlgorithms.includes("Behavioral")) {
      await assignTask("Behavioral Management Contract Created", 2, patient.is_behavioral);
      await assignTask("Behavioral Management Medication Assessment", 1, patient.is_behavioral);
      await assignTask("Behavioral Management Daily Nursing Documentation", 0, patient.is_behavioral);
      await assignTask("Behavioral Management Restraint Assessment of Appropriateness", 0, patient.is_restrained);
      await assignTask("Behavioral Intervention Team Consult", 0, patient.is_behavioral_team);
      await assignTask("Behavioral Management Psychiatry Consult", 2, !patient.is_geriatric_psych_available);
      await assignTask("Behavioral Management Geriatric Psychiatry Consult", 2, patient.is_geriatric_psych_available);
      await assignTask("Behavioral - Family/Complex Care Meeting", 0, patient.is_behavioral, true);
      await assignTask("Behavioral - Attempt to negotiate skilled rate with insurance company as applicable", 0, patient.is_behavioral, true);
    }

    if (activeAlgorithms.includes("Guardianship")) {
      const { is_guardianship_financial, is_guardianship_person, is_guardianship_emergency } = patient;
      const needs = is_guardianship_financial || is_guardianship_person;

      if (needs) {
        await assignTask("Guardianship - Appropriate Office Contacted for Emergency Petition ASAP", 1, is_guardianship_emergency);
        await assignTask("Guardianship - Emergency Court Petition Initiated", 2, is_guardianship_emergency);
        await assignTask("Guardianship - Identify Guardian", 3, !is_guardianship_emergency);
        await assignTask("Guardianship - Appropriate Office Contacted ASAP", 5, !is_guardianship_emergency);
        await assignTask("Guardianship - Permanent Court Petition Initiated", 7, !is_guardianship_emergency);
      }

      await assignTask("Guardianship - Family/Complex Care Meeting", 0, patient.is_guardianship, true);
      await assignTask("Guardianship - Attempt to negotiate skilled rate with insurance company as applicable", 0, patient.is_guardianship, true);
      await assignTask("Guardianship - Is a financial inventory of patient assets required?", 1, is_guardianship_financial);
    }


    if (activeAlgorithms.includes("LTC")) {
      await assignTask("LTC - Initiate appropriate application process", 2, patient.is_ltc);
      await assignTask("LTC - Complete the Medical Eligibility Assessment application / required forms and compile supporting medical documentation", 5, patient.is_ltc_medical);
      await assignTask("LTC -  Complete Financial Screening and Determine Eligibility", 3, patient.is_ltc_financial);
      await assignTask("LTC - Family/Complex Care Meeting", 0, patient.is_ltc, true);
      await assignTask("LTC - Attempt to negotiate skilled rate with insurance company as applicable", 0, patient.is_ltc, true);
    }

  } catch (err) {
    console.error("❌ Error in assignTasksToPatient:", err);
  }
};

module.exports = assignTasksToPatient;
