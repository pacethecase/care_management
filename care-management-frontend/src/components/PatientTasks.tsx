import  { useState, useEffect } from "react";
import { useParams, Link ,useLocation} from "react-router-dom";
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
import { updateTaskNoteMeta } from "../redux/slices/taskSlice";
import { RootState } from "../redux/store";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  ArrowLeft,
  Plus,
} from "lucide-react";
import { toast } from "react-toastify";
import { useNavigate } from 'react-router-dom';
import type { AppDispatch } from '../redux/store';
import type { Task } from  "../redux/types";
import type { Note } from  "../redux/types";


const PatientTasks = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  const backLink = location.state?.from || "/patients";
  
 
  const [newNote, setNewNote] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
const [noteDrafts, setNoteDrafts] = useState<Record<number, {
  task_note: string;
  contact_info: string;
  include_note_in_report: boolean;
}>>({});
  const { patientTasks, loading: taskLoading } = useSelector((state: RootState) => state.tasks);
  const { selectedPatient: patient, loading: patientLoading } = useSelector((state: RootState) => state.patients);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>("All");
  const { notes } = useSelector((state: RootState) => state.notes);
  const { user } = useSelector((state: RootState) => state.user);
  const { taskError } = useSelector((state: RootState) => state.tasks);

  const navigate = useNavigate();

  const algoColorMap = {
    Behavioral: "var(--algo-behavioral)",
    Guardianship: "var(--algo-guardianship)",
    LTC: "var(--algo-ltc)",
  };
 
  
  useEffect(() => {
    if (patientId) {
      dispatch(fetchPatientById(Number(patientId)));
      dispatch(loadPatientTasks(Number(patientId)));
      dispatch(fetchPatientNotes(Number(patientId))); 

  
      if (taskError === "Tasks are not available for discharged patients") {
        navigate("/patients");
      }
    
    }
  }, [dispatch, patientId,taskError]);
      useEffect(() => {
        if (expandedTaskId !== null && !noteDrafts[expandedTaskId]) {
          const task = patientTasks.find(t => t.task_id === expandedTaskId);
          if (task) {
            setNoteDrafts(prev => ({
              ...prev,
              [task.task_id]: {
                task_note: task.task_note || "",
                contact_info: task.contact_info || "",
                include_note_in_report: !!task.include_note_in_report,
              }
            }));
          }
        }
      }, [expandedTaskId, noteDrafts, patientTasks]);
  

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
      const isCourtTask =
        taskName === "Court date confirmed" ||
        taskName === "Court Hearing Date Received if not follow up completed" ||
        taskName === "Confirm date/time of States initial steps including Intake Interview: if not scheduled, follow-up with State";
  
      if (isCourtTask) {
        // Container
        const container = document.createElement("div");
        container.className = "court-popup"; // Add styles for this class in index.css
  
        //  Label
        const label = document.createElement("label");
        label.textContent = "📅 Select court date & time";
  
        // Input
        const input = document.createElement("input");
        input.type = "datetime-local";
  
        //Buttons container
        const buttonGroup = document.createElement("div");
        buttonGroup.className = "court-popup-buttons";
  
        //Submit button
        const submitBtn = document.createElement("button");
        submitBtn.textContent = "Submit";
        submitBtn.className = "court-popup-submit";
  
       
        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Cancel";
        cancelBtn.className = "court-popup-cancel";
        cancelBtn.onclick = () => {
          document.body.removeChild(container);
        };
  
      
        submitBtn.onclick = async () => {
          const courtDate = input.value;
          document.body.removeChild(container);
  
          if (!courtDate) {
            toast.error("Court date is required.");
            return;
          }
  
          try {
            await dispatch(completeTask({ taskId, court_date: courtDate })).unwrap();
            toast.success("✅ Task completed");
  
            if (patientId) {
              dispatch(fetchPatientById(Number(patientId)));
              dispatch(loadPatientTasks(Number(patientId)));
            }
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
        
                await dispatch(completeTask({ taskId, court_date: courtDate })).unwrap();
                toast.success("✅ Task completed after reason provided");
        
                if (patientId) {
                  dispatch(fetchPatientById(Number(patientId)));
                  dispatch(loadPatientTasks(Number(patientId)));
                }
              } catch {
                toast.error("❌ Failed to complete task even after reason");
              }
            } else {
              toast.error("❌ Failed to complete task");
            }
          }
        };
  
        // 🧩 Assemble DOM
        buttonGroup.appendChild(submitBtn);
        buttonGroup.appendChild(cancelBtn);
        container.appendChild(label);
        container.appendChild(input);
        container.appendChild(buttonGroup);
        document.body.appendChild(container);
  
        return;
      }
  
    
      await dispatch(completeTask({ taskId })).unwrap();
      toast.success("✅ Task completed");
  
      if (patientId) {
        dispatch(fetchPatientById(Number(patientId)));
        dispatch(loadPatientTasks(Number(patientId)));
      }
    } catch(err: any) {
      if (err?.toString().includes("Please provide a reason")) {
        const reason = prompt("📝 This task was missed earlier. Please enter a missed reason to proceed:");
  
        if (!reason || reason.trim() === "") {
          toast.error("❌ Reason is required to complete this task.");
          return;
        }
    

        try {
          await dispatch(markTaskAsMissed({ taskId, reason })).unwrap();
          toast.success("✅ Missed reason recorded");
    
         
          await dispatch(completeTask({ taskId })).unwrap();
          toast.success("✅ Task completed after reason provided");
          if (patientId) {
            dispatch(fetchPatientById(Number(patientId)));
            dispatch(loadPatientTasks(Number(patientId)));
          }
        } catch {
          toast.error("❌ Failed to complete task even after reason");
        }
      } else {
        toast.error("❌ Failed to complete task");
      }
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
  return (
    <span className="badge text-xs px-2 py-1 rounded-full font-semibold">
      {status}
    </span>
  );
};


  
const getTasksByStatus = (status: string) =>
  patientTasks.filter((task) => {
  
    if (status === "Non-Blocking") return task.is_non_blocking;

    if (status === "Pending/In Progress") {
      return (
        ["Pending", "In Progress", "Follow Up"].includes(task.status) &&
        !task.is_non_blocking
      );
    }
    return task.status === status && !task.is_non_blocking;
  });




