// src/components/PriorityReport.tsx
import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
import BlueLoader from "./BlueLoader";
import { useHospitalTimezone } from "../hooks/timezone";

const PriorityReport: React.FC = () => {
  const { priorityReport, loading, error } = useSelector((s: RootState) => s.reports);
  const { formatDueDate } = useHospitalTimezone();

  if (loading) return <BlueLoader />;
  if (error)   return <p className="text-center text-red-500">{error}</p>;

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4 text-center text-orange no-print">
        Priority Report — Tasks Due Today
      </h2>

      {Array.isArray(priorityReport) && priorityReport.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg shadow-lg">
            <thead>
              <tr className="bg-prussian-blue text-white">
                <th className="p-3 text-left">Patient Name</th>
                <th className="p-3 text-left">Task Name</th>
                <th className="p-3 text-left">Staff</th>
                <th className="p-3 text-left">Due Date</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Leader</th>
              </tr>
            </thead>
            <tbody>
              {priorityReport.map((task: any) => (
                <tr key={`${task.patient_id}-${task.task_name}`} className="border-b">
                  <td className="p-3">{task.patient_name}</td>
                  <td className="p-3">{task.task_name}</td>
                  <td className="p-3">
                    {Array.isArray(task.staff_names) && task.staff_names.length
                      ? task.staff_names.join(", ") : "N/A"}
                  </td>
                  <td className="p-3">{task.due_date ? formatDueDate(task.due_date) : "N/A"}</td>
                  <td className="p-3">{task.status || "N/A"}</td>
                  <td className="p-3">{task.added_by || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-gray-500">No tasks due today.</p>
      )}
    </div>
  );
};

export default PriorityReport;