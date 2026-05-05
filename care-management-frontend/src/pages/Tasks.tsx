// src/pages/Tasks.tsx
import { useEffect, useState, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  loadPriorityTasks, loadMissedTasks,
  startTask, completeTask, markTaskAsMissed, followUpTask,
} from "../redux/slices/taskSlice";
import { fetchPatients } from "../redux/slices/patientSlice";
import { RootState, AppDispatch } from "../redux/store";
import { Flag, AlertTriangle, CalendarDays, ClipboardCheck } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BlueLoader from "../components/BlueLoader";
import { toast } from "react-toastify";
import { showCourtDatePopup } from "../utils/showCourtDatePopup";
import { useHospitalTimezone } from "../hooks/timezone";

const Tasks = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user }         = useSelector((s: RootState) => s.user);
  const { priorityTasks, missedTasks, loading } = useSelector((s: RootState) => s.tasks);
  const { patients }     = useSelector((s: RootState) => s.patients);

  const { formatDueDate } = useHospitalTimezone();

  const [searchTerm,    setSearchTerm]    = useState("");
  const [selectedPatient, setSelectedPatient] = useState<number | null>(null);
  const [tab,           setTab]           = useState<"priority" | "missed">("missed");
  const [reasonInputs,  setReasonInputs]  = useState<Record<number, string>>({});

  useEffect(() => {
    if (user) {
      dispatch(fetchPatients());
      dispatch(loadPriorityTasks(selectedPatient));
      dispatch(loadMissedTasks(selectedPatient));
    }
  }, [dispatch, user, selectedPatient]);

  const refreshTasks = () => {
    dispatch(loadPriorityTasks(selectedPatient));
    dispatch(loadMissedTasks(selectedPatient));
  };

  const handleStart = async (taskId: number, version: number) => {
    try {
      await dispatch(startTask({ taskId, version })).unwrap();
      toast.success("Task started");
      refreshTasks();
    } catch (err: any) {
      toast.error(typeof err === "string" ? err : err?.error || "Failed to start task");
    }
  };

  const handleComplete = async (taskId: number, version: number, courtTask: boolean) => {
    let courtDate: string | undefined;
    if (courtTask) {
      courtDate = (await showCourtDatePopup()) || undefined;
      if (!courtDate) { toast.error("Court date is required."); return; }
    }
    const reason = prompt("Please enter a reason to complete this task:")?.trim();
    if (!reason) { toast.error("Completion reason is required."); return; }
    try {
      await dispatch(completeTask({ taskId, version, reason, court_date: courtDate })).unwrap();
      toast.success("Task completed");
      refreshTasks();
    } catch (err: any) {
      const msg = typeof err === "string" ? err : err?.error || "";
      if (msg.toLowerCase().includes("missed")) {
        const missedReason = prompt("This task was missed. Please enter a missed reason:")?.trim();
        if (!missedReason) { toast.error("Missed reason is required."); return; }
        try {
          await dispatch(completeTask({ taskId, version, reason, missed_reason: missedReason, court_date: courtDate })).unwrap();
          toast.success("Task completed");
          refreshTasks();
        } catch { toast.error("Failed to complete task."); }
      } else {
        toast.error(msg || "Failed to complete task.");
      }
    }
  };

  const handleFollowUp = async (taskId: number, version: number) => {
    const reason = prompt("Please enter a reason for follow-up:");
    if (!reason?.trim()) { toast.error("Follow-up reason is required."); return; }
    try {
      await dispatch(followUpTask({ taskId, version, followUpReason: reason })).unwrap();
      toast.success("Follow-up scheduled!");
      refreshTasks();
    } catch { toast.error("Failed to schedule follow-up."); }
  };

  const handleMissed = async (taskId: number, version: number) => {
    const reason = reasonInputs[taskId];
    if (!reason?.trim()) { toast.error("Missed reason is required."); return; }
    try {
      await dispatch(markTaskAsMissed({ taskId, version, reason })).unwrap();
      toast.success("Task marked as missed");
      refreshTasks();
    } catch { toast.error("Failed to mark task as missed."); }
  };

  const matchedPatientIds = useMemo(() => {
    if (!searchTerm.trim()) return null;
    const lower = searchTerm.toLowerCase();
    return patients
      .filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(lower))
      .map(p => p.id);
  }, [patients, searchTerm]);

  const filteredPriorityTasks = useMemo(() => {
    let list = priorityTasks.filter(t => t.status !== "Completed" && !t.is_non_blocking);
    if (matchedPatientIds) list = list.filter(t => matchedPatientIds.includes(t.patient_id));
    return list;
  }, [priorityTasks, matchedPatientIds]);

  const filteredMissedTasks = useMemo(() => {
    if (!searchTerm.trim()) return missedTasks;
    const lower = searchTerm.toLowerCase();
    return missedTasks.filter(t => t.patient_name?.toLowerCase().includes(lower));
  }, [missedTasks, searchTerm]);

  if (loading && !priorityTasks.length && !missedTasks.length) return <BlueLoader />;

  return (
    <div className="min-h-screen flex flex-col bg-hospital-neutral">
      <Navbar />
      <main className="flex-1 p-6 max-w-4xl mx-auto max-h-[calc(100vh-120px)] overflow-y-auto">

        {/* Search + patient filter */}
        <div className="flex justify-end items-center gap-4 mb-6">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name"
            className="p-2 border rounded w-64"
          />
          <select
            className="p-2 border rounded w-48"
            onChange={(e) => setSelectedPatient(Number(e.target.value) || null)}
            value={selectedPatient || ""}
          >
            <option value="">-- Select Patient --</option>
            {[...patients]
              .sort((a, b) => {
                const cmp = (a.last_name || "").localeCompare(b.last_name || "");
                return cmp !== 0 ? cmp : (a.first_name || "").localeCompare(b.first_name || "");
              })
              .map(p => (
                <option key={p.id} value={p.id}>
                  {p.last_name}, {p.first_name} – MRN {p.mrn || "N/A"}
                </option>
              ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 justify-center">
          <button onClick={() => setTab("missed")} className={`px-4 py-2 rounded ${tab === "missed" ? "bg-red-100 text-red-700" : "bg-white"}`}>
            <AlertTriangle className="inline mr-1 w-4 h-4" /> Missed Tasks
          </button>
          <button onClick={() => setTab("priority")} className={`px-4 py-2 rounded ${tab === "priority" ? "bg-blue-100 text-blue-700" : "bg-white"}`}>
            <Flag className="inline mr-1 w-4 h-4" /> Priority Tasks
          </button>
        </div>

        {/* Missed tab */}
        {tab === "missed" && (
          <div className="space-y-6">
            {filteredMissedTasks.length === 0 ? (
              <p className="text-center text-gray-500">No missed tasks without reason</p>
            ) : filteredMissedTasks.map(task => (
              <div key={task.patient_task_id} className="border p-5 rounded shadow-sm bg-white">
                <h3 className="text-lg font-semibold text-red-600">{task.task_name}</h3>
                <p className="text-sm text-gray-600">Patient: {task.patient_name}</p>
                <p className="text-sm text-gray-600">
                  <CalendarDays className="inline w-4 h-4 mr-1" />
                  Due: {formatDueDate(task.due_date)}
                </p>
                <textarea
                  className="w-full border rounded p-2 mt-2 text-sm"
                  placeholder="Enter reason..."
                  value={reasonInputs[task.patient_task_id] || ""}
                  onChange={(e) => setReasonInputs(prev => ({ ...prev, [task.patient_task_id]: e.target.value }))}
                />
                <button onClick={() => handleMissed(task.patient_task_id, task.version)} className="mt-2 btn btn-primary">
                  Submit Reason
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Priority tab */}
        {tab === "priority" && (
          <div className="space-y-6">
            {filteredPriorityTasks.length === 0 ? (
              <p className="text-center text-gray-500">No priority tasks for today</p>
            ) : filteredPriorityTasks.map(task => (
              <div key={task.patient_task_id} className="border p-5 rounded shadow-sm bg-white">
                <h3 className={`text-lg font-semibold ${task.status === "Missed" ? "text-red-600" : ""}`}>{task.task_name}</h3>
                <p className="text-sm text-gray-600">Patient: {task.patient_name}</p>
                <p className="text-sm text-gray-600">
                  <CalendarDays className="inline w-4 h-4 mr-1" />
                  Due: {formatDueDate(task.due_date)}
                </p>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <ClipboardCheck className="w-4 h-4" /> {task.status}
                </p>
                <div className="mt-3 flex flex-col md:flex-row gap-2">
                  {task.status === "Pending" && (
                    <button onClick={() => handleStart(task.patient_task_id, task.version)} className="btn">Start</button>
                  )}
                  {task.is_repeating && task.due_in_days_after_dependency != null && (
                    <button onClick={() => handleFollowUp(task.patient_task_id, task.version)} className="btn btn-outline">Follow Up</button>
                  )}
                  <button onClick={() => handleComplete(task.patient_task_id, task.version, task.is_court_date ?? false)} className="btn btn-xs btn-outline">
                    Complete
                  </button>
                  <textarea
                    className="border rounded p-2 text-sm flex-1"
                    placeholder="Required: Reason for missing..."
                    onChange={(e) => setReasonInputs(prev => ({ ...prev, [task.patient_task_id]: e.target.value }))}
                  />
                  <button onClick={() => handleMissed(task.patient_task_id, task.version)} className="btn bg-red-600 text-white">
                    Mark Missed
                  </button>
                </div>
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