const renderTaskCard = (task: Task) => {
  const isExpanded = expandedTaskId === task.task_id;
  const draft = noteDrafts[task.task_id] || {
    task_note: "",
    contact_info: "",
    include_note_in_report: false,
  };

  const updateDraft = (field: keyof typeof draft, value: any) => {
    setNoteDrafts((prev) => ({
      ...prev,
      [task.task_id]: {
        ...prev[task.task_id],
        [field]: value,
      },
    }));
  };

  const handleSaveMeta = () => {
    dispatch(updateTaskNoteMeta({
      taskId: task.task_id,
      data: draft,
    }))
      .unwrap()
      .then(() => {
        toast.success("Task note updated");
        setExpandedTaskId(null);
      })
      .catch(() => toast.error("Failed to update task note"));
  };

  const borderColor = algoColorMap[task.algorithm as keyof typeof algoColorMap] || "var(--border-muted)";


  return (
    <div
      key={task.task_id}
      className={`card border p-4 mb-4 rounded-lg text-black ${
        task.is_non_blocking ?"non-blocking":""
      } ${task.status === "Missed" ? "card-missed" : ""}
        ${task.status === "Completed" ? "card-completed" : ""}
      `}
      style={{ borderLeft: `12px solid ${borderColor}` }}
    >
       <div className="flex justify-end mb-2">
        <div className="flex gap-2 flex-wrap">
          {getStatusBadge(task.status)}
    
        </div>
        </div>
      <div className="flex justify-between bg-white   rounded items-start mb-2">
        <div>
          <h4 className="font-semibold text-sm">{task.task_name}</h4>
          <p className="text-xs text-gray-600">{task.description}</p>
        </div>
      
      </div>

      <div className="text-xs mb-2">
       Due: {new Date(task.due_date).toLocaleDateString()}
         {task.started_at && (
            <div>
                Started: {new Date(task.started_at).toLocaleString()}
                {task.started_by && <> by <b>{task.started_by}</b></>}
              </div>
            )}
        {task.completed_at && (
          <div>
            Completed: {new Date(task.completed_at).toLocaleString()} by <b>{task.completed_by}</b>
          </div>
        )}
      
         
      </div>

      <div className="flex gap-2 flex-wrap mb-2">
        {task.status !== "Completed" && (
          <>
            {task.status !== "In Progress" && task.status !== "Missed" && (
              <button className="btn btn-xs" onClick={() => handleStart(task.task_id)}>Start</button>
            )}
            <button className="btn btn-xs btn-outline" onClick={() => handleComplete(task.task_id, task.task_name)}>Complete</button>
            <button className="btn btn-xs bg-red-600 text-white" onClick={() => handleMissed(task.task_id)}>Missed</button>
            {task.is_repeating && task.due_in_days_after_dependency != null && (
              <button className="btn btn-xs btn-outline" onClick={() => handleFollowUp(task.task_id)}>Follow Up</button>
            )}
          </>
        )}
      </div>

      <div className="text-xs">
        <button
          className="underline text-black"
          onClick={() => setExpandedTaskId(isExpanded ? null : task.task_id)}
        >
          {isExpanded ? "Hide Note Options" : "Add/Edit Note or Contact Info"}
        </button>
      </div>

      {task.task_note && <p className="text-sm mt-1">{task.task_note}</p>}
      {task.contact_info && <p className="text-sm">{task.contact_info}</p>}

      {isExpanded && (
        <div className="mt-2 border rounded bg-white p-2 text-sm space-y-2">
          <textarea
            className="w-full border rounded p-2"
            placeholder="Task note..."
            value={draft.task_note}
            onChange={(e) => updateDraft("task_note", e.target.value)}
          />
          <input
            type="text"
            className="w-full border rounded p-2"
            placeholder="Contact info"
            value={draft.contact_info}
            onChange={(e) => updateDraft("contact_info", e.target.value)}
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.include_note_in_report}
              onChange={(e) => updateDraft("include_note_in_report", e.target.checked)}
            />
            Include note in report
          </label>
          <button className="btn btn-xs" onClick={handleSaveMeta}>💾 Save</button>
        </div>
      )}
    </div>
  );
};


