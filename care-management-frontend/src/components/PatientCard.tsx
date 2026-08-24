// src/components/PatientCard.tsx
import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaEdit, FaUserSlash } from "react-icons/fa";
import { useDispatch } from "react-redux";
import {
  dischargePatient, fetchPatients, reactivatePatient,
  fetchDischargedPatients, archiveDischargedPatient,
} from "../redux/slices/patientSlice";
import { toast } from "react-toastify";
import type { AppDispatch } from "../redux/store";
import type { Patient, UserInfo } from "../redux/types";

interface PatientCardProps {
  patient:          Patient;
  user:             UserInfo | null;
  showDischargeInfo?: boolean;
  showArchivedInfo?:  boolean;
  onClick?:         () => void;
  onViewReport?:    (id: number) => void;
}

// FIX: age computed from birth_date — not stored on patient
const calculateAge = (dob: string): number => {
  const [year, month, day] = dob.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  const passed = today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!passed) age--;
  return age >= 0 ? age : 0;
};

const PatientCard: React.FC<PatientCardProps> = ({
  patient, user,
  showDischargeInfo = false,
  showArchivedInfo  = false,
  onClick, onViewReport,
}) => {
  const dispatch   = useDispatch<AppDispatch>();
  const navigate   = useNavigate();
  const location   = useLocation();
  const currentPath = location.pathname + location.search;

  // FIX: role checks use role string
  const isAdmin      = user?.role === "admin";
  const isSuperAdmin = user?.role === "super_admin";

  const age = calculateAge(patient.birth_date);

  const taskButtonColor = {
    missed:      "bg-red-600 hover:bg-red-700",
    in_progress: "bg-blue-500 hover:bg-blue-600",
    completed:   "bg-green-600 hover:bg-green-700",
  }[patient.task_status ?? ""] ?? "bg-gray-400 hover:bg-gray-500";

  const algorithms = [
    patient.is_behavioral  && "Behavioral",
    patient.is_ltc         && "Long-Term Care",
    patient.is_guardianship && "Guardianship",
  ].filter(Boolean);

  const handleEdit = () => navigate(`/patients/${patient.id}/edit`);

  const handleDischarge = () => {
    if (!isAdmin) return;
    const note = prompt("Enter discharge note:");
    if (!note) return;
    dispatch(dischargePatient({ patientId: patient.id, version: patient.version, dischargeNote: note }))
      .unwrap()
      .then((res) => toast.success(res.message))
      .catch((err) => toast.error(err?.error || "Failed to discharge patient"));
  };

  const handleReactivate = (patientId: number, version: number) => {
    if (!isAdmin) return;
    if (!window.confirm("Are you sure you want to reactivate this patient?")) return;
    dispatch(reactivatePatient({ patientId, version }))
      .unwrap()
      .then(() => {
        toast.success("Patient reactivated!");
        dispatch(fetchDischargedPatients());
        dispatch(fetchPatients());
      })
      .catch((err) => {
        toast.error(typeof err === "string" ? err : "Failed to reactivate patient.");
      });
  };

  const handleArchive = async () => {
    if (!isAdmin) return;
    const fullName = `${patient.first_name} ${patient.last_name}`;
    const reason   = window.prompt(`Archive "${fullName}"?\nEnter a reason:`) || undefined;
    if (!reason) return;
    try {
      await dispatch(archiveDischargedPatient({ patientId: patient.id, reason, version: patient.version })).unwrap();
      toast.success(`Archived ${fullName}`);
      dispatch(fetchDischargedPatients());
    } catch (err: any) {
      toast.error(err || "Failed to archive patient");
    }
  };

  const showActionButtons = !showDischargeInfo && !showArchivedInfo && !isSuperAdmin;
  const showDischargeActions = (isAdmin || isSuperAdmin) && showDischargeInfo;
  const showArchivedActions  = (isAdmin || isSuperAdmin) && showArchivedInfo;

  return (
    <div
      className="bg-white p-6 rounded-xl shadow-lg border border-[var(--border-muted)] transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative"
      onClick={onClick}
    >
      {showActionButtons && (
        <div className="absolute top-2 right-2 flex gap-3 text-lg">
          <FaEdit
            className="text-blue-600 cursor-pointer"
            title="Edit patient"
            onClick={(e) => { e.stopPropagation(); handleEdit(); }}
          />
          {isAdmin && (
            <FaUserSlash
              className="text-red-500 cursor-pointer"
              title="Discharge patient"
              onClick={(e) => { e.stopPropagation(); handleDischarge(); }}
            />
          )}
        </div>
      )}

      {/* Discharged patient actions */}
      {showDischargeActions && (
        <div className="absolute top-2 right-2 flex gap-3 text-sm">
          {/* FIX: only hospital admin (not super_admin) can reactivate/archive */}
          {isAdmin && (
            <>
              <button className="btn mt-4" onClick={() => handleReactivate(patient.id, patient.version)}>
                Reactivate Patient
              </button>
              <button className="btn mt-4" onClick={handleArchive} title="Archive patient">
                Archive
              </button>
            </>
          )}
          {onViewReport && (
            <button className="btn mt-4" onClick={() => onViewReport(patient.id)}>
              View Historical Report
            </button>
          )}
        </div>
      )}

      {/* Archived patient actions */}
      {showArchivedActions && onViewReport && (
        <div className="absolute top-2 right-2">
          <button className="btn mt-4" onClick={() => onViewReport(patient.id)}>
            View Historical Timeline
          </button>
        </div>
      )}

      <h3 className="text-xl font-bold mb-1">
        {patient.last_name}, {patient.first_name}
      </h3>

      <div className="text-sm text-[var(--text-dark)] space-y-1">
        <p><span className="font-semibold">Age:</span> {age} years</p>
        <p><span className="font-semibold">Room:</span> {patient.room_no || "N/A"}</p>
        <p><span className="font-semibold">MRN:</span> {patient.mrn || "N/A"}</p>
        <p>
          <span className="font-semibold">Workflow Map:</span>{" "}
          {algorithms.length > 0 ? algorithms.join(", ") : "Not Provided"}
        </p>
        {/* FIX: role check */}
        {isSuperAdmin && (
          <p><span className="font-semibold">Hospital:</span> {patient.hospital_name || "N/A"}</p>
        )}
      </div>

      {showDischargeInfo && patient.discharge_date && (
        <div className="mt-2 text-sm text-gray-700">
          <p><strong>Discharged on:</strong> {new Date(patient.discharge_date).toLocaleDateString()}</p>
          <p><em>{patient.discharge_note}</em></p>
        </div>
      )}

      {showArchivedInfo && patient.archived_at && (
        <div className="mt-2 text-sm text-gray-700">
          <p><strong>Archived on:</strong> {new Date(patient.archived_at).toLocaleDateString()}</p>
          <p><em>{patient.archived_reason}</em></p>
        </div>
      )}

      {!showDischargeInfo && !showArchivedInfo && (
        <div className="mt-4 flex justify-center">
          <Link
            to={`/patients/${patient.id}/tasks`}
            state={{ from: currentPath }}
            className={`btn1 px-6 py-2 text-white ${taskButtonColor} rounded-md font-semibold shadow-md transition-all duration-300`}
          >
            View Tasks
          </Link>
        </div>
      )}
    </div>
  );
};

export default PatientCard;