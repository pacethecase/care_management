import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../redux/store';
import { fetchDailyReport } from '../redux/slices/reportSlice';

interface Props {
  date: string;
   adminId?: number;
}

interface ReportTask {
  patient_id: number;
  patient_name: string;
  task_name: string;
  missed_reason?: string;
  staff_names?: string[];
  added_by?:string;
  due_date?: Date | string;
}

const DailyReport: React.FC<Props> = ({ date,adminId }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { dailyReport, loading, error } = useSelector((state: RootState) => state.reports);
  useEffect(() => {
    dispatch(fetchDailyReport({ date, adminId }));

  }, [dispatch, date,adminId]);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4 text-center no-print">Daily Report - Overdue Tasks</h2>
      {loading && <p className="text-center text-gray-600">Loading...</p>}
      {error && <p className="text-center text-red-500">{error}</p>}

      {Array.isArray(dailyReport) && dailyReport.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg shadow-lg">
            <thead>
              <tr className="bg-prussian-blue text-white">
                <th className="p-3 text-left">Patient Name</th>
                <th className="p-3 text-left">Task Name</th>
                <th className="p-3 text-left">Missed Reason</th>
                <th className="p-3 text-left">Due Date</th>
                <th className="p-3 text-left">Staff</th>
                  <th className="p-3 text-left">Leader</th>
              </tr>
            </thead>
            <tbody>
              {dailyReport.map((task: ReportTask) => (
                <tr key={`${task.patient_id}-${task.task_name}`} className="border-b">
                  <td className="p-3">{task.patient_name}</td>
                  <td className="p-3">{task.task_name}</td>
                  <td className="p-3">{task.missed_reason || 'N/A'}</td>
                  <td className="p-3">
                      {task.due_date
                        ? new Date(task.due_date).toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : 'N/A'}
                    </td>
                    <td className="p-3">
                      {task.staff_names?.length
                        ? task.staff_names.join(', ')
                        : 'N/A'}
                    </td>
                    <td className="p-3">
                      {task.added_by}
                    </td>
                                    </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-gray-500">No tasks for the specified date.</p>
      )}
    </div>
  );
};

export default DailyReport;
