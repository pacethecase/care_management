import React, { useEffect, useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  loadPriorityTasks,
  loadMissedTasks,
  startTask,
  completeTask,
  markTaskAsMissed,
  followUpTask,
} from '../redux/slices/taskSlice';
import { fetchPatients } from '../redux/slices/patientSlice';
import { RootState } from "../redux/store";
import {
  Flag,
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { toast } from 'react-toastify';
import type { AppDispatch } from '../redux/store';
import { showCourtDatePopup } from "../utils/showCourtDatePopup";

const Tasks = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.user);
  const { priorityTasks, missedTasks } = useSelector((state: RootState) => state.tasks);
  const { patients } = useSelector((state: RootState) => state.patients);

  const [selectedPatient, setSelectedPatient] = useState<number | null>(null);
  const [tab, setTab] = useState<'priority' | 'missed'>('priority');
  const [reasonInputs, setReasonInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    if (user) {
      dispatch(fetchPatients());
      refreshTasks();
    }
  }, [dispatch, user, selectedPatient]);

  const refreshTasks = () => {
    dispatch(loadPriorityTasks(selectedPatient));
    dispatch(loadMissedTasks(selectedPatient));
  };

  const handlePatientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPatient(Number(e.target.value));
  };

  const handleReasonChange = (taskId: number, value: string) => {
    setReasonInputs((prev) => ({ ...prev, [taskId]: value }));
  };

  const handleStart = async (taskId: number) => {
    try {
      await dispatch(startTask(taskId)).unwrap();
      toast.success("✅ Task started");
      refreshTasks();
    } catch {
      toast.error("❌ Failed to start task");
    }
  };



  const handleComplete = async (taskId: number, courtTask: boolean) => {
      let courtDate: string | undefined = undefined;
    try {
     
  
      if (courtTask) {
         courtDate = (await showCourtDatePopup()) || undefined;
        if (!courtDate) {
          toast.error("Court date is required.");
          return;
        }
      }
  
      await dispatch(
        completeTask({ taskId, court_date: courtDate})
      ).unwrap();
      toast.success("✅ Task completed");
        refreshTasks();
    } catch (err: any) {
      if (err?.toString().includes("Please provide a reason")) {
        const reason = prompt("📝 This task was missed earlier. Please enter a missed reason to proceed:");
  
        if (!reason || reason.trim() === "") {
          toast.error("❌ Reason is required to complete this task.");
          return;
        }
  
        try {
          await dispatch(markTaskAsMissed({ taskId, reason })).unwrap();
          toast.success("✅ Missed reason recorded");
  
          await dispatch(
            completeTask({ taskId, court_date: courtDate })
          ).unwrap();
          toast.success("✅ Task completed after reason provided");
  
         refreshTasks();
        } catch {
          toast.error("❌ Failed to complete task even after reason");
        }
      } else {
        toast.error("❌ Failed to complete task");
      }
    }
  };
  
    
    
  



  const handleFollowUp = async (taskId: number) => {
    const reason = prompt("Please enter a reason for follow-up:");
    if (!reason || reason.trim() === "") {
      toast.error("❌ Follow-up reason is required");
      return;
    }

    try {
      await dispatch(followUpTask({ taskId, followUpReason: reason })).unwrap();
      toast.success("Follow-up task scheduled!");
      refreshTasks();
    } catch {
      toast.error("❌ Failed to schedule follow-up");
    }
  };

  const handleMissed = async (taskId: number) => {
    const reason = reasonInputs[taskId];
    if (!reason || reason.trim() === "") {
      toast.error("❌ Missed reason is required");
      return;
    }

    try {
      await dispatch(markTaskAsMissed({ taskId, reason })).unwrap();
      toast.success("✅ Task marked as missed");
      refreshTasks();
    } catch {
      toast.error("❌ Failed to mark task as missed");
    }
  };

  const filteredPriorityTasks = useMemo(
    () => priorityTasks.filter((task) => task.status !== 'Completed' && !task.is_non_blocking),
    [priorityTasks]
  );

  return (
    <div className="min-h-screen flex flex-col bg-hospital-neutral">
      <Navbar />
      <main className="flex-1 p-6 max-w-4xl mx-auto max-h-[calc(100vh-120px)] overflow-y-auto">
        <div className="flex justify-end mb-6">
          <select
            className="p-2 border rounded w-48"
            onChange={handlePatientChange}
            value={selectedPatient || ''}
          >
            <option value="">-- Select Patient --</option>
            {patients
              .slice()
              .sort((a, b) => a.last_name.localeCompare(b.last_name))
              .map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.last_name}, {patient.first_name} – MRN {patient.mrn || "N/A"}
                </option>
              ))}
          </select>
        </div>

        <div className="flex gap-4 mb-6 justify-center">
          <button
            onClick={() => setTab('missed')}
            className={`px-4 py-2 rounded ${tab === 'missed' ? 'bg-red-100 text-red-700' : 'bg-white'}`}
          >
            <AlertTriangle className="inline mr-1 w-4 h-4" /> Missed Tasks
          </button>
          <button
            onClick={() => setTab('priority')}
            className={`px-4 py-2 rounded ${tab === 'priority' ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}
          >
            <Flag className="inline mr-1 w-4 h-4" /> Priority Tasks
          </button>
        </div>

        {tab === 'missed' && (
          <div className="space-y-6">
            {missedTasks.length === 0 ? (
              <p className="text-center text-gray-500">🎉 No missed tasks without reason</p>
            ) : (
              missedTasks.map((task) => (
                <div key={task.patient_task_id} className="border p-5 rounded shadow-sm bg-white">
                  <h3 className="text-lg font-semibold text-red-600">{task.task_name}</h3>
                  <p className="text-sm text-gray-600">Patient: {task.patient_name}</p>
                  <p className="text-sm text-gray-600">
                    <CalendarDays className="inline w-4 h-4 mr-1" />
                    Due: {new Date(task.due_date).toLocaleDateString()}
                  </p>
                  <textarea
                    className="w-full border rounded p-2 mt-2 text-sm"
                    placeholder="Enter reason..."
                    value={reasonInputs[task.patient_task_id] || ''}
                    onChange={(e) => handleReasonChange(task.patient_task_id, e.target.value)}
                  />
                  <button
                    onClick={() => handleMissed(task.patient_task_id)}
                    className="mt-2 btn btn-primary"
                  >
                    Submit Reason
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'priority' && (
          <div className="space-y-6">
            {filteredPriorityTasks.length === 0 ? (
              <p className="text-center text-gray-500">🎉 No priority tasks for today</p>
            ) : (
              filteredPriorityTasks.map((task) => (
                <div key={task.patient_task_id} className="border p-5 rounded shadow-sm bg-white">
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
                    {task.status === "Pending" && (
                      <button onClick={() => handleStart(task.patient_task_id)} className="btn">
                        Start
                      </button>
                    )}
                    {task.is_repeating && task.due_in_days_after_dependency != null && (
                      <button onClick={() => handleFollowUp(task.patient_task_id)} className="btn btn-outline">
                        Follow Up
                      </button>
                    )}
                    <button
                      className="btn btn-xs btn-outline"
                      onClick={() =>
                        handleComplete(task.patient_task_id , task.is_court_date ?? false)
                      }
                    >
                      Complete
                    </button>
                    <textarea
                      className="border rounded p-2 text-sm flex-1"
                      placeholder="Required: Reason for missing..."
                      onChange={(e) => handleReasonChange(task.patient_task_id, e.target.value)}
                    />
                    <button
                      onClick={() => handleMissed(task.patient_task_id)}
                      className="btn bg-red-600 text-white"
                    >
                      Mark Missed
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Tasks;
