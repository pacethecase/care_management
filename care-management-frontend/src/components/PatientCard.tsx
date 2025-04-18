import React from "react";
import { Link } from "react-router-dom";
import { FaTrashAlt } from "react-icons/fa";
import { useDispatch } from "react-redux";
import { dischargePatient } from "../redux/slices/patientSlice";
import { toast } from "react-toastify";

const PatientCard = ({ patient, user,showDischargeInfo = false }) => {
  const dispatch = useDispatch();

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
      .then((res) => toast.success(res.message))
      .catch((err) => toast.error(err?.error || "Failed to discharge patient"));
  };

  return (
    <div className="bg-white w-full p-6 rounded-xl shadow-lg border border-[var(--border-muted)] transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative">
      {/* Discharge Icon - Admin only */}
      {user?.is_admin && (
        <div
          className="absolute top-2 right-2 cursor-pointer text-red-500"
          onClick={handleDischarge}
        >
          <FaTrashAlt size={22} title="Discharge patient" />
        </div>
      )}

      {/* Name */}
      <h3 className="text-xl font-bold text-[var(--funky-orange)] mb-1">{patient.name}</h3>

      {/* Details */}
      <div className="text-sm text-[var(--text-dark)] space-y-1">
        <p><span className="font-medium">Age:</span> {age} years</p>
        <p><span className="font-medium">Bed:</span> {patient.bed_id || "N/A"}</p>
        <p><span className="font-medium">Algorithm:</span> {algorithms.length > 0 ? algorithms.join(", ") : "Not Provided"}</p>
      </div>
            {showDischargeInfo && patient.discharge_date && (
        <div className="mt-2 text-sm text-gray-700">
          <p><strong>Discharged on:</strong> {new Date(patient.discharge_date).toLocaleDateString()}</p>
          <p><em>{patient.discharge_note}</em></p>
        </div>
      )}


      {/* CTA Button */}
      <div className="mt-4 flex justify-center">
        <Link
          to={`/patients/${patient.id}/tasks`}
          className="btn px-6 py-2 text-white bg-[var(--funky-orange)] hover:bg-orange-600 rounded-md transition-all duration-300"
        >
          View Tasks
        </Link>
      </div>
    </div>
  );
};

export default PatientCard;
