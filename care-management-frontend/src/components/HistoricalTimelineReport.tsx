// src/components/HistoricalTimelineReport.tsx
import React from "react";
import { useHospitalTimezone } from "../hooks/timezone";

interface ApprovalEntry {
  id:                number;
  name:              string;
  description:       string | null;
  estimated_amount:  number;
  status:            "Pending" | "Approved" | "Denied";
  decision_note:     string | null;
  requested_at:      string;
  decided_at:        string | null;
}

interface TaskEntry {
  type?:                  "task";
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
    timestamp?: string;
    changed_at?: string;
  }[];
  approvals?: ApprovalEntry[];
}

interface StandaloneApprovalEntry extends ApprovalEntry {
  type: "approval";
}

type TimelineEntry = TaskEntry | StandaloneApprovalEntry;

interface WeeklyTimeline {
  week:  string;
  tasks: TimelineEntry[];
}

interface HistoricalTimelineReportProps {
  report: {
    patient: { name: string; mrn: string; admitted_date: string };
    timeline: WeeklyTimeline[];
  };
}

const statusColor = (status: string) => {
  const colors: Record<string, string> = {
    Pending:  "text-yellow-700 bg-yellow-100",
    Approved: "text-green-700 bg-green-100",
    Denied:   "text-red-700 bg-red-100",
  };
  return colors[status] || "text-gray-700 bg-gray-100";
};

const HistoricalTimelineReport: React.FC<HistoricalTimelineReportProps> = ({ report }) => {
  const { formatDateTime } = useHospitalTimezone();

  if (!report || !Array.isArray(report.timeline)) return null;
  const { patient, timeline } = report;

  const renderApprovalCard = (a: ApprovalEntry) => (
    <div key={a.id} className="mt-1 px-2 py-1.5 rounded bg-purple-50 border border-purple-200 text-xs">
      <span className="font-semibold text-purple-800">Approval Requested:</span>{" "}
      <span className="text-purple-900">{a.name}</span>{" "}
      <span className="text-purple-700">(${a.estimated_amount.toFixed(2)})</span>{" "}
      <span className={`ml-1 px-1.5 py-0.5 rounded-full font-medium ${statusColor(a.status)}`}>
        {a.status}
      </span>
      {a.description && <p className="mt-1 text-purple-700 italic">{a.description}</p>}
      {a.decision_note && <p className="mt-1 text-purple-700"><strong>Note:</strong> {a.decision_note}</p>}
      <p className="mt-1 text-purple-500">
        Requested {formatDateTime(a.requested_at)}
        {a.decided_at && <> · Decided {formatDateTime(a.decided_at)}</>}
      </p>
    </div>
  );

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

      {timeline.map((weekObj, weekIdx) => {
        // Split this week's entries: tasks vs standalone approval requests
        const taskEntries = weekObj.tasks.filter(
          (e): e is TaskEntry => e.type !== "approval"
        );
        const standaloneApprovals = weekObj.tasks.filter(
          (e): e is StandaloneApprovalEntry => e.type === "approval"
        );

        return (
          <div key={weekIdx} className="mb-6">
            <h3 className="text-lg font-bold mb-3 text-[var(--deep-navy)]">{weekObj.week}</h3>

            {taskEntries.length > 0 && (
              <ul className="list-disc list-inside space-y-1 text-sm">
                {taskEntries.map((task, taskIdx) => (
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
                              {formatDateTime(ov.changed_at || ov.timestamp || "")}
                              {ov.reason && <span> – {ov.reason}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {task.approvals && task.approvals.length > 0 && (
                      <div className="ml-4 mt-2">
                        <p className="text-sm font-semibold text-purple-800">Approvals:</p>
                        {task.approvals.map(renderApprovalCard)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* FIX: standalone approvals (not tied to any task) shown separately
                at the bottom of the week, outside the task list, so they don't
                break the <ul> layout */}
            {standaloneApprovals.length > 0 && (
              <div className={taskEntries.length > 0 ? "mt-4" : ""}>
                <p className="text-sm font-bold  mb-2">Requests:</p>
                <div className="space-y-2">
                  {standaloneApprovals.map(renderApprovalCard)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default HistoricalTimelineReport;