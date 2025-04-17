const pool = require("../models/db");
const tasks = require("./data/taskTemplate");

const insertTasks = async () => {
  try {
    console.log("🚀 Inserting tasks into the database...");

    // Step 1: Insert tasks without dependency
    for (const task of tasks) {
      await pool.query(
        `INSERT INTO tasks (
          name, description, is_repeating, recurrence_interval, max_repeats, 
          condition_required, category, due_in_days_after_dependency,is_non_blocking,algorithm
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8,$9,$10)
        ON CONFLICT (name) DO NOTHING`,
        [
          task.name,
          task.description,
          task.is_repeating,
          task.recurrence_interval,
          task.max_repeats,
          task.condition_required,
          task.category,
          task.due_in_days_after_dependency,
          task.is_non_blocking,
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

      for (const depName of task.dependency_name) {
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
    pool.end();
  }
};

insertTasks();
