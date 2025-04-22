import React from "react";

interface TaskEntry {
  task_name: string;
  completed_at: string;
}

interface WeeklyTimeline {
  week: string;
  tasks: TaskEntry[];
}

interface HistoricalTimelineReportProps {
  report: {
    patient: {
      name: string;
      mrn: string;
      admitted_date: string;
    };
    timeline: WeeklyTimeline[];
  };
}

const HistoricalTimelineReport: React.FC<HistoricalTimelineReportProps> = ({ report }) => {
  if (!report || !Array.isArray(report.timeline)) return null;

  const { patient, timeline } = report;

  return (
    <div className="bg-white rounded-xl shadow p-6 mt-6">
      <h2 className="text-2xl font-semibold mb-4 text-center text-orange no-print">
        Historical Timeline Report
      </h2>

      <div className="text-sm text-gray-700 mb-6 space-y-1">
        <p><strong>Patient:</strong> {patient.name}</p>
        <p><strong>MRN:</strong> {patient.mrn || "N/A"}</p>
        <p><strong>Admitted:</strong> {patient.admitted_date}</p>
      </div>

      {timeline.map((weekObj, weekIdx) => (
        <div key={weekIdx} className="mb-6">
          <h3 className="text-lg font-bold mb-3 text-[var(--deep-navy)]">{weekObj.week}</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {weekObj.tasks.map((task, taskIdx) => (
              <li key={taskIdx}>
                <strong>{task.task_name}</strong> – {task.completed_at}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default HistoricalTimelineReport;
