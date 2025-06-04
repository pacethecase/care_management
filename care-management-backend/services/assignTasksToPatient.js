const pool = require("../models/db");
const { DateTime } = require('luxon');

const assignTasksToPatient = async (patientId, timezone, selectedAlgorithms = [], addedAlgorithms = [], removedAlgorithms = []) => {
  try {
    const { rows: [patient] } = await pool.query(`SELECT * FROM patients WHERE id = $1`, [patientId]);
    if (!patient) return console.error("❌ Patient not found.");

    const staffResult = await pool.query(`SELECT staff_id FROM patient_staff WHERE patient_id = $1`, [patientId]);
    const staffIds = staffResult.rows.map(r => r.staff_id);
    if (staffIds.length === 0) return console.warn("⚠️ No staff assigned.");

    const taskRes = await pool.query(`SELECT id, name, algorithm FROM tasks`);
    const tasks = taskRes.rows;
    const taskMap = new Map(tasks.map(t => [t.name, t.id]));
    const taskIdToAlgorithm = new Map(tasks.map(t => [t.id, t.algorithm]));

    const assignedRes = await pool.query(`SELECT task_id FROM patient_tasks WHERE patient_id = $1`, [patientId]);
    const alreadyAssigned = new Set(assignedRes.rows.map(r => r.task_id));

    const taskAssignments = [];

    const toggleVisibilityRecursive = async (rootTaskId, isVisible) => {
      const visibility = isVisible ? 'TRUE' : 'FALSE';
      const visited = new Set();
      const queue = [rootTaskId];

      while (queue.length > 0) {
        const taskId = queue.pop();
        if (visited.has(taskId)) continue;
        visited.add(taskId);

        await pool.query(
          `UPDATE patient_tasks SET is_visible = ${visibility} WHERE patient_id = $1 AND task_id = $2`,
          [patientId, taskId]
        );

        const { rows: deps } = await pool.query(
          `SELECT task_id FROM task_dependencies WHERE depends_on_task_id = $1`,
          [taskId]
        );
        deps.forEach(d => queue.push(d.task_id));
      }
    };

    for (const algorithm of removedAlgorithms) {
      const toHide = tasks.filter(t => t.algorithm === algorithm);
      for (const task of toHide) {
        await toggleVisibilityRecursive(task.id, false);
      }
    }

    const assignTask = (name, days = 0, condition = true) => {
  const taskId = taskMap.get(name);
  if (!taskId) return console.warn(`⚠️ Task "${name}" not found.`);

  const visible = !!condition;
  if (alreadyAssigned.has(taskId)) {
    toggleVisibilityRecursive(taskId, visible);
    return;
  }

  if (!visible) return; // Don't assign if condition is false

const admittedDate = patient.created_at  || new Date();

const dueLocal = DateTime.fromJSDate(admittedDate, { zone: timezone })
  .plus({ days }) // Use your task-specific offset here
  .set({ hour: 23, minute: 59, second: 0, millisecond: 0 });

  const dueDate = dueLocal.toUTC().toJSDate();
  const idealDueDate = dueLocal.toUTC().toJSDate();
  taskAssignments.push([patientId, taskId, 'Pending', dueDate, idealDueDate, true]);
  console.log(`✔ Assigned new task '${name}' for ${dueDate.toDateString()}`);
};

    // Use selectedAlgorithms (not addedAlgorithms) for dynamic task visibility logic
    if (selectedAlgorithms.includes("Behavioral")) {
      assignTask("Behavioral Management Contract Created", 2, patient.is_behavioral);
      assignTask("Behavioral Management Medication Assessment", 1, patient.is_behavioral);
      assignTask("Behavioral Management Daily Nursing Documentation", 0, patient.is_behavioral);
      assignTask("Behavioral Management Restraint Assessment of Appropriateness", 0, patient.is_restrained);
 
 assignTask("Behavioral Intervention Team Consult", 0, patient.is_behavioral_team);
   

        assignTask("Behavioral Management Psychiatry Consult", 2, !patient.is_geriatric_psych_available);

        assignTask("Behavioral Management Geriatric Psychiatry Consult", 2, patient.is_geriatric_psych_available);
      
    }

if (selectedAlgorithms.includes("Guardianship")) {
  const { 
    is_guardianship_financial, 
    is_guardianship_person, 
    is_guardianship_emergency 
  } = patient;


  const needsGuardianship = is_guardianship_financial || is_guardianship_person;
  console.log(needsGuardianship)
  console.log(is_guardianship_emergency)
  if (needsGuardianship) {

      assignTask("Guardianship - Appropriate Office Contacted for Emergency Petition ASAP", 1,is_guardianship_emergency);
      assignTask("Guardianship - Emergency Court Petition Initiated", 2,is_guardianship_emergency);

      assignTask("Guardianship - Identify Guardian", 3,!is_guardianship_emergency);
      assignTask("Guardianship - Appropriate Office Contacted ASAP", 5,!is_guardianship_emergency);
      assignTask("Guardianship - Permanent Court Petition Initiated", 7,!is_guardianship_emergency);
    }
  
  // This one only applies if it's financial (not person)
  assignTask("Guardianship - Is a financial inventory of patient assets required?", 1, is_guardianship_financial);
}


    if (selectedAlgorithms.includes("LTC")) {
      assignTask("LTC - Initiate appropriate application process", 2, patient.is_ltc);
        
 assignTask("LTC - Complete the Medical Eligibility Assessment application / required forms and compile supporting medical documentation", 5, patient.is_ltc_medical);
      
     
      assignTask("LTC -  Complete Financial Screening and Determine Eligibility", 3, patient.is_ltc_financial);
   
  }

    if (taskAssignments.length > 0) {
      const insertQuery = `
        INSERT INTO patient_tasks (patient_id, task_id, status, due_date, ideal_due_date, is_visible)
        VALUES ${taskAssignments.map((_, i) =>
          `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`
        ).join(', ')}`;

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

