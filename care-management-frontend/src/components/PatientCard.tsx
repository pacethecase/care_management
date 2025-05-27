import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaEdit, FaUserSlash } from "react-icons/fa";
import { useDispatch } from "react-redux";
import {
  dischargePatient,
  fetchPatients,
  reactivatePatient,
  fetchDischargedPatients,
} from "../redux/slices/patientSlice";
import { toast } from "react-toastify";

import type { AppDispatch } from "../redux/store";
import type { Patient } from "../redux/types";
import type { UserInfo } from "../redux/types";

interface PatientCardProps {
  patient: Patient;
  user: UserInfo | null;
  showDischargeInfo?: boolean;
  onClick?: () => void;
  onViewReport?: (id: number) => void;
}

const PatientCard: React.FC<PatientCardProps> = ({
  patient,
  user,
  showDischargeInfo = false,
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

  const algorithms = [
    patient.is_behavioral && "Behavioral",
    patient.is_ltc && "Long-Term Care",
    patient.is_guardianship && "Guardianship",
  ].filter(Boolean);

  const handleDischarge = () => {
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

  return (
    <div
      className="bg-white p-6 rounded-xl shadow-lg border border-[var(--border-muted)] transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative"
      onClick={onClick}
    >
      {/* Admin Controls */}
      {user?.is_admin && !showDischargeInfo && (
        <div className="absolute top-2 right-2 flex gap-3 text-lg">
          <FaEdit
            className="text-blue-600 cursor-pointer"
            title="Edit patient"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit();
            }}
          />
          <FaUserSlash
            className="text-red-500 cursor-pointer"
            title="Discharge patient"
            onClick={(e) => {
              e.stopPropagation();
              handleDischarge();
            }}
          />
        </div>
      )}

      {user?.is_admin && showDischargeInfo && (
        <div className="absolute top-2 right-2 flex gap-3 text-sm">
          <button className="btn mt-4" onClick={() => handleReactivate(patient.id)}>
            Reactivate Patient
          </button>
          {onViewReport && (
            <button className="btn mt-4" onClick={() => onViewReport(patient.id)}>
              View Historical Report
            </button>
          )}
        </div>
      )}

      {/* Patient Info */}
      <h3 className="text-xl font-bold mb-1">
        {patient.last_name}, {patient.first_name}
      </h3>

      <div className="text-sm text-[var(--text-dark)] space-y-1">
        <p>
          <span className="font-semibold">Age:</span> {age} years
        </p>
        <p>
          <span className="font-semibold">Bed:</span> {patient.bed_id || "N/A"}
        </p>
        <p>
          <span className="font-semibold">Workflow Map:</span>{" "}
          {algorithms.length > 0 ? algorithms.join(", ") : "Not Provided"}
        </p>
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

      {/* CTA */}
      {!showDischargeInfo && (
        <div className="mt-4 flex justify-center">
          <Link
            to={`/patients/${patient.id}/tasks`}
            state={{ from: currentPath }}
            className="btn px-6 py-2 text-white bg-[var(--warm-orange)] hover:bg-orange-600 rounded-md font-semibold shadow-md transition-all duration-300"
          >
            View Tasks
          </Link>
        </div>
      )}
    </div>
  );
};

export default PatientCard;
