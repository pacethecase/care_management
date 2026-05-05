// services/insertTasks.js (or scripts/insertTasks.js)
const pool  = require("../models/db");
const tasks = require("./data/taskTemplate");

const insertTasks = async () => {
  try {
    console.log("Inserting tasks into the database...");

    for (const task of tasks) {
      await pool.query(
        `INSERT INTO tasks (
           name, description,
           is_overridable, is_repeating, recurrence_interval, max_repeats,
           condition_required, category, due_in_days_after_dependency,
           is_non_blocking, is_court_date, algorithm
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (name) DO NOTHING`,
        [
          task.name,
          task.description,
          task.is_overridable        ?? false,
          task.is_repeating          ?? false,
          task.recurrence_interval   ?? null,
          task.max_repeats           ?? null,
          task.condition_required    ?? null,
          task.category              ?? null,
          task.due_in_days_after_dependency ?? null,
          task.is_non_blocking       ?? false,
          task.is_court_date         ?? false,
          task.algorithm             ?? null,
        ]
      );
    }
    console.log("All tasks inserted.");

    // Step 2: Fetch task IDs
    const { rows } = await pool.query(`SELECT id, name FROM tasks`);
    const taskMap  = new Map(rows.map(r => [r.name, r.id]));

    // Step 3: Insert task dependencies
    for (const task of tasks) {
      if (!task.dependency_name) continue;

      const taskId      = taskMap.get(task.name);
      if (!taskId) continue;

      const dependencies = Array.isArray(task.dependency_name)
        ? task.dependency_name
        : [task.dependency_name];

      for (const depName of dependencies) {
        const depId = taskMap.get(depName);
        if (!depId) {
          console.warn(`Dependency not found: "${depName}" (needed by "${task.name}")`);
          continue;
        }
        await pool.query(
          `INSERT INTO task_dependencies (task_id, depends_on_task_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [taskId, depId]
        );
      }
    }
    console.log("All dependencies added.");

  } catch (err) {
    console.error("Error inserting tasks:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

insertTasks();