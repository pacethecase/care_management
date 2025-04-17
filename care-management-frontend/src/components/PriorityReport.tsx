import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPriorityReport } from '../redux/slices/reportSlice'; // import the action

const PriorityReport = ({ date }) => {
  const dispatch = useDispatch();
  const { priorityReport, loading, error } = useSelector((state) => state.reports);

  // Fetch priority report when component mounts
  useEffect(() => {
    dispatch(fetchPriorityReport(date)); // Pass the date for filtering
  }, [dispatch, date]);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4 text-center text-orange  no-print">Priority Report - Tasks Due Today</h2>

      {/* Loading or Error */}
      {loading && <p className="text-center text-gray-600">Loading...</p>}
      {error && <p className="text-center text-red-500">{error}</p>}

      {/* Display the priority tasks */}

      {Array.isArray(priorityReport) && priorityReport.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg shadow-lg">
            <thead>
              <tr className="bg-orange-500 text-white">
                <th className="p-3 text-left">Patient Name</th>
                <th className="p-3 text-left">Task Name</th>
                <th className="p-3 text-left">Staff</th>
                <th className="p-3 text-left">Status</th>
              
              </tr>
            </thead>
            <tbody>
              {priorityReport.map((task) => (
                <tr key={`${task.patient_id}-${task.task_name}`} className="border-b">
                  <td className="p-3">{task.patient_name}</td>
                  <td className="p-3">{task.task_name}</td>
                  <td className="p-3">{task.staff_name || 'N/A'}</td>
                  <td className="p-3">{task.status || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ):( 
        <p className="text-center text-gray-500">No tasks due today.</p>
      )}
    </div>
  );
};

export default PriorityReport;
