// src/components/HistoricalTimelineReport.tsx
import React from "react";
import { useHospitalTimezone } from "../hooks/timezone";

interface TaskEntry {
  task_name:              string;
  completed_at:           string;
  task_note:              string;
  include_note_in_report: boolean;
  contact_info:           string;
  delayed?:               boolean;
  delayed_reason?:        string;
  overrides?: {
    staff_id?:  number | null;
    reason?:    string | null;
    // FIX: was timestamp — now changed_at from patient_task_status_history table
    timestamp?: string;
    changed_at?: string;
  }[];
}

interface WeeklyTimeline {
  week:  string;
  tasks: TaskEntry[];
}

interface HistoricalTimelineReportProps {
  report: {
    patient: { name: string; mrn: string; admitted_date: string };
    timeline: WeeklyTimeline[];
  };
}

const HistoricalTimelineReport: React.FC<HistoricalTimelineReportProps> = ({ report }) => {
  const { formatDateTime } = useHospitalTimezone();

  if (!report || !Array.isArray(report.timeline)) return null;
  const { patient, timeline } = report;

  return (
    <div className="bg-white rounded-xl shadow p-6 mt-6">
      <h2 className="text-2xl font-semibold mb-4 text-center no-print">
        Historical Timeline Report
      </h2>

      <div className="text-sm mb-6 space-y-1">
        <p><strong>Patient:</strong> {patient.name}</p>
        <p><strong>MRN:</strong> {patient.mrn || "N/A"}</p>
        <p><strong>Admitted:</strong> {formatDateTime(patient.admitted_date)}</p>
      </div>

      {timeline.map((weekObj, weekIdx) => (
        <div key={weekIdx} className="mb-6">
          <h3 className="text-lg font-bold mb-3 text-[var(--deep-navy)]">{weekObj.week}</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {weekObj.tasks.map((task, taskIdx) => (
              <li key={taskIdx}>
                <strong>{task.task_name}</strong> – {formatDateTime(task.completed_at)}

                {task.delayed && (
                  <span className="ml-2 text-red-600 font-semibold">(Delayed)</span>
                )}
                {task.delayed && task.delayed_reason && (
                  <p className="ml-4 mt-1 text-sm text-red-700 italic">
                    <strong>Reason:</strong> {task.delayed_reason}
                  </p>
                )}
                {task.include_note_in_report && task.task_note && (
                  <p className="ml-4 mt-1 text-sm text-[var(--prussian-blue)]">
                    <strong>Note:</strong> {task.task_note}
                  </p>
                )}
                {task.contact_info && (
                  <p className="ml-4 mt-1 text-sm text-[var(--prussian-blue)]">
                    <strong>Contact:</strong> {task.contact_info}
                  </p>
                )}
                {task.overrides && task.overrides.length > 0 && (
                  <div className="ml-4 mt-2">
                    <p className="text-sm font-semibold text-[var(--prussian-blue)]">Overrides:</p>
                    <ul className="list-disc list-inside text-xs space-y-1">
                      {task.overrides.map((ov, idx) => (
                        <li key={idx} className="text-[var(--prussian-blue)]">
                          {/* FIX: support both changed_at (new) and timestamp (old) */}
                          {formatDateTime(ov.changed_at || ov.timestamp || "")}
                          {ov.reason && <span> – {ov.reason}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default HistoricalTimelineReport;