import React from "react";

type Task = {
  task_name: string;
  status: string;
  due_date: string;
  completed_at?: string;
  missed_reason?: string;
};

type ReportData = {
  projected: Record<string, string>;
  actual: Record<string, string>;
  grouped: Record<string, Task[]>;
};

const statusColors: Record<string, string> = {
  "Pending": "var(--primary-blue)",
  "In Progress": "var(--primary-blue)",
  "Completed": "var(--primary-green)",
  "Missed": "var(--primary-red)",
  "Delayed Completed": "var(--primary-green)",
};

const ProjectedTimelineReport: React.FC<{ data: ReportData }> = ({ data }) => {
  if (!data || !data.grouped) return <p>No timeline data available.</p>;

  const { projected, actual, grouped } = data;

  return (
    <div className="text-black text-sm leading-snug print:text-black print:bg-white font-bold">
      {["Guardianship", "LTC"].map((algo) => {
        const tasks = grouped[algo];
        if (!tasks || tasks.length === 0) return null;

        return (
          <div key={algo} className="mb-10">
            <h2 className="text-xl font-bold text-orange mb-2">{algo} Workflow</h2>
            <p className="mb-4">
              🟩 <strong>Projected Completion:</strong> {projected[algo]} &nbsp;&nbsp;
              🟦 <strong>New Projected Completion:</strong> {actual[algo] || "Not yet completed"}
            </p>

         <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded shadow-sm timeline-container">

              {/* Start Block */}
              <div className="px-3 py-2 rounded bg-gray-200 text-black font-bold print-admitted">
                Patient Admitted
              </div>

              {tasks.map((task, i) => (
                <React.Fragment key={i}>
                  <span className="text-lg font-bold">➡️</span>

                  <div
                  className={`print-task-box print-${task.status.replace(/\s+/g, "-")}`}
                    style={{
                      backgroundColor: statusColors[task.status] || "#ccc",
                      color: "#000",
                      minWidth: "170px",
                      maxWidth: "200px",
                      fontSize: "12px",
                    }}
                  >
                    <div className="font-bold mb-1">{task.task_name}</div>
                    <div className="font-semibold mb-1">Status: {task.status}</div>
                    <div className="font-semibold mb-1">Due: {new Date(task.due_date).toLocaleDateString()}</div>
                    {task.completed_at && (
                      <div className="font-semibold mb-1">Completed: {new Date(task.completed_at).toLocaleDateString()}</div>
                    )}
                    {task.missed_reason && (
                      <div className="font-semibold mb-1">
                        Reason: {task.missed_reason}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              ))}

              <span className="text-lg font-bold print-arrow">➡️</span>
              <div className="px-3 py-2 rounded bg-violet-100 text-purple-900 font-bold  print-final-step">
                Final Step: {actual[algo] || projected[algo]}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProjectedTimelineReport;
