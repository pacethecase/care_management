  import React, { useEffect, useState } from "react";
  import { useDispatch, useSelector } from "react-redux";
  import Navbar from "../components/Navbar";
  import Footer from "../components/Footer";
  import { fetchStaffPerformanceReport } from "../redux/slices/reportSlice";
  import { fetchAllTaskNames } from "../redux/slices/taskSlice";
  import { fetchStaffs } from "../redux/slices/userSlice";
  import { AppDispatch, RootState } from "../redux/store";
  import { Link } from "react-router-dom";
  import type { StaffPerformanceSummary } from "../redux/slices/reportSlice";

  const formatDate = (date: Date) => date.toISOString().slice(0, 10);

  const StaffPerformanceReportPage = () => {
    const dispatch = useDispatch<AppDispatch>();
  const { data, loading, error, type, drilldown = [], topLaggingStaff=[], topMissedTasks=[] } = useSelector((state: RootState) => state.reports.staffPerformanceReport);

    const taskNames = useSelector((state: RootState) => state.tasks.taskNames);

    const [start, setStart] = useState(formatDate(new Date(Date.now() - 30 * 86400000)));
    const [end, setEnd] = useState(formatDate(new Date()));
    const [selectedTask, setSelectedTask] = useState("");
  const staffList = useSelector((state: RootState) => state.user.staffs);
  const [selectedStaffId, setSelectedStaffId] = useState("");
    useEffect(() => {
      dispatch(fetchAllTaskNames());
      dispatch(fetchStaffs());
    }, [dispatch]);

    useEffect(() => {
      dispatch(
        fetchStaffPerformanceReport({
          start,
          end,
          staffId: selectedStaffId ? Number(selectedStaffId) : undefined,
          taskName: selectedTask || undefined,
        })
      );
    }, [start, end, selectedStaffId, selectedTask, dispatch]);

    const renderTable = () => {
     if (type === "summary") {
  return (
   <>
  {/* Top 3 Missed Tasks and Lagging Staff */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
    <div className="bg-white border rounded shadow p-4">
      <h2 className="text-lg font-semibold mb-2">Top 3 Missed Tasks</h2>
      <ul className="list-disc pl-5 text-gray-800">
        {topMissedTasks.map((task: any) => (
          <li key={task.task_name}>
            {task.task_name} — <strong>{task.total_issues}</strong> Total
          </li>
        ))}
      </ul>
    </div>
    <div className="bg-white border rounded shadow p-4">
      <h2 className="text-lg font-semibold mb-2">Top 3 Lagging Staff</h2>
      <ul className="list-disc pl-5 text-gray-800">
        {topLaggingStaff.map((staff: any) => (
          <li key={staff.staff_name}>
            {staff.staff_name} —{" "}
            <strong>
              {staff.missed_count} missed, {staff.delayed_count} delayed
            </strong>
          </li>
        ))}
      </ul>
    </div>
  </div>

  {/* Patient Task Summary Table */}
  <table className="min-w-full table-auto border border-gray-300">
    <thead className="bg-[var(--prussian-blue)] text-white">
      <tr>
        <th className="px-3 py-2">Patient</th>
        <th className="px-3 py-2">Total</th>
        <th className="px-3 py-2">Missed</th>
        <th className="px-3 py-2">Delayed</th>
        <th className="px-3 py-2">Pending</th>
        <th className="px-3 py-2">On Time</th>
        <th className="px-3 py-2">Staff</th>
      </tr>
    </thead>
    <tbody>
      {data?.map((patient: any) => (
        <tr key={patient.patient_id} className="border-t">
          <td className="px-3 py-2">{patient.patient_name}</td>
          <td className="px-3 py-2 text-center">{patient.total_tasks}</td>
          <td className="px-3 py-2 text-center">{patient.missed}</td>
          <td className="px-3 py-2 text-center">{patient.delayed_completed}</td>
          <td className="px-3 py-2 text-center">{patient.pending}</td>
          <td className="px-3 py-2 text-center">{patient.completed_on_time}</td>
          <td className="px-3 py-2 text-center">
            {(patient.staff || []).join(", ")}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</>
  );
}
 else if (type === "task") {
  return (
    <table className="min-w-full table-auto border border-gray-300">
      <thead className="bg-[var(--prussian-blue)] text-white">
        <tr>
          <th className="px-3 py-2">Task Name</th>
          <th className="px-3 py-2">Missed</th>
          <th className="px-3 py-2">Delayed</th>
          <th className="px-3 py-2">Staff</th>
          <th className="px-3 py-2">Patient</th>
          <th className="px-3 py-2">Status</th>
          <th className="px-3 py-2">Reason</th>
        </tr>
      </thead>
      <tbody>
        {data.map((task: any) => (
          <React.Fragment key={task.task_name}>
            {/* Task summary row */}
            <tr className="border-t">
              <td className="px-3 py-2">{task.task_name}</td>
              <td className="px-3 py-2 text-center">{task.missed_count}</td>
              <td className="px-3 py-2 text-center">{task.delayed_count || 0}</td>
              <td className="px-3 py-2">{(task.responsible_staff || []).join(", ")}</td>
              <td colSpan={3}></td>
            </tr>

            {/* Drilldown rows */}
            {(drilldown || [])
              .filter((row: any) => row.task_name === task.task_name) // ← filter by task
              .map((row: any, i: number) => (
                <tr key={`${task.task_name}-${i}`} className="border-t">
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2">{(row.staff_names || []).join(", ")}</td>
                  <td className="px-3 py-2">{row.patient_name}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">{row.reason || "—"}</td>
                </tr>
              ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
}
else if (type === "staff" || type === "staff-task") {
  let totalTasks = 0;
let missed = 0;
let delayed = 0;

if (Array.isArray(data)) {
  const typedData = data as StaffPerformanceSummary[];
  totalTasks = typedData.reduce((sum, item) => sum + item.total_tasks, 0);
  missed = typedData.reduce((sum, item) => sum + item.missed_count, 0);
  delayed = typedData.reduce((sum, item) => sum + item.delayed_count, 0);
} else if (data && typeof data === "object") {
  const summary = data as StaffPerformanceSummary;
  totalTasks = summary.total_tasks ?? 0;
  missed = summary.missed_count ?? 0;
  delayed = summary.delayed_count ?? 0;
}


  return (
    <div className="space-y-6">
      {/* Summary Box */}
      <div className="flex gap-6 bg-white shadow p-4 rounded border border-gray-200">
        <div className="text-center">
          <div className="text-xl font-bold">{totalTasks}</div>
          <div className="text-sm text-gray-600">Total Tasks</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-red-600">{missed}</div>
          <div className="text-sm text-gray-600">Missed Tasks</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-orange-600">{delayed}</div>
          <div className="text-sm text-gray-600">Delayed Completed</div>
        </div>
      </div>

      {/* Drilldown Table */}
      <table className="min-w-full table-auto border border-gray-300">
        <thead className="bg-[var(--prussian-blue)] text-white">
          <tr>
            <th className="px-3 py-2">Task Name</th>
            <th className="px-3 py-2">Patient</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Reason</th>
          </tr>
        </thead>
        <tbody>
          {drilldown.length > 0 ? (
            drilldown.map((item: any, index: number) => (
              <tr key={index} className="border-t">
                <td className="px-3 py-2">{item.task_name}</td>
                <td className="px-3 py-2">{item.patient_name}</td>
                <td className="px-3 py-2 text-center">{item.status}</td>
                <td className="px-3 py-2">{item.reason || "—"}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="text-center py-4 text-gray-500">
                No missed or delayed tasks.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}


 else {
        return <p>No data available.</p>;
      }
    };

    return (
      <div className="flex flex-col min-h-screen bg-hospital-neutral text-hospital-blue">
        <Navbar />
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-[var(--prussian-blue)]">30-Day Delay Report</h1>
            <Link to="/homepage" className="hover:underline font-medium text-sm text-[var(--prussian-blue)]">
              ← Back
            </Link>
          </div>

          <div className="flex flex-wrap gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium">Start Date</label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="border px-2 py-1 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">End Date</label>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="border px-2 py-1 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Staff</label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="border px-2 py-1 rounded w-full"
              >
                <option value="">All Staff</option>
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">Task</label>
              <select
                value={selectedTask}
                onChange={(e) => setSelectedTask(e.target.value)}
                className="border px-2 py-1 rounded"
              >
                <option value="">All</option>
                {taskNames.map((task: string) => (
                  <option key={task} value={task}>
                    {task}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading && <p>Loading...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {!loading && !error && <div className="overflow-x-auto rounded">{renderTable()}</div>}
        </div>
        <Footer />
      </div>
    );
  };

  export default StaffPerformanceReportPage;
