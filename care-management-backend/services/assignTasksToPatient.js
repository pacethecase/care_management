const pool = require("../models/db");

const assignTasksToPatient = async (patientId) => {
  try {
    console.log(`🚀 Assigning tasks to patient ID: ${patientId}...`);

    // Step 1: Fetch patient
    const { rows: [patient] } = await pool.query(`SELECT * FROM patients WHERE id = $1`, [patientId]);
    if (!patient) {
      console.log("❌ Patient not found.");
      return;
    }

    if (!patient.assigned_staff_id) {
      console.warn("⚠️ Patient has no assigned staff. Skipping task assignment.");
      return;
    }

    console.log("✅ Patient Data:", {
      id: patient.id,
      age: patient.age,
      is_behavioral: patient.is_behavioral,
      is_restrained: patient.is_restrained,
      is_behavioral_team: patient.is_behavioral_team,
      is_geriatric_psych_available: patient.is_geriatric_psych_available
    });

    // Step 2: Fetch all tasks from DB
    const tasksResult = await pool.query(`
      SELECT id, name FROM tasks
    `);
    const tasks = tasksResult.rows;
    const taskMap = new Map(tasks.map(t => [t.name, t.id]));

    // Step 3: Get already assigned task IDs
    const assignedResult = await pool.query(
      `SELECT task_id FROM patient_tasks WHERE patient_id = $1`,
      [patient.id]
    );
    const alreadyAssigned = new Set(assignedResult.rows.map(r => r.task_id));

    // Step 4: Build assignments
    const taskAssignments = [];

    const assignTask = (taskName, dueInDays = 0) => {
      const taskId = taskMap.get(taskName);
      if (!taskId) {
        console.warn(`⚠️ Task "${taskName}" not found.`);
        return;
      }
      if (alreadyAssigned.has(taskId)) {
        console.log(`⏭️ Task "${taskName}" already assigned. Skipping.`);
        return;
      }

      const dueDate = new Date();
      dueDate.setHours(0, 0, 0, 0);
      dueDate.setDate(dueDate.getDate() + dueInDays);

      taskAssignments.push({ taskId, dueDate });
      console.log(`✔ Task '${taskName}' scheduled for ${dueDate.toDateString()}`);
    };

    // Step 5: Assignment Logic (Algorithm A)
    if (patient.is_behavioral) {
      assignTask("Behavioral Contract Created", 2);
      assignTask("Medication Assessment", 1);
      assignTask("Daily Nursing Documentation", 0);
    }

    if (patient.is_restrained) {
      assignTask("Assessment of Appropriateness", 0);
    }

    if (patient.is_behavioral_team) {
      assignTask("Behavioral Intervention Team", 0);
    }

    if (patient.age < 65) {
      assignTask("Psychiatry Consult", 2);
    } else if (!patient.is_geriatric_psych_available) {
      assignTask("Psychiatry Consult", 2);
    } else {
      assignTask("Geriatric Psychiatry Consult", 2);
    }

    // Step 6: Insert assignments into patient_tasks
    if (taskAssignments.length === 0) {
      console.log("⚠️ No new tasks assigned.");
      return;
    }

    // Sort by dueDate for order
    taskAssignments.sort((a, b) => a.dueDate - b.dueDate);

    const values = taskAssignments.map(({ taskId, dueDate }) => [
      patient.id,
      taskId,
      patient.assigned_staff_id,
      "Pending",
      dueDate
    ]);

    const insertQuery = `
      INSERT INTO patient_tasks (patient_id, task_id, assigned_staff_id, status, due_date)
      VALUES ${values.map((_, i) =>
        `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
      ).join(", ")}
    `;

    await pool.query(insertQuery, values.flat());
    console.log(`✅ ${taskAssignments.length} tasks assigned to patient.`);

  } catch (err) {
    console.error("❌ Error assigning tasks:", err.message);
  }
};

module.exports = assignTasksToPatient;
