// src/pages/PatientTasks.tsx
import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  loadPatientTasks, startTask, completeTask,
  markTaskAsMissed, followUpTask, acknowledgeTask,
  updateTaskNoteMeta, overrideTask,
} from "../redux/slices/taskSlice";
import { fetchPatientById, updateCourtDate } from "../redux/slices/patientSlice";
import { fetchPatientNotes, addPatientNote, updatePatientNote, deletePatientNote } from "../redux/slices/noteSlice";
import CreateTaskModal from "../components/CreateTaskModal";
import BlueLoader from "../components/BlueLoader";
import { RootState, AppDispatch } from "../redux/store";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import type { Task, Note } from "../redux/types";
import { showCourtDatePopup } from "../utils/showCourtDatePopup";
import { useHospitalTimezone } from "../hooks/timezone";
import AskApprovalModal from "../components/AskApprovalModal";
const PatientTasks = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const dispatch  = useDispatch<AppDispatch>();
  const navigate  = useNavigate();
  const location  = useLocation();
  const backLink  = location.state?.from || "/patients";

  const { patientTasks, loading: taskLoading, taskError } = useSelector((s: RootState) => s.tasks);
  const { selectedPatient: patient, loading: patientLoading } = useSelector((s: RootState) => s.patients);
  const { notes } = useSelector((s: RootState) => s.notes);
  const { user }  = useSelector((s: RootState) => s.user);

  // FIX: role checks use role string
  const isAdmin = user?.role === "admin";
  const isStaff = user?.role === "staff";
  const canAct  = isAdmin || isStaff;

  const { formatDateTime, formatDueDate } = useHospitalTimezone();

  const [showCreateModal, setShowCreateModal]   = useState(false);
  const [newNote, setNewNote]                   = useState("");
  const [expandedTaskId, setExpandedTaskId]     = useState<number | null>(null);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("All");
  const [overrideDates, setOverrideDates]       = useState<Record<number, string>>({});
  const [activeTab, setActiveTab]               = useState<"Tasks" | "Notes">("Tasks");
  const [editNoteId, setEditNoteId]             = useState<number | null>(null);
  const [editText, setEditText]                 = useState("");
  const [noteDrafts, setNoteDrafts]             = useState<Record<number, {
    task_note: string; contact_info: string; include_note_in_report: boolean;
  }>>({});
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  useEffect(() => {
    if (!patientId) return;
    dispatch(fetchPatientById(Number(patientId)));
    dispatch(loadPatientTasks(Number(patientId)));
    dispatch(fetchPatientNotes(Number(patientId)));
  }, [dispatch, patientId]);

  useEffect(() => {
    if (taskError === "Tasks are not available for discharged patients") navigate("/patients");
  }, [taskError, navigate]);

  useEffect(() => {
    if (expandedTaskId === null) return;
    if (noteDrafts[expandedTaskId]) return;
    const task = patientTasks.find(t => t.patient_task_id === expandedTaskId);
    if (task) {
      setNoteDrafts(prev => ({
        ...prev,
        [expandedTaskId]: {
          task_note:              task.task_note || "",
          contact_info:           task.contact_info || "",
          include_note_in_report: !!task.include_note_in_report,
        },
      }));
    }
  }, [expandedTaskId, noteDrafts, patientTasks]);

  // ── Action handlers ─────────────────────────────────────────────────────────
  const reload = () => {
    dispatch(loadPatientTasks(Number(patientId)));
    dispatch(fetchPatientById(Number(patientId)));
  };

  const handleStart = async (taskId: number, version: number) => {
    try {
      await dispatch(startTask({ taskId, version })).unwrap();
      toast.success("Task started");
      reload();
    } catch (err: any) {
      toast.error(typeof err === "string" ? err : err?.error || "Failed to start task");
    }
  };

  const handleAcknowledge = async (taskId: number, version: number) => {
    const reason = prompt("Please enter a reason to acknowledge this task:");
    if (!reason?.trim()) { toast.error("Reason is required."); return; }
    try {
      await dispatch(acknowledgeTask({ taskId, version, reason })).unwrap();
      toast.success("Task acknowledged");
      reload();
    } catch (err: any) {
      toast.error(typeof err === "string" ? err : err?.error || "Failed to acknowledge task");
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
    } catch (err: any) {
      const msg = typeof err === "string" ? err : err?.error || "";
      if (msg.toLowerCase().includes("missed")) {
        const missedReason = prompt("This task was missed. Please enter a missed reason:")?.trim();
        if (!missedReason) { toast.error("Missed reason is required."); return; }
        try {
          await dispatch(completeTask({ taskId, version, reason, missed_reason: missedReason, court_date: courtDate })).unwrap();
          toast.success("Task completed");
        } catch { toast.error("Failed to complete task."); }
      } else {
        toast.error(msg || "Failed to complete task.");
      }
    }
    reload();
  };

  const handleMissed = async (taskId: number, version: number) => {
    const reason = prompt("Enter missed reason:");
    if (!reason?.trim()) { toast.error("Missed reason is required."); return; }
    try {
      await dispatch(markTaskAsMissed({ taskId, version, reason })).unwrap();
      toast.success("Task marked as missed");
      reload();
    } catch (err: any) {
      toast.error(typeof err === "string" ? err : "Failed to mark as missed");
    }
  };

  const handleFollowUp = async (taskId: number, version: number) => {
    const reason = prompt("Please enter a reason for follow-up:");
    if (!reason?.trim()) { toast.error("Follow-up reason is required."); return; }
    try {
      await dispatch(followUpTask({ taskId, version, followUpReason: reason })).unwrap();
      toast.success("Follow-up scheduled!");
      reload();
    } catch (err: any) {
      toast.error(typeof err === "string" ? err : "Failed to schedule follow-up");
    }
  };

  const handleOverride = async (taskId: number, version: number) => {
    const selected = overrideDates[taskId];
    if (!selected) { toast.error("Please choose an override date first."); return; }
    const reason = prompt("Please enter a reason to override this task:")?.trim();
    if (!reason) { toast.error("Override reason is required."); return; }
    try {
      const res = await dispatch(overrideTask({ patientTaskId: taskId, version, override_date: selected, reason })).unwrap();
      if (res.message?.toLowerCase().includes("admin approval")) {
        toast.info(`${res.message} — Reason: "${reason}"`);
      } else {
        toast.success(res.message);
        reload();
      }
      setOverrideDates(prev => { const c = { ...prev }; delete c[taskId]; return c; });
    } catch (err: any) {
      toast.error(typeof err === "string" ? err : err?.error || "Failed to override task");
    }
  };

  const handleSaveMeta = async (taskId: number, version: number, data: any) => {
    try {
      await dispatch(updateTaskNoteMeta({ taskId, version, data })).unwrap();
      toast.success("Task note updated");
      setExpandedTaskId(null);
    } catch (err: any) {
      toast.error(typeof err === "string" ? err : err?.error || "Failed to update task note");
    }
  };

    const handleEditCourtDate = async (type: "guardianship" | "ltc") => {
    const newDate = await showCourtDatePopup();
    if (!newDate) return;

    try {
      await dispatch(updateCourtDate({
        patientId: Number(patientId),
        type,
        newDate,
        version: patient!.version,
      })).unwrap();
      toast.success("Court date updated");
      reload();
    } catch (err: any) {
      toast.error(err?.toString() || "Failed to update court date");
    }
  };

  // ── Task grouping ────────────────────────────────────────────────────────────
  const tasksByStatus = useMemo(() => {
    const filtered = patientTasks.filter(t =>
      selectedAlgorithm === "All" ? true : t.algorithm === selectedAlgorithm
    );
    const map: Record<string, Task[]> = {
      "Pending/In Progress": [], Missed: [], Completed: [], "Non-Blocking": [],
    };
    for (const task of filtered) {
      if (task.is_non_blocking) map["Non-Blocking"].push(task);
      else if (["Pending", "In Progress", "Follow Up"].includes(task.status)) map["Pending/In Progress"].push(task);
      else if (["Completed", "Delayed Completed", "Acknowledged"].includes(task.status)) map["Completed"].push(task);
      else if (task.status === "Missed") map["Missed"].push(task);
    }
    const byDue = (a: Task, b: Task) => new Date(a.due_date || "").getTime() - new Date(b.due_date || "").getTime();
    map["Pending/In Progress"].sort(byDue);
    map["Missed"].sort(byDue);
    map["Completed"].sort((a, b) => new Date(b.completed_at || "").getTime() - new Date(a.completed_at || "").getTime());
    map["Non-Blocking"].sort((a, b) => {
      // Pending first, Acknowledged last
      if (a.status === "Pending" && b.status === "Acknowledged") return -1;
      if (a.status === "Acknowledged" && b.status === "Pending") return 1;
      return new Date(b.completed_at || "").getTime() - new Date(a.completed_at || "").getTime();
    });
    return map;
  }, [patientTasks, selectedAlgorithm]);

  // ── Task card ────────────────────────────────────────────────────────────────
  const algoColorMap: Record<string, string> = {
    Behavioral:   "var(--algo-behavioral)",
    Guardianship: "var(--algo-guardianship)",
    LTC:          "var(--algo-ltc)",
  };

  const renderTaskCard = (task: Task) => {
    const isExpanded = expandedTaskId === task.patient_task_id;
    const draft = noteDrafts[task.patient_task_id] || { task_note: "", contact_info: "", include_note_in_report: false };
    const borderColor = algoColorMap[task.algorithm] || "var(--border-muted)";

    // FIX: status_history now uses new_status field (from patient_task_status_history table)
    const latestByStatus = (status: string) =>
      task.status_history
        ?.filter(e => (e as any).new_status === status || (e as any).status === status)
        ?.sort((a, b) => new Date((b as any).changed_at || (b as any).timestamp || "").getTime() -
                         new Date((a as any).changed_at || (a as any).timestamp || "").getTime())[0];

    const missedEntry      = latestByStatus("Missed");
    const followUpEntry    = latestByStatus("Follow Up");
    const completedEntry   = latestByStatus("Completed");
    const delayedEntry     = latestByStatus("Delayed Completed");
    const acknowledgeEntry = latestByStatus("Acknowledged");

    // Override history
    const lastOverride = task.status_history
      ?.filter(e => (e as any).new_status === "Overridden" || (e as any).status === "Overridden")
      ?.slice(-1)[0];

    const updateDraft = (field: keyof typeof draft, value: any) =>
      setNoteDrafts(prev => ({ ...prev, [task.patient_task_id]: { ...prev[task.patient_task_id], [field]: value } }));

    return (
      <div
        key={task.patient_task_id}
        className={`card border p-4 mb-4 rounded-lg text-black
          ${task.is_non_blocking ? ["Acknowledged", "Follow Up"].includes(task.status) ? "non-blocking-complete" : "non-blocking" : ""}
          ${task.status === "Missed" ? "card-missed" : ""}
          ${["Completed", "Delayed Completed"].includes(task.status) ? "card-completed" : ""}`}
        style={{ borderLeft: `12px solid ${borderColor}` }}
      >
        <div className="flex justify-end mb-2">
          <span className="badge text-xs px-2 py-1 rounded-full font-semibold">{task.status}</span>
        </div>

        <h4 className="font-bold text-sm">{task.task_name}</h4>
        <p className="text-xs">{task.description}</p>

        <div className="text-sm mb-2 font-bold">
          {!task.is_non_blocking && task.due_date && <div>Due: {formatDueDate(task.due_date)}</div>}
          {!task.is_non_blocking && task.started_at && (
            <div>Started: {formatDateTime(task.started_at)}{task.started_by && <> by <b>{task.started_by}</b></>}</div>
          )}
          {!task.is_non_blocking && task.completed_at && (
            <div>Completed: {formatDateTime(task.completed_at)}{task.completed_by && <> by <b>{task.completed_by}</b></>}</div>
          )}

          {(completedEntry || delayedEntry || followUpEntry || missedEntry || acknowledgeEntry) && (
            <div className="mt-1 rounded p-2" style={{ backgroundColor: "var(--prussian-blue)", color: "white" }}>
              {completedEntry   && <div className="text-xs"><b>Completed Note:</b> {(completedEntry as any).note || "None"}</div>}
              {delayedEntry     && <div className="text-xs"><b>Completed Note:</b> {(delayedEntry as any).note || "None"}</div>}
              {followUpEntry    && <div className="text-xs"><b>Follow-Up Note:</b> {(followUpEntry as any).note || "None"}</div>}
              {missedEntry && (() => {
                const raw = (missedEntry as any).note || "";
                const isSystemNote = raw.startsWith("Auto-marked missed by system");
                const [systemPart, staffPart] = raw.includes(" | Staff reason: ")
                  ? raw.split(" | Staff reason: ")
                  : [null, raw];

                return (
                  <div className="text-xs">
                    <b>Missed Reason:</b>{" "}
                    {isSystemNote && systemPart && (
                      <span className="text-yellow-300">[Auto] {systemPart} </span>
                    )}
                    {staffPart && staffPart !== systemPart && (
                      <span>{staffPart}</span>
                    )}
                    {!staffPart && !systemPart && "None"}
                  </div>
                );
              })()}
              {acknowledgeEntry && <div className="text-xs"><b>Acknowledged Note:</b> {(acknowledgeEntry as any).note || "None"}</div>}
            </div>
          )}

          {task.is_non_blocking && task.status === "Acknowledged" && task.acknowledged_at && (
            <div>
              Acknowledged: {formatDateTime(task.acknowledged_at)}
              {task.acknowledged_by && <> done by <b>{task.acknowledged_by}</b></>}
            </div>
          )}

          {task.override_count > 0 && (
            <div className="mt-1 rounded p-2" style={{ backgroundColor: "var(--prussian-blue)", color: "white" }}>
              <div className="text-xs">
                Overridden {task.override_count} time{task.override_count > 1 ? "s" : ""}
                {lastOverride && <>
                  <br />Last Reason: {(lastOverride as any).note || "N/A"}
                  <br />At: {formatDateTime((lastOverride as any).changed_at || (lastOverride as any).timestamp)}
                </>}
              </div>
            </div>
          )}

          {!task.is_non_blocking && task.is_overridable &&
           !["Missed","Completed","Delayed Completed"].includes(task.status) && (
            <div className="mb-2 mt-2">
              <label className="block text-sm font-medium text-gray-700">Override next due date:</label>
              <input
                type="date"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                value={overrideDates[task.patient_task_id] || ""}
                onChange={(e) => setOverrideDates(prev => ({ ...prev, [task.patient_task_id]: e.target.value }))}
              />
            </div>
          )}
        </div>

        {/* FIX: role check */}
        {canAct && (
          <div className="flex gap-2 flex-wrap mb-2">
            {!task.is_non_blocking && !["Completed","Delayed Completed"].includes(task.status) && (
              overrideDates[task.patient_task_id] ? (
                <button
                  className={`btn btn-xs text-white ${task.override_count >= task.override_count_max ? "bg-red-500" : "bg-yellow-500"}`}
                  onClick={() => handleOverride(task.patient_task_id, task.version)}
                >
                  {task.override_count >= task.override_count_max ? "Request Admin Approval" : "Override Task"}
                </button>
              ) : (
                <>
                  {!["In Progress","Missed"].includes(task.status) && (
                    <button className="btn btn-xs" onClick={() => handleStart(task.patient_task_id, task.version)}>Start</button>
                  )}
                  <button className="btn btn-xs btn-outline" onClick={() => handleComplete(task.patient_task_id, task.version, task.is_court_date ?? false)}>Complete</button>
                  <button className="btn btn-xs bg-red-600 text-white" onClick={() => handleMissed(task.patient_task_id, task.version)}>Missed</button>
                  {task.is_repeating && task.due_in_days_after_dependency != null && (
                    <button className="btn btn-xs btn-outline" onClick={() => handleFollowUp(task.patient_task_id, task.version)}>Follow Up</button>
                  )}
                </>
              )
            )}

            {task.is_non_blocking && task.status !== "Acknowledged" && (
              <>
                <button className="btn btn-xs bg-blue-500 text-white" onClick={() => handleAcknowledge(task.patient_task_id, task.version)}>Acknowledge</button>
                <button className="btn btn-xs btn-outline" onClick={() => handleFollowUp(task.patient_task_id, task.version)}>Follow Up</button>
              </>
            )}
            {task.is_non_blocking && task.status === "Acknowledged" && (
              <button className="btn btn-xs btn-outline" onClick={() => handleFollowUp(task.patient_task_id, task.version)}>Follow Up</button>
            )}
          </div>
        )}

        {canAct && (
          <div className="text-xs">
            <button className="underline text-black" onClick={() => setExpandedTaskId(isExpanded ? null : task.patient_task_id)}>
              {isExpanded ? "Hide Note Options" : "Add/Edit Note or Contact Info"}
            </button>
          </div>
        )}

        {task.task_note    && <p className="text-sm mt-1">{task.task_note}</p>}
        {task.contact_info && <p className="text-sm">{task.contact_info}</p>}

        {isExpanded && (
          <div className="mt-2 border rounded bg-white p-2 text-sm space-y-2">
            <textarea className="w-full border rounded p-2" placeholder="Task note..." value={draft.task_note} onChange={(e) => updateDraft("task_note", e.target.value)} />
            <input type="text" className="w-full border rounded p-2" placeholder="Contact info" value={draft.contact_info} onChange={(e) => updateDraft("contact_info", e.target.value)} />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.include_note_in_report} onChange={(e) => updateDraft("include_note_in_report", e.target.checked)} />
              Include note in report
            </label>
            <button className="btn btn-xs" onClick={() => handleSaveMeta(task.patient_task_id, task.version, draft)}>Save</button>
          </div>
        )}
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (patientLoading || taskLoading || !patient) return <BlueLoader />;

  return (
    <div className="flex flex-col min-h-screen text-white">
      <Navbar />
      <main className="flex-grow w-full mx-auto px-6 overflow-y-auto">

        <Link to={backLink} className="inline-flex items-center hover:underline mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Link>

        {/* Patient header */}
        <div className="card-heading text-black mb-6 text-center">
          <h2 className="text-2xl font-bold mb-1">{patient.last_name}, {patient.first_name}</h2>
          <h3 className="text-md font-semibold mb-1">
            Staff:{" "}
            {patient.assigned_staff?.length
              ? patient.assigned_staff.map((s: any) => s.name).join(", ")
              : "Unassigned"}
          </h3>
          <p className="text-sm font-semibold">
            • Room {patient.room_no}
            • Admitted on {formatDateTime(patient.admitted_date)}
            • System Entry {formatDateTime(patient.created_at)}
            • MRN {patient.mrn}
          </p>

          <div className="text-xs mt-2 space-y-1">
            {patient.is_behavioral && (
              <p className="p-3 rounded-md text-sm text-white" style={{ backgroundColor: "var(--algo-behavioral)" }}>
                <strong>Workflow Map:</strong> Behavioral Plan<br />
                Restrained: {patient.is_restrained ? "Yes" : "No"} | Team: {patient.is_behavioral_team ? "Yes" : "No"}<br />
                Geriatric Psych: {patient.is_geriatric_psych_available ? "Yes" : "No"}
              </p>
            )}
           {patient.is_guardianship && (
            <p className="p-3 rounded-md text-sm text-white" style={{ backgroundColor: "var(--algo-guardianship)" }}>
              <strong>Workflow Map:</strong> Guardianship<br />
              Emergency: {patient.is_guardianship_emergency ? "Yes" : "No"} |
              Financial: {patient.is_guardianship_financial ? "Yes" : "No"} |
              Person: {patient.is_guardianship_person ? "Yes" : "No"}<br />
              Court Date:{" "}
              {patient.guardianship_court_date ? (
                <>
                  {formatDateTime(patient.guardianship_court_date)}
                  {canAct && (
                    <button onClick={() => handleEditCourtDate("guardianship")} className="ml-4 hover:underline text-sm inline-flex items-center gap-1">
                      <Pencil size={14} /> Edit
                    </button>
                  )}
                </>
              ) : "Not Set"}
            </p>
          )}

          {patient.is_ltc && (
            <p className="p-3 rounded-md text-sm text-white" style={{ backgroundColor: "var(--algo-ltc)" }}>
              <strong>Workflow Map:</strong> Long-Term Care (LTC)<br />
              Financial: {patient.is_ltc_financial ? "Yes" : "No"} | Medical: {patient.is_ltc_medical ? "Yes" : "No"}<br />
              Court Date:{" "}
              {patient.ltc_court_date ? (
                <>
                  {formatDateTime(patient.ltc_court_date)}
                  {canAct && (
                    <button onClick={() => handleEditCourtDate("ltc")} className="ml-4 hover:underline text-sm inline-flex items-center gap-1">
                      <Pencil size={14} /> Edit
                    </button>
                  )}
                </>
              ) : "Not Set"}
            </p>
          )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-6 gap-4">
          <button className={`btn ${activeTab === "Tasks" ? "btn-active" : ""}`} onClick={() => setActiveTab("Tasks")}>Tasks</button>
          <button className={`btn ${activeTab === "Notes" ? "btn-active" : ""}`} onClick={() => setActiveTab("Notes")}>Notes</button>
          {canAct && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>Create Task</button>
            
          )}
          {canAct && (
              <button className="btn btn-primary" onClick={() => setShowApprovalModal(true)}>
                Request Approval
              </button>
            )}
        </div>

        {showCreateModal && (
          <CreateTaskModal onClose={() => setShowCreateModal(false)} patientId={Number(patientId)} />
        )}
        {showApprovalModal && (
          <AskApprovalModal
            patientId={Number(patientId)}
            tasks={patientTasks}
            onClose={() => setShowApprovalModal(false)}
          />
        )}

        {/* Algorithm filter */}
        <div className="flex text-black justify-end items-center mb-6">
          <label className="text-sm font-medium mr-2">Filter by Workflow Map:</label>
          <select
            value={selectedAlgorithm}
            onChange={(e) => setSelectedAlgorithm(e.target.value)}
            className="border rounded px-3 py-1 text-sm shadow-sm"
          >
            <option value="All">All</option>
            {patient.is_behavioral   && <option value="Behavioral">Behavioral</option>}
            {patient.is_guardianship && <option value="Guardianship">Guardianship</option>}
            {patient.is_ltc          && <option value="LTC">LTC</option>}
          </select>
        </div>

        {activeTab === "Tasks" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "Pending/In Progress", tasks: tasksByStatus["Pending/In Progress"] },
              { title: "Missed",              tasks: tasksByStatus["Missed"] },
              { title: "Completed",           tasks: tasksByStatus["Completed"] },
              { title: "Non-Blocking",        tasks: tasksByStatus["Non-Blocking"] },
            ].map(col => (
              <div key={col.title} className="bg-white rounded-lg p-3 shadow text-black">
                <h3 className="text-lg font-bold mb-3 text-center">{col.title}</h3>
                {col.tasks.length === 0
                  ? <p className="text-sm text-gray-500 text-center">No tasks</p>
                  : col.tasks.map(task => renderTaskCard(task))}
              </div>
            ))}
          </div>
        )}

        {activeTab === "Notes" && (
          <div className="mt-4">
            <h2 className="text-xl font-semibold mb-2 text-black">General Notes</h2>
            <div className="bg-white p-6 text-black mb-10 rounded-lg shadow space-y-4">
              <textarea className="w-full border rounded p-3 text-sm" placeholder="Write a note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} />
              <button className="btn" onClick={() => {
                if (!newNote.trim()) { toast.error("Note cannot be empty!"); return; }
                dispatch(addPatientNote({ patientId: Number(patientId), note_text: newNote }))
                  .then(() => { setNewNote(""); toast.success("Note added"); });
              }}>
                <Plus className="inline w-4 h-4 mr-1" /> Add Note
              </button>

              <div className="mt-4 space-y-3">
                {notes.map((note: Note) => (
                  <div key={note.id} className="p-3 border rounded-md bg-gray-50 shadow-sm">
                    {editNoteId === note.id ? (
                      <div className="space-y-2">
                        <textarea className="w-full border rounded p-2 text-sm" value={editText} onChange={(e) => setEditText(e.target.value)} />
                        <div className="flex gap-2">
                          <button className="btn" onClick={() =>
                            dispatch(updatePatientNote({ noteId: note.id, note_text: editText }))
                              .unwrap()
                              .then(() => { setEditNoteId(null); toast.success("Note updated"); })
                              .catch(() => toast.error("Failed to update note"))
                          }>Save</button>
                          <button className="btn bg-gray-200 text-black" onClick={() => setEditNoteId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm">{note.note_text}</p>
                        <div className="flex items-center justify-between text-xs mt-1">
                          <span>{new Date(note.created_at).toLocaleString()}{note.nurse_name && ` • by ${note.nurse_name}`}</span>
                          <div className="flex gap-2">
                            <button onClick={() => { setEditNoteId(note.id); setEditText(note.note_text); }} title="Edit"><Pencil size={16} /></button>
                            <button onClick={() =>
                              dispatch(deletePatientNote({ noteId: note.id }))
                                .unwrap()
                                .then(() => toast.success("Note deleted"))
                                .catch(() => toast.error("Failed to delete note"))
                            } title="Delete"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default PatientTasks;