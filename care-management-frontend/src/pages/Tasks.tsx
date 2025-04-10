import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  loadPriorityTasks,
  loadMissedTasks,
  startTask,
  completeTask,
  addMissedReason,
} from '../redux/slices/taskSlice';
import { RootState } from '../redux/store';
import {
  Flag,
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
} from 'lucide-react';
import Navbar from '../components/NavBar';
import Footer from '../components/Footer';
import { toast } from 'react-toastify';

const Tasks = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.user);
  const { priorityTasks, missedTasks } = useSelector((state: RootState) => state.tasks);

  const [tab, setTab] = useState<'priority' | 'missed'>('priority');
  const [reasonInputs, setReasonInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    if (user) {
      dispatch(loadPriorityTasks());
      dispatch(loadMissedTasks());
    }
  }, [dispatch, user]);

  const handleReasonChange = (taskId: number, value: string) => {
    setReasonInputs((prev) => ({ ...prev, [taskId]: value }));
  };
  const handleStart = (taskId: number) => {
    dispatch(startTask(taskId))
      .unwrap()
      .then(() => {
        toast.success("✅ Task started");
        dispatch(loadPriorityTasks());
        dispatch(loadMissedTasks());
      })
      .catch(() => toast.error("❌ Failed to start task"));
  };
  
  const handleComplete = (taskId: number) => {
    dispatch(completeTask(taskId))
      .unwrap()
      .then(() => {
        toast.success("✅ Task completed");
        dispatch(loadPriorityTasks());
        dispatch(loadMissedTasks());
      })
      .catch(() => toast.error("❌ Failed to complete task"));
  };
  
  const handleSubmitReason = (taskId: number) => {
    const reason = reasonInputs[taskId];
    if (!reason) return toast.error("Enter a reason before submitting");
  
    dispatch(addMissedReason({ taskId, reason }))
      .unwrap()
      .then(() => {
        toast.success("📝 Reason submitted");
        dispatch(loadMissedTasks()); // ✅ Only missed tasks need refresh here
      })
      .catch(() => toast.error("❌ Failed to submit reason"));
  };

  return (
    <div className="min-h-screen flex flex-col bg-hospital-neutral">
      <Navbar />
      <main className="flex-1 p-6 max-w-4xl mx-auto">
        <div className="flex gap-4 mb-6 justify-center">
          <button
            onClick={() => setTab('priority')}
            className={`px-4 py-2 rounded ${tab === 'priority' ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}
          >
            <Flag className="inline mr-1 w-4 h-4" /> Priority Tasks
          </button>
          <button
            onClick={() => setTab('missed')}
            className={`px-4 py-2 rounded ${tab === 'missed' ? 'bg-red-100 text-red-700' : 'bg-white'}`}
          >
            <AlertTriangle className="inline mr-1 w-4 h-4" /> Missed Tasks
          </button>
        </div>

        {tab === 'priority' && (
          <div className="space-y-6">
            {priorityTasks.length === 0 && (
              <p className="text-center text-gray-500">🎉 No priority tasks for today</p>
            )}
            {priorityTasks.map(task => (
              <div key={task.task_id} className="border p-5 rounded shadow-sm bg-white">
                <h3 className="text-lg font-semibold">{task.task_name}</h3>
                <p className="text-sm text-gray-600">Patient: {task.patient_name}</p>
                <p className="text-sm text-gray-600">
                  <CalendarDays className="inline w-4 h-4 mr-1" />
                  Due: {new Date(task.due_date).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <ClipboardCheck className="w-4 h-4" /> {task.status}
                </p>
                <div className="mt-3 flex flex-col md:flex-row gap-2">
                  <button onClick={() => handleStart(task.task_id)} className="btn bg-white border">
                    Start
                  </button>
                  <button onClick={() => handleComplete(task.task_id)} className="btn btn-primary">
                    Complete
                  </button>
                  <textarea
                    className="border rounded p-2 text-sm flex-1"
                    placeholder="Optional: Reason for missing..."
                    onChange={(e) => handleReasonChange(task.task_id, e.target.value)}
                  />
                  <button
                    onClick={() => handleSubmitReason(task.task_id)}
                    className="btn bg-red-600 text-white"
                  >
                    Mark Missed
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'missed' && (
          <div className="space-y-6">
            {missedTasks.length === 0 && (
              <p className="text-center text-gray-500">🎉 No missed tasks without reason</p>
            )}
            {missedTasks.map(task => (
              <div key={task.task_id} className="border p-5 rounded shadow-sm bg-white">
                <h3 className="text-lg font-semibold text-red-600">{task.task_name}</h3>
                <p className="text-sm text-gray-600">Patient: {task.patient_name}</p>
                <p className="text-sm text-gray-600">
                  <CalendarDays className="inline w-4 h-4 mr-1" />
                  Due: {new Date(task.due_date).toLocaleDateString()}
                </p>
                <textarea
                  className="w-full border rounded p-2 mt-2 text-sm"
                  placeholder="Enter reason..."
                  value={reasonInputs[task.task_id] || ''}
                  onChange={(e) => handleReasonChange(task.task_id, e.target.value)}
                />
                <button
                  onClick={() => handleSubmitReason(task.task_id)}
                  className="mt-2 btn btn-primary"
                >
                  Submit Reason
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Tasks;