const renderTaskColumns = () => {
  const columns = [
    { title: "Pending/In Progress", tasks: getTasksByStatus("Pending/In Progress") },
    { title: "Missed", tasks: getTasksByStatus("Missed") },
    { title: "Completed", tasks: getTasksByStatus("Completed") },
    { title: "Non-Blocking", tasks: getTasksByStatus("Non-Blocking") },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map((col) => (
        <div key={col.title} className="bg-white rounded-lg p-3 shadow text-black">
          <h3 className="text-lg font-bold mb-3 text-center">{col.title}</h3>
          {col.tasks.length === 0 ? (
            <p className="text-sm text-gray-500 text-center">No tasks</p>
          ) : (
            col.tasks.map((task) => renderTaskCard(task))
          )}
        </div>
      ))}
    </div>
  );
};

  const renderNotes = () => (
    <div className="bg-white p-6 text-black mb-10 rounded-lg shadow  space-y-4">
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
      {notes.map((note: Note) => (
          <div key={note.id} className="pb-2">
            <p>{note.note_text}</p>
            <span className="text-xs">
              {new Date(note.created_at).toLocaleString()}
               {note.nurse_name && ` • by ${note.nurse_name}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  if (patientLoading || taskLoading || !patient)
    return <p className="text-center mt-10 text-gray-500">Loading patient data...</p>;

  return (
    <div className="flex flex-col min-h-screen text-white">
      <Navbar />
      <main className="flex-grow w-full mx-auto px-6 sm:px-6 overflow-y-auto">

      <Link
        to={backLink}
        className="inline-flex items-center hover:underline mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Link>


        <div className="card-heading text-black mb-6 text-center">
          <h2 className="text-2xl font-bold mb-1">{patient.last_name}, {patient.first_name}</h2>
          <h3 className="text-md  font-semibold mb-1">
              Staff:{" "}
              {Array.isArray(patient.assigned_staff) && patient.assigned_staff.length > 0
                ? patient.assigned_staff.map((s: any) => s.name).join(", ")
                : "Unassigned"}
            </h3>
          <p className="text-sm font-semibold">
          • Age {patient.age} • Bed {patient.bed_id} • Admitted on{" "}
          {patient.created_at ? new Date(patient.created_at).toLocaleDateString() : "N/A"} • MRN {patient.mrn}
          </p>
          <div className="text-xs mt-2 space-y-1">
            {patient.is_behavioral && (
              <p  className="p-3 rounded-md text-sm text-white"
              style={{ backgroundColor: "var(--algo-behavioral)" }}>
                <strong>Workflow Map:</strong> Behavioral Plan <br />
                Restrained: {patient.is_restrained ? "Yes" : "No"} | Behavioral Team:{" "}
                {patient.is_behavioral_team ? "Yes" : "No"} <br />
                Geriatric Psych Available: {patient.is_geriatric_psych_available ? "Yes" : "No"}
              </p>
            )}
            {patient.is_guardianship && (
             <p  className="p-3 rounded-md text-sm text-white"
             style={{ backgroundColor: "var(--algo-guardianship)" }}>
                <strong>Workflow Map:</strong> Guardianship Workflow <br />
                Emergency: {patient.is_guardianship_emergency ? "Yes" : "No"} | Financial:{" "}
                {patient.is_guardianship_financial ? "Yes" : "No"} | Person:{" "}
                {patient.is_guardianship_person ? "Yes" : "No"} | 
                Court Date:{" "}
                {patient.guardianship_court_datetime
                  ? new Date(patient.guardianship_court_datetime).toLocaleString()
                  : "Not Set"}
              </p>
            )}
            {patient.is_ltc && (
              <p  className="p-3 rounded-md text-sm text-white"
              style={{ backgroundColor: "var(--algo-ltc)" }}>
                <strong>Workflow Map:</strong> Long-Term Care (LTC) <br />
                Financial: {patient.is_ltc_financial ? "Yes" : "No"} | Medical:{" "}
                {patient.is_ltc_medical ? "Yes" : "No"} |
                Court Date:{" "}
                {patient.ltc_court_datetime
                  ? new Date(patient.ltc_court_datetime).toLocaleString()
                  : "Not Set"}

              </p>
            )}
          </div>
        </div>

      
        {/* Algorithm Filter */}

          <div className="flex  text-black justify-end items-center mb-6">
            <label htmlFor="algorithmFilter" className="text-sm font-medium mr-2">
              Filter by Workflow Map:
            </label>
            <select
              id="algorithmFilter"
              value={selectedAlgorithm}
              onChange={(e) => setSelectedAlgorithm(e.target.value)}
              className="border rounded px-3 py-1 text-sm shadow-sm"
            >
              <option value="All">All</option>
              {patient.is_behavioral && <option value="Behavioral">Behavioral</option>}
              {patient.is_guardianship && <option value="Guardianship">Guardianship</option>}
              {patient.is_ltc && <option value="LTC">LTC</option>}
            </select>
          </div>
      
              
      {renderTaskColumns()}
<div className="mt-10">
  <h2 className="text-xl font-semibold mb-2 text-black">General Notes</h2>
  {renderNotes()}
</div>

       
   
      </main>

      <Footer />
    </div>
  );
};

export default PatientTasks;
