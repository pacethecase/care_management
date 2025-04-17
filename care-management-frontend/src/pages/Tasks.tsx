import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  loadPriorityTasks,
  loadMissedTasks,
  startTask,
  completeTask,
  markTaskAsMissed,
  loadPatientTasks,
  followUpTask,

} from '../redux/slices/taskSlice';
import {fetchPatients} from '../redux/slices/patientSlice';

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
  const [selectedPatient, setSelectedPatient] = useState<number | null>(null);
  const [tab, setTab] = useState<'priority' | 'missed'>('priority');
  const [reasonInputs, setReasonInputs] = useState<Record<number, string>>({});
  const { patients } = useSelector((state: RootState) => state.patients); 

  useEffect(() => {
    if (user) {
      dispatch(fetchPatients(user.token)); 
      if (selectedPatient) {
        dispatch(loadPriorityTasks(selectedPatient)); // Load tasks for selected patient
        dispatch(loadMissedTasks(selectedPatient)); // Load missed tasks for selected patient
      } else {
        dispatch(loadPriorityTasks(null)); // Load all tasks if no patient is selected
        dispatch(loadMissedTasks(null)); // Load all missed tasks if no patient is selected
      }
    }
  }, [dispatch, user, selectedPatient]);


  const handlePatientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const patientId = Number(e.target.value);
    setSelectedPatient(patientId); // Update selected patient
    dispatch(loadPriorityTasks(patientId)); // Load tasks for selected patient
    dispatch(loadMissedTasks(patientId)); // Load missed tasks for selected patient
  };
  

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
  
  const handleComplete = async (taskId: number, taskName: string) => {
    console.log("Completing task with ID:", taskId);  // Log taskId
    try {
      if (taskName === "Court date confirmed" || taskName === "Court Hearing Date Received if not follow up completed") {
        const courtDate = prompt("Enter Court Date (YYYY-MM-DD):");
        if (!courtDate) {
          toast.error("Court date is required.");
          return;
        }
        console.log("Court Date:", courtDate); // Log the court date
        await dispatch(completeTask({ taskId, court_date: courtDate })).unwrap();
      } else {
        await dispatch(completeTask({ taskId })).unwrap();
      }
      toast.success("✅ Task completed");
      dispatch(loadPriorityTasks());
    } catch (error) {
      console.error("Error completing task:", error);  // Log the error
      toast.error("❌ Failed to complete task");
    }
  };
  
  const handleFollowUp = async (taskId: number) => {
    // Prompt the user for the follow-up reason
    const reason = prompt("Please enter a reason for follow-up:");
  
    if (!reason || reason.trim() === "") {
      toast.error("❌ Follow-up reason is required");
      return;
    }
  
    try {
      // Dispatch the follow-up task with the reason
      await dispatch(followUpTask({ taskId, followUpReason: reason })).unwrap();
      toast.success("Follow-up task scheduled!");
      dispatch(loadPriorityTasks()); // Reload tasks after follow-up
    } catch {
      toast.error("Failed to schedule follow-up");
    }
  };


  const handleMissed = async (taskId: number) => {
    const reason = reasonInputs[taskId];
    if (!reason || reason.trim() === "") {
      toast.error("❌ Missed reason is required");
      return;
    }
  
    try {
      // Dispatch action to mark task as missed and submit the missed reason
      await dispatch(markTaskAsMissed({ taskId, reason })).unwrap();
      toast.success("✅ Task marked as missed");
      dispatch(loadMissedTasks()); 
    } catch (error) {
      toast.error("❌ Failed to mark task as missed");
    }
  };
  
  
  

  const filteredPriorityTasks =priorityTasks.filter((task) => task.status !== 'Completed' && !task.is_non_blocking);
  return (
    <div className="min-h-screen flex flex-col bg-hospital-neutral">
      <Navbar />
      <main className="flex-1 p-6 max-w-4xl mx-auto max-h-[calc(100vh-120px)] overflow-y-auto">
        {/* Select Patient Dropdown on the Right */}
        <div className="flex justify-end mb-6">
          <select
            className="p-2 border rounded w-48" 
            onChange={handlePatientChange}
            value={selectedPatient || ''}
          >
            <option value="">Select Patient</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name}
              </option>
            ))}
          </select>
        </div>
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
          <div className="space-y-6 ">
            {filteredPriorityTasks.length === 0 && (
              <p className="text-center text-gray-500">🎉 No priority tasks for today</p>
            )}
            {filteredPriorityTasks.map(task => (
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
                  {task.is_repeating && task.due_in_days_after_dependency != null && (
                    <button onClick={() => handleFollowUp(task.task_id)} className="btn btn-outline">
                      Follow Up
                    </button>
                  )}
                  <button onClick={() => handleComplete(task.task_id, task.task_name)} className="btn btn-outline">
                    Complete
                  </button>
                  <textarea
                    className="border rounded p-2 text-sm flex-1"
                    placeholder="Optional: Reason for missing..."
                    onChange={(e) => handleReasonChange(task.task_id, e.target.value)}
                  />
                  <button
                    onClick={() => handleMissed(task.task_id)}
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
              <div key={task.task_id} className="border p-5 rounded shadow-sm">
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
                  onClick={() => handleMissed(task.task_id)}
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
