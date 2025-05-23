const pool = require("../models/db");
const { DateTime } = require('luxon');

const assignTasksToPatient = async (patientId, timezone, selectedAlgorithms = [], addedAlgorithms = [], removedAlgorithms = []) => {
  try {
    const { rows: [patient] } = await pool.query(`SELECT * FROM patients WHERE id = $1`, [patientId]);
    if (!patient) return console.error("❌ Patient not found.");

    const staffResult = await pool.query(`SELECT staff_id FROM patient_staff WHERE patient_id = $1`, [patientId]);
    const staffIds = staffResult.rows.map(r => r.staff_id);
    if (staffIds.length === 0) return console.warn("⚠️ No staff assigned.");

    // Fetch all tasks
    const taskRes = await pool.query(`SELECT id, name, algorithm FROM tasks`);
    const tasks = taskRes.rows;
    const taskMap = new Map(tasks.map(t => [t.name, t.id]));
    const taskIdToAlgorithm = new Map(tasks.map(t => [t.id, t.algorithm]));

    // Fetch already assigned task IDs
    const assignedRes = await pool.query(`SELECT task_id FROM patient_tasks WHERE patient_id = $1`, [patientId]);
    const alreadyAssigned = new Set(assignedRes.rows.map(r => r.task_id));

    const taskAssignments = [];

    // 🔁 Recursive visibility handler
    const toggleVisibilityRecursive = async (rootTaskId, isVisible) => {
      const visibility = isVisible ? 'TRUE' : 'FALSE';
      const visited = new Set();
      const queue = [rootTaskId];

      while (queue.length > 0) {
        const taskId = queue.pop();
        if (visited.has(taskId)) continue;
        visited.add(taskId);

        await pool.query(
          `UPDATE patient_tasks
           SET is_visible = ${visibility}
           WHERE patient_id = $1 AND task_id = $2`,
          [patientId, taskId]
        );

        const { rows: deps } = await pool.query(
          `SELECT task_id FROM task_dependencies WHERE depends_on_task_id = $1`,
          [taskId]
        );
        deps.forEach(d => queue.push(d.task_id));
      }
    };

    // 🔻 Step 1: Hide tasks from removed algorithms
    for (const algorithm of removedAlgorithms) {
      const toHide = tasks.filter(t => t.algorithm === algorithm);
      for (const task of toHide) {
        await toggleVisibilityRecursive(task.id, false);
      }
    }

    // 🔺 Step 2: Unhide or assign tasks for added algorithms
    const assignTask = (name, days = 0,condition = true) => {
      const taskId = taskMap.get(name);
      if (!taskId) return console.warn(`⚠️ Task "${name}" not found.`);

      if (alreadyAssigned.has(taskId)) {
        toggleVisibilityRecursive(taskId, condition);
        return;
      }

      const dueLocal = DateTime.local().setZone(timezone).plus({ days }).set({ hour: 15 });
      const dueDate = dueLocal.toUTC().toJSDate();
      const idealDueDate = dueLocal.toUTC().toJSDate();
      taskAssignments.push([patientId, taskId, 'Pending', dueDate, idealDueDate, true]);
      console.log(`✔ Assigned new task '${name}' for ${dueDate.toDateString()}`);
    };

    // 🔁 Reassign tasks based on current flags
   if (patient.is_behavioral) {
  await assignTask("Behavioral Contract Created", 2, patient.is_behavioral);
  await assignTask("Medication Assessment", 1, patient.is_behavioral);
  await assignTask("Daily Nursing Documentation", 0, patient.is_behavioral);
  await assignTask("Assessment of Appropriateness", 0, patient.is_restrained);
  await assignTask("Behavioral Intervention Team", 0, patient.is_behavioral_team);

  if (patient.age < 65 || !patient.is_geriatric_psych_available) {
    await assignTask("Psychiatry Consult", 2, patient.is_behavioral);
  } else {
    await assignTask("Geriatric Psychiatry Consult", 2, patient.is_behavioral);
  }
}


  if (patient.is_guardianship) {
  const emergency = patient.is_guardianship_emergency;

  if (patient.is_guardianship_financial || patient.is_guardianship_person) {
    if (emergency) {
      await assignTask("Appropriate Office Contacted ASAP", 1, true);
      await assignTask("Emergency Court Petition Initiated", 2, true);
    } else {
      await assignTask("Identify Guardian", 3, true);
      await assignTask("Appropriate Office Contacted ASAP", 5, true);
      await assignTask("Permanent Court Petition Initiated", 7, true);
    }
  }

  await assignTask("Financial inventory of patient assets required", 1, patient.is_guardianship_financial);
}


      if (patient.is_ltc) {
      await assignTask("Initiate appropriate application process", 2, patient.is_ltc); // Always assign if parent is true
      await assignTask("Complete the Medical Eligibility Assessment application / required forms and compile supporting medical documentation", 5, patient.is_ltc_medical);
      await assignTask("Complete Financial Screening and Determine Eligibility", 3, patient.is_ltc_financial);
    }


    // 🧠 Insert newly assigned tasks
    if (taskAssignments.length > 0) {
      const insertQuery = `
        INSERT INTO patient_tasks (patient_id, task_id, status, due_date, ideal_due_date, is_visible)
        VALUES ${taskAssignments.map((_, i) =>
          `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`
        ).join(', ')}
      `;
      await pool.query(insertQuery, taskAssignments.flat());
      console.log(`✅ ${taskAssignments.length} new tasks inserted.`);
    } else {
      console.log("⚠️ No new tasks to insert.");
    }

  } catch (err) {
    console.error("❌ Error in assignTasksToPatient:", err.message);
  }
};

module.exports = assignTasksToPatient;
