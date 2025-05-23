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
  Calendar,
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
  
  const [selectedTab, setSelectedTab] = useState<
  "Missed" | "Pending" | "In Progress" | "Completed" | "All Tasks" | "Notes"
  >("All Tasks");
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

      if (selectedTab === "Notes") {
        dispatch(fetchPatientNotes(Number(patientId)));
      }
      if (taskError === "Tasks are not available for discharged patients") {
        navigate("/patients");
      }
    
    }
  }, [dispatch, patientId, selectedTab,taskError]);
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
    return <span className="badge">{status}</span>;
  };

  const filteredTasks = patientTasks.filter((task) => {
    const matchesStatus =
      selectedTab === "All Tasks" || task.status === selectedTab ||  (selectedTab === "Pending" && task.status === "Follow Up");
    const matchesAlgorithm =
      selectedAlgorithm === "All" || task.algorithm === selectedAlgorithm;
    return matchesStatus && matchesAlgorithm;
  });
  


  const renderTasks = () =>
    filteredTasks.map((task: Task)  => {
      console.log("🧠 Rendering task:", task.task_name, "Status:", task.status);
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
            setExpandedTaskId(null); // collapse after save
          })
          .catch(() => toast.error("Failed to update task note"));
      };
  
      const borderColor = algoColorMap[task.algorithm as keyof typeof algoColorMap] || "var(--border-muted)";
      const idealDue = task.ideal_due_date ? new Date(task.ideal_due_date) : null;
        const completedAt = task.completed_at ? new Date(task.completed_at) : null;
        const now = new Date(); 

        const isDelayed = idealDue
        ? (
            (completedAt && completedAt > idealDue) ||
            (!completedAt && now > new Date(idealDue.getFullYear(), idealDue.getMonth(), idealDue.getDate(), 23, 59, 59))
          )
        : false;
      
      return (
        <div
        key={task.task_id}
        className={`card w-full  border p-4 mb-4 text-black ${
          task.is_non_blocking ? "non-blocking" : ""
        } ${task.status === "Missed" ? "card-missed" : ""} ${
          task.status === "Completed" ? "card-completed" : ""
        }`}
        style={{  borderLeft: `12px solid ${borderColor}` }}
      >
        {/* Header */}
        <div className="relative mb-2 flex justify-between">
          <div className="flex-1 max-w-[65%]">
            <h3 className="text-lg font-semibold break-words">
              {task.task_name}
            </h3>
            <p className="text-sm">{task.description}</p>
          </div>

            {/* Task Actions */}
            <div className="flex flex-wrap gap-2 items-start">
          {task.status !== "Completed" && (
            <>
              {task.status !== "In Progress" &&  task.status !== "Missed" &&(
                <button
                  onClick={() => handleStart(task.task_id)}
                  className="btn"
                >
                  Start
                </button>
              )}
              {task.is_repeating &&
                task.due_in_days_after_dependency != null && (
                  <button
                    onClick={() => handleFollowUp(task.task_id)}
                    className="btn btn-outline"
                  >
                    Follow Up
                  </button>
                )}
              <button
                onClick={() =>
                  handleComplete(task.task_id, task.task_name)
                }
                className="btn btn-outline"
              >
                Complete
              </button>
              {task.status !== "Missed" && (
                <button
                  onClick={() => handleMissed(task.task_id)}
                  className="btn bg-red-600 text-white"
                >
                  Missed
                </button>
              )}
            </>
          )}
     

   
            {getStatusBadge(task.status)}
                        {isDelayed &&  (
              <span className="badge">
                Delayed 
              </span>
            )}
          </div>
          

        </div>

        <div className="text-sm mb-2">
          <Calendar className="inline w-4 h-4 mr-1" />
          Due: {new Date(task.due_date).toLocaleDateString()}
        </div>
        {task.completed_at && (
          <div>
           <strong>Completed:</strong>{' '}
            {task.completed_at
              ? new Date(task.completed_at).toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })
              : 'N/A'}

            {task.completed_by && <> by <strong>{task.completed_by}</strong></>}
          </div>
        )}

<div className="text-sm mb-2">
          <button
                className="underline"
                onClick={() =>
                  setExpandedTaskId(isExpanded ? null : task.task_id)
                }
              >
                {isExpanded ? "Hide Note Options" : "Add/Edit Note or Contact Info"}
              </button>

   </div>
        <p className="text-sm">{task.task_note}</p>
        <p className="text-sm">{task.contact_info}</p>

      

        {/* Expanded Note UI */}
        {isExpanded && (
          <div className="mt-3 p-3 border rounded  space-y-2 bg-white text-black">
            <textarea
              className="w-full border rounded p-2 text-sm"
              placeholder="Enter task note..."
              value={draft.task_note}
              onChange={(e) => updateDraft("task_note", e.target.value)}
            />
            <input
              type="text"
              className="w-full border rounded p-2 text-sm"
              placeholder="Contact info"
              value={draft.contact_info}
              onChange={(e) => updateDraft("contact_info", e.target.value)}
            />
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.include_note_in_report}
                  onChange={(e) =>
                    updateDraft("include_note_in_report", e.target.checked)
                  }
                />
                Include note in report
              </label>
              
            </div>
            <button onClick={handleSaveMeta} className="btn btn-sm">
             Save Note Info
            </button>
          </div>
        )}

      
      </div>
    );
  });

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
            <span className="text-xs text-white">
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

              {/* Tabs */}
        <div className="flex flex-wrap justify-center  gap-2 border-b pb-2 mb-4">
          {["Missed","Pending", "In Progress", "Completed", "All Tasks", "Notes"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab as any)}
              className={`btn ${selectedTab === tab ? "btn-outline" : ""}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Algorithm Filter */}
        {selectedTab !== "Notes" && (
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
        )}
              
        {selectedTab === "Notes" ? renderNotes() : renderTasks()}
       
   
      </main>

      <Footer />
    </div>
  );
};

export default PatientTasks;
