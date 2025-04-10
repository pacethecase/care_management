const pool = require("../models/db");
const tasks = require("./data/taskTemplate");

const insertTasks = async () => {
  try {
    console.log("🚀 Inserting tasks into the database...");

    // ✅ Step 1: Insert All Tasks
    for (const task of tasks) {
      await pool.query(
        `INSERT INTO tasks (name, description, is_repeating, recurrence_interval, max_repeats, condition_required, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (name) DO NOTHING`,
        [
          task.name,
          task.description,
          task.is_repeating,
          task.recurrence_interval,
          task.max_repeats,
          task.condition_required,
          task.category
        ]
      );
    }
    console.log("✅ All tasks inserted successfully!");

    // ✅ Step 2: Fetch Task IDs for Dependency Mapping
    const { rows } = await pool.query("SELECT id, name FROM tasks");
    const taskMap = new Map(rows.map(t => [t.name, t.id]));

    // ✅ Step 3: Update Dependencies
    for (const task of tasks) {
      if (task.dependency_name) {
        const dependencyId = taskMap.get(task.dependency_name);
        if (!dependencyId) {
          console.warn(`Dependency not found for: ${task.name}`);
          continue;
        }

        await pool.query(
          `UPDATE tasks SET dependency_task_id = $1 WHERE name = $2`,
          [dependencyId, task.name]
        );
        console.log(`Linked ${task.name} → depends on ${task.dependency_name}`);
      }
    }

    console.log("Dependencies updated successfully!");
  } catch (err) {
    console.error("Error during task insertion:", err.message);
  } finally {
    pool.end();
  }
};

// ✅ Run it
insertTasks();