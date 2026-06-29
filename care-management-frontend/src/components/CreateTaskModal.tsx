// src/components/CreateTaskModal.tsx
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { createManualTask, loadPatientTasks } from "../redux/slices/taskSlice";
import type { AppDispatch, RootState } from "../redux/store";

interface Props {
  onClose:   () => void;
  patientId: number;
}

const CreateTaskModal: React.FC<Props> = ({ onClose, patientId }) => {
  const dispatch = useDispatch<AppDispatch>();
  const patient  = useSelector((s: RootState) => s.patients.selectedPatient);

  const [formData, setFormData] = useState({
    name:                "",
    description:         "",
    is_repeating:        false,
    recurrence_interval: "",
    is_overridable:      false,
    is_non_blocking:     false,
    selected_algorithms: [] as string[],
    due_date:            "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;

      if (name.startsWith("algo_")) {
        const algo = name.replace("algo_", "");
        setFormData(prev => ({
          ...prev,
          selected_algorithms: checked
            ? [...prev.selected_algorithms, algo]
            : prev.selected_algorithms.filter(a => a !== algo),
        }));
      } else if (name === "is_repeating") {
        setFormData(prev => ({
          ...prev,
          is_repeating:    checked,
          is_non_blocking: checked ? false : prev.is_non_blocking,
        }));
      } else if (name === "is_non_blocking") {
        setFormData(prev => ({
          ...prev,
          is_non_blocking:     checked,
          is_repeating:        checked ? false : prev.is_repeating,
          recurrence_interval: checked ? "" : prev.recurrence_interval,
        }));
      } else {
        setFormData(prev => ({ ...prev, [name]: checked }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) { toast.error("Task name  is required"); return; }
    if (!formData.description.trim()) { toast.error("Description  is required"); return; }

    const payload = {
      ...formData,
      algorithm:           formData.selected_algorithms.join(","),
      recurrence_interval: formData.is_repeating ? Number(formData.recurrence_interval) : null,
    };

    try {
      await dispatch(createManualTask({ patientId, taskData: payload })).unwrap();
      toast.success("Task created");
      dispatch(loadPatientTasks(patientId));
      onClose();
    } catch {
      toast.error("Failed to create task");
    }
  };

  const algorithmOptions = [...new Set(patient?.active_algorithms || [])] as string[];
  const hasLTC                 = algorithmOptions.includes("LTC");
  const hasGuardianship        = algorithmOptions.includes("Guardianship");
  const hasNonBlockingEligible = hasLTC || hasGuardianship;

  return (
    <>
      <div className="fixed inset-0 z-40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-lg border border-gray-300 text-black">
          <h2 className="text-3xl font-semibold mb-4">Create Manual Task</h2>

          <div className="card">
            <div className="mb-3">
              <label className="block font-medium mb-1">Task Name*</label>
              <input name="name" value={formData.name} onChange={handleChange}
                placeholder="e.g. FollowUp_JohnDoe"
                className="w-full border rounded py-2 px-3 bg-white text-black" />
            </div>

            <div className="mb-3">
              <label className="block font-medium mb-1">Description*</label>
              <textarea name="description" value={formData.description} onChange={handleChange}
                placeholder="Description"
                className="w-full border rounded py-2 px-3 bg-white text-black" />
            </div>

            <div className="mb-4">
              <div className="flex flex-row items-center gap-8">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="is_repeating" checked={formData.is_repeating}
                    onChange={handleChange} disabled={formData.is_non_blocking}
                    className={formData.is_non_blocking ? "cursor-not-allowed opacity-50" : ""} />
                  <span className={`text-sm ${formData.is_non_blocking ? "opacity-50" : ""}`}>
                    Repeating Task
                  </span>
                </label>

                <label className="flex items-center gap-2">
                  <input type="checkbox" name="is_overridable" checked={formData.is_overridable} onChange={handleChange} />
                  <span className="text-sm">Overridable</span>
                </label>

                {hasNonBlockingEligible && (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="is_non_blocking" checked={formData.is_non_blocking} onChange={handleChange} />
                    <span className="text-sm">Non-Blocking</span>
                  </label>
                )}
              </div>

              {formData.is_repeating && (
                <div className="mt-3 ml-6">
                  <label className="block text-sm font-medium mb-1">Recurrence Interval (days)</label>
                  <input name="recurrence_interval" type="number" placeholder="e.g. 7"
                    value={formData.recurrence_interval}
                    onChange={e => { if (e.target.value === "" || Number(e.target.value) >= 0) handleChange(e); }}
                    className="w-40 border rounded py-1.5 px-3 bg-white text-black" />
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Due Date</label>
              <input type="date" name="due_date" value={formData.due_date} onChange={handleChange}
                className="w-full border rounded py-2 px-3 bg-white text-black" />
            </div>

            {algorithmOptions.length > 0 && (
              <div className="mb-4">
                <label className="block font-medium mb-1">Algorithms</label>
                <div className="flex flex-wrap gap-4">
                  {algorithmOptions.map(algo => {
                    const disabled = algo === "Behavioral" && formData.is_non_blocking;
                    return (
                      <label key={algo}
                        className={`flex items-center gap-2 text-sm ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
                        <input type="checkbox" name={`algo_${algo}`}
                          checked={formData.selected_algorithms.includes(algo)}
                          onChange={handleChange} disabled={disabled} />
                        {algo}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit}>Create</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateTaskModal;