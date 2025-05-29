const pool = require("../models/db");
const tasks = require("./data/taskTemplate");

const insertTasks = async () => {
  try {
    console.log("🚀 Inserting tasks into the database...");

    // Step 1: Insert tasks
    for (const task of tasks) {
      await pool.query(
        `INSERT INTO tasks (
          name,
          description,
          is_overridable,
          is_repeating,
          recurrence_interval,
          max_repeats,
          condition_required,
          category,
          due_in_days_after_dependency,
          is_non_blocking,
          is_court_date,
          algorithm
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (name) DO NOTHING`,
        [
          task.name,
          task.description,
          task.is_overridable ?? false,
          task.is_repeating ?? false,
          task.recurrence_interval,
          task.max_repeats,
          task.condition_required,
          task.category,
          task.due_in_days_after_dependency,
          task.is_non_blocking ?? false,
          task.is_court_date ?? false,
          task.algorithm
        ]
      );
    }

    console.log("✅ All tasks inserted.");

    // Step 2: Fetch task IDs
    const { rows } = await pool.query("SELECT id, name FROM tasks");
    const taskMap = new Map(rows.map(row => [row.name, row.id]));

    // Step 3: Insert task dependencies into the junction table
    for (const task of tasks) {
      const taskId = taskMap.get(task.name);
      if (!taskId || !task.dependency_name) continue;

      const dependencies = Array.isArray(task.dependency_name)
        ? task.dependency_name
        : [task.dependency_name];

      for (const depName of dependencies) {
        const depId = taskMap.get(depName);
        if (depId) {
          await pool.query(
            `INSERT INTO task_dependencies (task_id, depends_on_task_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [taskId, depId]
          );
          console.log(`🔗 ${task.name} depends on ${depName}`);
        } else {
          console.warn(`⚠️ Dependency task not found: ${depName}`);
        }
      }
    }

    console.log("✅ All dependencies added via junction table.");
  } catch (err) {
    console.error("❌ Error inserting tasks:", err.message);
  } finally {
    await pool.end();
  }
};

insertTasks();
