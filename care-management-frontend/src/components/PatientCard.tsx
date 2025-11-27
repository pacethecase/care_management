import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaEdit, FaUserSlash } from "react-icons/fa";
import { useDispatch } from "react-redux";
import {
  dischargePatient,
  fetchPatients,
  reactivatePatient,
  fetchDischargedPatients,
   archiveDischargedPatient
} from "../redux/slices/patientSlice";
import { toast } from "react-toastify";

import type { AppDispatch } from "../redux/store";
import type { Patient } from "../redux/types";
import type { UserInfo } from "../redux/types";

interface PatientCardProps {
  patient: Patient;
  user: UserInfo | null;
  showDischargeInfo?: boolean;
  showArchivedInfo?: boolean;
  onClick?: () => void;
  onViewReport?: (id: number) => void;
}

const PatientCard: React.FC<PatientCardProps> = ({
  patient,
  user,
  showDischargeInfo = false,
  showArchivedInfo= false,
  onClick,
  onViewReport,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname + location.search;

  const handleEdit = () => {
    navigate(`/patients/${patient.id}/edit`);
  };

  const birthDate = new Date(patient.birth_date);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const isBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!isBirthdayPassed) age--;


let taskButtonColor = "";

switch (patient.task_status) {
  case "missed":
    taskButtonColor = "bg-red-600 hover:bg-red-700";
    break;
  case "in_progress":
    taskButtonColor = "bg-blue-500 hover:bg-blue-600";
    break;
  case "completed":
    taskButtonColor = "bg-green-600 hover:bg-green-700";
    break;
  default:
    taskButtonColor = "bg-gray-400 hover:bg-gray-500";
}


  const algorithms = [
    patient.is_behavioral && "Behavioral",
    patient.is_ltc && "Long-Term Care",
    patient.is_guardianship && "Guardianship",
  ].filter(Boolean);

  const handleDischarge = () => {
    if (!user?.is_admin) return;
    const note = prompt("Enter discharge note:");
    if (!note) return;

    dispatch(dischargePatient({ patientId: patient.id, dischargeNote: note }))
      .unwrap()
      .then((res) => {
        toast.success(res.message);
        dispatch(fetchPatients());
      })
      .catch((err) => {
        toast.error(err?.error || "Failed to discharge patient");
      });
  };

  const handleReactivate = (id: number) => {
    if (!user?.is_admin) return;
    if (!window.confirm("Are you sure you want to reactivate this patient?")) return;

    dispatch(reactivatePatient(id))
      .unwrap()
      .then(() => {
        toast.success("Patient reactivated!");
        dispatch(fetchDischargedPatients());
        dispatch(fetchPatients());
      })
      .catch((err) => {
        toast.error(err || "Failed to reactivate patient.");
      });
  };


const handleArchive = async () => {
  if (!user?.is_admin) return;
  const fullName = `${patient.first_name} ${patient.last_name}`;
  const reason =
    window.prompt(
      `Archive "${fullName}"?\nEnter a reason:`,
    ) || undefined;

  try {
    await dispatch(archiveDischargedPatient({ patientId: patient.id, reason })).unwrap();
    toast.success(`Archived ${fullName}`);
    dispatch(fetchDischargedPatients()); 
  } catch (err: any) {
    toast.error(err || "Failed to archive patient");
  }
};


  return (
    <div
      className="bg-white p-6 rounded-xl shadow-lg border border-[var(--border-muted)] transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative"
      onClick={onClick}
    >
    
    {!showDischargeInfo && !showArchivedInfo && !user?.is_super_admin && !user?.has_global_access &&(
        <div className="absolute top-2 right-2 flex gap-3 text-lg">
          <FaEdit
            className="text-blue-600 cursor-pointer"
            title="Edit patient"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit();
            }}
          />
          

        
      {user?.is_admin &&(
            <FaUserSlash
              className="text-red-500 cursor-pointer"
              title="Discharge patient"
              onClick={(e) => {
                e.stopPropagation();
                handleDischarge();
              }}
            />
      )}

        </div>
      )}

      {(user?.is_admin || user?.is_super_admin) && showDischargeInfo && (
          <div className="absolute top-2 right-2 flex gap-3 text-sm">
            {user?.is_admin && !user?.is_super_admin && (
              <>
                <button
                  className="btn mt-4"
                  onClick={() => handleReactivate(patient.id)}
                >
                  Reactivate Patient
                </button>

                <button
                  className="btn mt-4"
                  onClick={handleArchive}
                  title="Archive (hide from Discharged & all reports)"
                >
                  Archive
                </button>
              </>
            )}
            {onViewReport && (
              <button
                className="btn mt-4"
                onClick={() => onViewReport(patient.id)}
              >
                View Historical Report
              </button>
            )}

          </div>
        )}

      {(user?.is_admin || user?.is_super_admin) && showArchivedInfo && (
        <div className="absolute top-2 right-2 flex gap-3 text-sm">
          {onViewReport && (
            <button
              className="btn mt-4"
              onClick={() => onViewReport(patient.id)}
            >
              View Historical Timeline
            </button>
          )}
        </div>
      )}

      <h3 className="text-xl font-bold mb-1">
        {patient.last_name}, {patient.first_name}
      </h3>

      <div className="text-sm text-[var(--text-dark)] space-y-1">
        <p>
          <span className="font-semibold">Age:</span> {age} years
        </p>
        <p>
          <span className="font-semibold">Room:</span> {patient.room_no || "N/A"}
        </p>
        <p>
          <span className="font-semibold">Workflow Map:</span>{" "}
          {algorithms.length > 0 ? algorithms.join(", ") : "Not Provided"}
        </p>
        {user?.is_super_admin && (
          <div>
          <span className="font-semibold">Hospital:</span> {patient.hospital_id || "N/A"}
          </div>
        )}
      </div>

      {/* Discharge Info */}
      {showDischargeInfo && patient.discharge_date && (
        <div className="mt-2 text-sm text-gray-700">
          <p>
            <strong>Discharged on:</strong>{" "}
            {new Date(patient.discharge_date).toLocaleDateString()}
          </p>
          <p>
            <em>{patient.discharge_note}</em>
          </p>
        </div>
      )}
      {showArchivedInfo && patient.archived_at && (
          <div className="mt-2 text-sm text-gray-700">
          <p>
            <strong>Archived on:</strong>{" "}
            {new Date(patient.archived_at).toLocaleDateString()}
          </p>
          <p>
            <em>{patient.archived_reason}</em>
          </p>
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
