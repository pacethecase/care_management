import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  loadPatientTasks,
  startTask,
  completeTask,
  markTaskAsMissed,
  followUpTask,
} from "../redux/slices/taskSlice";
import { fetchPatientById } from "../redux/slices/patientSlice";
import { fetchPatientNotes, addPatientNote } from "../redux/slices/noteSlice";
import { RootState } from "../redux/store";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  ArrowLeft,
  Calendar,
  Activity,
  ClipboardCheck,
  Plus,
} from "lucide-react";
import { toast } from "react-toastify";
import { useNavigate } from 'react-router-dom';

const PatientTasks = () => {
  const { patientId } = useParams();
  const dispatch = useDispatch();

  const [selectedTab, setSelectedTab] = useState<
    "Pending" | "In Progress" | "Completed" | "All Tasks" | "Notes"
  >("All Tasks");
  const [newNote, setNewNote] = useState("");
  const [followUpReason, setFollowUpReason] = useState<string>("");
  const { patientTasks, loading: taskLoading } = useSelector((state: RootState) => state.tasks);
  const { selectedPatient: patient, loading: patientLoading } = useSelector((state: RootState) => state.patients);
  const { notes } = useSelector((state: RootState) => state.notes);
  const { user } = useSelector((state: RootState) => state.user);
  const { taskError } = useSelector((state: RootState) => state.tasks);

  const navigate = useNavigate();

  useEffect(() => {
    if (patientId) {
      dispatch(fetchPatientById(Number(patientId)));
      dispatch(loadPatientTasks(Number(patientId)));

      if (selectedTab === "Notes") {
        dispatch(fetchPatientNotes(Number(patientId)));
      }
      if (taskError === "Tasks are not available for discharged patients") {
        navigate("/patients");
      }
    
    }
  }, [dispatch, patientId, selectedTab,taskError]);

  const handleStart = (taskId: number) => {
    dispatch(startTask(taskId))
      .unwrap()
      .then(() => {
        toast.success("✅ Task started");
        dispatch(loadPatientTasks(Number(patientId)));
      })
      .catch(() => toast.error("❌ Failed to start task"));
  };

  const handleComplete = async (taskId: number, taskName: string) => {
    try {
      if (taskName === "Court date confirmed" || taskName === "Court Hearing Date Received if not follow up completed") {
        const courtDate = prompt("Enter Court Date (YYYY-MM-DD):");
        if (!courtDate) {
          toast.error("Court date is required.");
          return;
        }
        await dispatch(completeTask({ taskId, court_date: courtDate })).unwrap();
      } else {
        await dispatch(completeTask({ taskId })).unwrap();
      }
      toast.success("✅ Task completed");
      dispatch(loadPatientTasks(Number(patientId)));
    } catch {
      toast.error("❌ Failed to complete task");
    }
  };

  const handleMissed = (taskId: number) => {
    const reason = prompt("Enter missed reason:");
    if (reason) {
      dispatch(markTaskAsMissed({ taskId, reason }))
        .unwrap()
        .then(() => {
          toast.success("✅ Task marked as missed");
          dispatch(loadPatientTasks(Number(patientId)));
        })
        .catch(() => toast.error("❌ Failed to mark as missed"));
    }
  };

  const addNote = () => {
    if (!newNote.trim()) return toast.error("Note cannot be empty!");
    dispatch(addPatientNote({ patientId: Number(patientId), staff_id: user!.id!, note_text: newNote }))
      .then(() => {
        setNewNote("");
        toast.success("✅ Note added");
      });
  };

  const handleFollowUp = async (taskId: number) => {
    const reason = prompt("Please enter a reason for follow-up:");
  
    if (!reason || reason.trim() === "") {
      toast.error("❌ Follow-up reason is required");
      return;
    }
  
    try {
      // Dispatch the follow-up task with the provided reason
      await dispatch(followUpTask({ taskId, followUpReason: reason })).unwrap();
      toast.success("Follow-up task scheduled!");
      dispatch(loadPatientTasks(Number(patientId))); // Reload tasks after follow-up
    } catch {
      toast.error("Failed to schedule follow-up");
    }
  };
  

  const getStatusBadge = (status: string) => {
    const base = "badge";
    const statusMap = {
      Pending: "badge-pending",
      "In Progress": "badge-inprogress",
      Completed: "badge-completed",
    };
    return <span className={`${base} ${statusMap[status] || "bg-gray-200"}`}>{status}</span>;
  };

  const filteredTasks =
    selectedTab === "All Tasks"
      ? patientTasks
      : patientTasks.filter((task) => task.status === selectedTab);

  const renderTasks = () =>
    filteredTasks.map((task) => (
      console.log(task),
        <div
        key={task.task_id}
        className={`card w-full  border border-[var(--border-muted)] p-4 mb-4 ${task.is_non_blocking ? 'non-blocking' : ''} ${task.status === "Missed"?'card-missed':''} ${task.status === "Completed"?'card-completed':''}`}>
       <div className="relative mb-2">
    {/* Task Name */}
    <h3 className="text-lg font-semibold w-[50%]  break-words whitespace-normal ">
      {task.task_name}
    </h3>

    {/* Status Badge */}
    <div className="absolute top-0 right-0">
      {getStatusBadge(task.status)}
    </div>
  </div>
    
      <p className="text-sm text-gray-600">{task.description}</p>
    
      <div className="flex items-center gap-3 mt-3 text-sm text-[var(--text-muted)]">
        {task.is_non_blocking === true ? (
          // For non-blocking tasks, display a reminder or message
          <span className="text-blue-500 font-semibold">Reminder: Did you considered this????</span>
        ) : (
          <>
            <Calendar className="w-4 h-4" />
            Due: {new Date(task.due_date).toLocaleDateString()}
          </>
        )}
      </div>

      {/* Non-blocking task note */}
      {task.is_non_blocking === true && (
        <div className="text-sm text-gray-500 mt-2">
          <strong>Note:</strong> This task can be completed without a specific due date.
        </div>
      )}


      <div className="flex items-center gap-3 mt-3 text-sm text-[var(--text-muted)]">
        {task.condition_required && (
          <>
            <Activity className="w-4 h-4 ml-2" />
            {task.condition_required}
          </>
        )}
      </div>
    
      {task.status === "Completed" && task.completed_at && (
        <div className="flex items-center gap-2 mt-2 text-sm text-green-700">
          <ClipboardCheck className="w-4 h-4" />
          Completed on: {new Date(task.completed_at).toLocaleDateString()}
        </div>
      )}
    
      {/* Task Action Buttons */}
      <div className="mt-4 min-h-[2rem]">
        {task.status !== "Completed" && (
          <div className="flex flex-wrap gap-2">
            {task.status !== "In Progress" && (
              <button onClick={() => handleStart(task.task_id)} className="btn">
                Start
              </button>
            )}
            {task.is_repeating && task.due_in_days_after_dependency != null && (
              <button onClick={() => handleFollowUp(task.task_id)} className="btn btn-outline">
                Follow Up
              </button>
            )}
            <button onClick={() => handleComplete(task.task_id, task.task_name)} className="btn btn-outline">
              Complete
            </button>

            {task.status != "Missed" && (
             <button onClick={() => handleMissed(task.task_id)} className="btn bg-red-600 text-white">
             Missed
           </button>
            )}
           
          </div>
        )}
      </div>
    </div>
    
    ));

  const renderNotes = () => (
    <div className="bg-white p-6 rounded-lg shadow border space-y-4">
      <textarea
        className="w-full border rounded p-3 text-sm"
        placeholder="Write a note..."
        value={newNote}
        onChange={(e) => setNewNote(e.target.value)}
      />
      <button className="btn" onClick={addNote}>
        <Plus className="inline w-4 h-4 mr-1" /> Add Note
      </button>
      <div className="mt-4 space-y-3">
        {notes.map((note) => (
          <div key={note.id} className="border-b pb-2">
            <p>{note.note_text}</p>
            <span className="text-xs text-gray-400">
              {new Date(note.created_at).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  if (patientLoading || taskLoading || !patient)
    return <p className="text-center mt-10 text-gray-500">Loading patient data...</p>;

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-light)] text-[var(--text-dark)]">
      <Navbar />

      <main className="flex-grow max-h-[calc(100vh-120px)] overflow-y-auto p-6 max-w-4xl mx-auto">
      
        <Link
          to="/patients"
          className="inline-flex items-center text-orange hover:underline mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Patients
        </Link>

        <div className="card mb-6">
          <h2 className="text-2xl font-bold mb-1">{patient.name}</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Age {patient.age} • Bed {patient.bed_id} • Admitted on{" "}
            {new Date(patient.created_at).toLocaleDateString()}
          </p>
          <div className="text-xs text-[var(--text-muted)] mt-2 space-y-1">
            {patient.is_behavioral && (
              <p>
                <strong>Algorithm:</strong> Behavioral Plan <br />
                Restrained: {patient.is_restrained ? "Yes" : "No"} | Behavioral Team:{" "}
                {patient.is_behavioral_team ? "Yes" : "No"} <br />
                Geriatric Psych Available: {patient.is_geriatric_psych_available ? "Yes" : "No"}
              </p>
            )}
            {patient.is_guardianship && (
              <p>
                <strong>Algorithm:</strong> Guardianship Workflow <br />
                Emergency: {patient.is_guardianship_emergency ? "Yes" : "No"} | Financial:{" "}
                {patient.is_guardianship_financial ? "Yes" : "No"} | Person:{" "}
                {patient.is_guardianship_person ? "Yes" : "No"} <br />
                Court Date:{" "}
                {patient.court_date
                  ? new Date(patient.court_date).toLocaleDateString()
                  : "Not Set"}
              </p>
            )}
            {patient.is_ltc && (
              <p>
                <strong>Algorithm:</strong> Long-Term Care (LTC) <br />
                Financial: {patient.is_ltc_financial ? "Yes" : "No"} | Medical:{" "}
                {patient.is_ltc_medical ? "Yes" : "No"}
              </p>
            )}
          </div>
        </div>

        <div className="flex space-x-2 border-b mb-6">
          {["Pending", "In Progress", "Completed", "All Tasks", "Notes"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab as any)}
              className={`tab ${selectedTab === tab ? "tab-active" : ""}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {selectedTab === "Notes" ? renderNotes() : renderTasks()}
      </main>

      <Footer />
    </div>
  );
};

export default PatientTasks;
