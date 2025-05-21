import React from "react";

const labelColors = {
  "✅ On Time": "#00a63e",   // green
  "⚠️ Late": "#ffdf20",       // yellow
  "❌ Missed": "#fb2c36",     // red
  "⏳ Pending": "#3b82f6",    // blue
};

const textColors = {
  "✅ On Time": "#fff",
  "⚠️ Late": "#fff",
  "❌ Missed": "#fff",
  "⏳ Pending": "#fff",
};
type Task = {
    task_name: string;
    label: "✅ On Time" | "⚠️ Late" | "❌ Missed" | "⏳ Pending";
    due_date: string;
    completed_at?: string;
    missed_reason?: string;
  };
  
  type ReportData = {
    projected: Record<string, string>;
    actual: Record<string, string>;
    grouped: Record<string, Task[]>;
  };
  
const ProjectedTimelineReport = ({ data }: { data: ReportData }) => {
  if (!data || !data.grouped) return <p>No timeline data available.</p>;

  const { projected, actual, grouped } = data;

  return (
    <div style={{ fontSize: "13px", lineHeight: "1.4" }}>
      {["Guardianship", "LTC"].map((algo) => {
        const tasks = grouped[algo];
        if (!tasks || tasks.length === 0) return null;

        return (
          <div key={algo} style={{ marginBottom: "2.5rem" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#FF7F00" }}>{algo} Workflow</h2>
            <p style={{ marginBottom: "1rem" }}>
              🟩 <strong>Projected Completion:</strong> {projected[algo]} &nbsp;&nbsp;
              🟦 <strong>New Projected Completion:</strong> {actual[algo] || "Not yet completed"}
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                padding: "10px",
             
                background: "#fff"
              }}
            >
              {/* Start box */}
              <div
                style={{
                  background: "#dbeafe",
                  color: "#1e3a8a",
                  fontWeight: 600,
                  padding: "6px 12px",
                  borderRadius: "5px",
                  whiteSpace: "nowrap"
                }}
              >
                Patient Admitted
              </div>

              {/* Tasks */}
              {tasks.map((task, i) => {
                const bg = labelColors[task.label] || "#f3f4f6";
                const textColor = textColors[task.label] || "#374151";

                return (
                  <React.Fragment key={i}>
                    <span style={{ fontSize: "18px", marginTop: "auto", marginBottom: "auto" }}>➡️</span>

                    <div
                      style={{
                        background: bg,
                        color: textColor,
                        padding: "10px",
                        borderRadius: "5px",
                        minWidth: "170px",
                        maxWidth: "200px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                        fontSize: "12px"
                      }}
                      title={task.task_name}
                    >
                      <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "4px", overflowWrap: "break-word" }}>
                        {task.task_name}
                      </div>
                      <div>{task.label}</div>
                      <div>Due: {new Date(task.due_date).toLocaleDateString()}</div>
                      {task.completed_at && (
                        <div>Completed: {new Date(task.completed_at).toLocaleDateString()}</div>
                      )}
                      {task.missed_reason && (
                        <div style={{ color: "#b91c1c", fontStyle: "italic", marginTop: "4px" }}>
                          Reason: {task.missed_reason}
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}

              {/* Final Step */}
              <span style={{ fontSize: "18px", marginTop: "auto", marginBottom: "auto" }}>➡️</span>
              <div
                style={{
                  background: "#ede9fe",
                  color: "#5b21b6",
                  fontWeight: 600,
                  padding: "6px 12px",
                  borderRadius: "5px",
                  whiteSpace: "nowrap"
                }}
              >
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
