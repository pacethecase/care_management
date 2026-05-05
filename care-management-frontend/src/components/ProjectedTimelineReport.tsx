// src/components/ProjectedTimelineReport.tsx
import React from "react";
import { useHospitalTimezone } from "../hooks/timezone";

type Task = {
  task_name:      string;
  status:         string;
  due_date:       string;
  ideal_due_date: string;
  completed_at?:  string;
  missed_reason?: string;
};

type ReportData = {
  projected:        Record<string, string>;
  actual:           Record<string, string>;
  grouped:          Record<string, Task[]>;
  // FIX: was selectedAlgorithms — now activeAlgorithms from patient_algorithms table
  activeAlgorithms: string[];
};

const statusColors: Record<string, string> = {
  "Pending":          "var(--primary-blue)",
  "In Progress":      "var(--primary-blue)",
  "Completed":        "var(--primary-green)",
  "Missed":           "var(--primary-red)",
  "Delayed Completed":"var(--primary-green)",
};

const ProjectedTimelineReport: React.FC<{ data: ReportData }> = ({ data }) => {
  // FIX: formatDate → formatDateTime (correct hook method name)
  const { formatDateTime } = useHospitalTimezone();

  if (!data?.grouped) return <p>No timeline data available.</p>;

  const { projected, actual, grouped, activeAlgorithms = [] } = data;

  return (
    <div className="text-black text-sm leading-snug print:text-black print:bg-white font-bold">
      {["Guardianship", "LTC"].map(algo => {
        const tasks = grouped[algo];
        if (!tasks?.length) return null;

        // FIX: use activeAlgorithms
        const isActive = activeAlgorithms.includes(algo);

        return (
          <div key={algo} className="mb-10">
            <h2 className="text-xl font-bold text-orange mb-2">
              {algo}{" "}
              {isActive ? (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Active</span>
              ) : (
                <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Previously Active</span>
              )}
            </h2>

            <p className="mb-4">
              <strong>Projected Completion:</strong> {projected[algo]} &nbsp;&nbsp;
              <strong>New Projected Completion:</strong> {actual[algo] || "Not yet completed"}
            </p>

            <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded shadow-sm timeline-container">
             <div className="px-3 py-2 rounded bg-violet-100 text-purple-900 font-bold print-final-step">
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
                    <div className="font-semibold mb-1">Ideal Due: {formatDateTime(task.ideal_due_date)}</div>
                    <div className="font-semibold mb-1">Due: {formatDateTime(task.due_date)}</div>
                    {task.completed_at && (
                      <div className="font-semibold mb-1">Completed: {formatDateTime(task.completed_at)}</div>
                    )}
                    {task.missed_reason && (
                      <div className="font-semibold mb-1">Reason: {task.missed_reason}</div>
                    )}
                  </div>
                </React.Fragment>
              ))}

              <span className="text-lg font-bold print-arrow">➡️</span>
              <div className="px-3 py-2 rounded bg-violet-100 text-purple-900 font-bold print-final-step">
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