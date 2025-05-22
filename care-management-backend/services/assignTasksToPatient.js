const pool = require("../models/db");
const { DateTime } = require('luxon');

const assignTasksToPatient = async (patientId, timezone, selectedAlgorithms = []) => {
  try {
    console.log(`🚀 Assigning tasks to patient ID: ${patientId}...`);

    const { rows: [patient] } = await pool.query(`SELECT * FROM patients WHERE id = $1`, [patientId]);
    if (!patient) return console.error("❌ Patient not found.");

    const staffResult = await pool.query(
      `SELECT staff_id FROM patient_staff WHERE patient_id = $1`, [patientId]
    );
    const staffIds = staffResult.rows.map(r => r.staff_id);
    if (staffIds.length === 0) return console.warn("⚠️ No staff assigned.");

    const taskQuery = `
      SELECT id, name, algorithm FROM tasks
      ${selectedAlgorithms.length > 0 ? `WHERE algorithm = ANY($1)` : ''}
    `;
    const taskRes = await pool.query(taskQuery, selectedAlgorithms.length > 0 ? [selectedAlgorithms] : []);
    const tasks = taskRes.rows;
    const taskMap = new Map(tasks.map(t => [t.name, t.id]));

    const assignedRes = await pool.query(
      `SELECT task_id FROM patient_tasks WHERE patient_id = $1`, [patientId]
    );
    const alreadyAssigned = new Set(assignedRes.rows.map(r => r.task_id));
    const taskAssignments = [];

    const assignTask = async (name, days = 0, condition = true) => {
      const taskId = taskMap.get(name);
      if (!taskId) return console.warn(`⚠️ Task "${name}" not found.`);

      if (alreadyAssigned.has(taskId)) {
        const visibility = condition ? 'TRUE' : 'FALSE';
        console.log(`${condition ? "🔄 Unhiding" : "👻 Hiding"} task "${name}"`);
      
        // Step 1: Update the base task visibility
        await pool.query(
          `UPDATE patient_tasks SET is_visible = ${visibility} WHERE patient_id = $1 AND task_id = $2`,
          [patientId, taskId]
        );
      
        // Step 2: Fetch dependent task IDs
        const depRes = await pool.query(`
          SELECT t.id AS dep_task_id
          FROM task_dependencies td
          JOIN tasks t ON td.task_id = t.id
          WHERE td.depends_on_task_id = $1
        `, [taskId]);
      
        // Step 3: Update visibility of dependent tasks
        for (const { dep_task_id } of depRes.rows) {
          console.log(`↪️ ${condition ? "Unhiding" : "Hiding"} dependent task ID: ${dep_task_id}`);
          await pool.query(
            `UPDATE patient_tasks SET is_visible = ${visibility}
             WHERE patient_id = $1 AND task_id = $2`,
            [patientId, dep_task_id]
          );
        }
      
        return;
      }
      

      if (!condition) return;

      const dueLocal = DateTime.local().setZone(timezone).plus({ days }).set({ hour: 15 });
      const dueDate = dueLocal.toUTC().toJSDate();
      const idealDueDate = dueLocal.toUTC().toJSDate();

      taskAssignments.push([patientId, taskId, 'Pending', dueDate, idealDueDate]);
      console.log(`✔ Task '${name}' scheduled for ${dueDate.toDateString()}`);
    };

    // 🔁 Behavioral
    if (patient.is_behavioral) {
      await assignTask("Behavioral Contract Created", 2);
      await assignTask("Medication Assessment", 1);
      await assignTask("Daily Nursing Documentation", 0);
      await assignTask("Assessment of Appropriateness", 0, patient.is_restrained);
      await assignTask("Behavioral Intervention Team", 0, patient.is_behavioral_team);

      if (patient.age < 65 || !patient.is_geriatric_psych_available) {
        await assignTask("Psychiatry Consult", 2);
      } else {
        await assignTask("Geriatric Psychiatry Consult", 2);
      }
    }

    // 🔁 Guardianship
    if (patient.is_guardianship) {
      const emergency = patient.is_guardianship_emergency;
      if (patient.is_guardianship_financial || patient.is_guardianship_person) {
        if (emergency) {
          await assignTask("Appropriate Office Contacted ASAP", 1);
          await assignTask("Emergency Court Petition Initiated", 2);
        } else {
          await assignTask("Identify Guardian", 3);
          await assignTask("Appropriate Office Contacted ASAP", 5);
          await assignTask("Permanent Court Petition Initiated", 7);
        }
      }
      await assignTask("Financial inventory of patient assets required", 1, patient.is_guardianship_financial);
    }

    // 🔁 LTC
    if (patient.is_ltc) {
      await assignTask("Initiate appropriate application process", 2);
      await assignTask(
        "Complete the Medical Eligibility Assessment application / required forms and compile supporting medical documentation",
        5,
        patient.is_ltc_medical
      );
      await assignTask("Complete Financial Screening and Determine Eligibility", 3, patient.is_ltc_financial);
    }

    // 🧠 Save all new task assignments
    if (taskAssignments.length > 0) {
      const insertQuery = `
        INSERT INTO patient_tasks (patient_id, task_id, status, due_date, ideal_due_date)
        VALUES ${taskAssignments.map((_, i) =>
          `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
        ).join(', ')}
      `;
      await pool.query(insertQuery, taskAssignments.flat());
      console.log(`✅ ${taskAssignments.length} new tasks assigned.`);
    } else {
      console.log("⚠️ No new tasks to assign.");
    }
  } catch (err) {
    console.error("❌ Error assigning tasks:", err.message);
  }
};

module.exports = assignTasksToPatient;
