// components/AskApprovalModal.tsx
import { useState } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "../redux/store";
import { createApprovalRequest } from "../redux/slices/approvalSlice";
import { toast } from "react-toastify";
import type { Task } from "../redux/types";

// FIX: temporarily hidden per request — keep functionality intact for
// possible re-enable later. Flip to true to bring the dropdown back.
const SHOW_RELATED_TASK_FIELD = false;

interface Props {
  patientId: number;
  tasks: Task[];
  onClose: () => void;
}

const AskApprovalModal = ({ patientId, tasks, onClose }: Props) => {
  const dispatch = useDispatch<AppDispatch>();

  const [name, setName]                   = useState("");
  const [description, setDescription]     = useState("");
  const [amount, setAmount]               = useState("");
  const [patientTaskId, setPatientTaskId] = useState<string>(""); // "" = not tied to a task
  const [submitting, setSubmitting]       = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error("Name is required."); return; }
    const parsedAmount = Number(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount < 0) {
      toast.error("Please enter a valid estimated amount.");
      return;
    }

    setSubmitting(true);
    try {
      await dispatch(createApprovalRequest({
        patientId,
        name: name.trim(),
        description: description.trim() || undefined,
        estimated_amount: parsedAmount,
        patient_task_id: patientTaskId ? Number(patientTaskId) : undefined,
      })).unwrap();
      toast.success("Approval request submitted.");
      onClose();
    } catch (err: any) {
      toast.error(typeof err === "string" ? err : "Failed to submit approval request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-lg border border-gray-300 text-black">
          <h2 className="text-3xl font-semibold mb-4">Ask Approval</h2>

          <div className="card">
            {/* FIX: hidden per request, keeping state/logic intact so this
                can be re-enabled later by flipping SHOW_RELATED_TASK_FIELD */}
            {SHOW_RELATED_TASK_FIELD && (
              <div className="mb-3">
                <label className="block font-medium mb-1">Related Task (optional)</label>
                <select
                  className="w-full border rounded py-2 px-3 bg-white text-black"
                  value={patientTaskId}
                  onChange={(e) => setPatientTaskId(e.target.value)}
                >
                  <option value="">Not tied to a specific task</option>
                  {tasks.map(t => (
                    <option key={t.patient_task_id} value={t.patient_task_id}>
                      {t.task_name} ({t.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-3">
              <label className="block font-medium mb-1">Name*</label>
              <input
                type="text"
                className="w-full border rounded py-2 px-3 bg-white text-black"
                placeholder="e.g. Wheelchair rental"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <label className="block font-medium mb-1">Description</label>
              <textarea
                className="w-full border rounded py-2 px-3 bg-white text-black"
                placeholder="Details about this request..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className="block font-medium mb-1">Estimated Amount ($)*</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border rounded py-2 px-3 bg-white text-black"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button className="btn btn-outline" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AskApprovalModal;