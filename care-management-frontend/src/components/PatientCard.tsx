import React from "react";
import { Link } from "react-router-dom";

const PatientCard = ({ patient }) => {
  // Correct age calculation based on birthdate
  const birthDate = new Date(patient.birth_date);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const isBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!isBirthdayPassed) age--;

  return (
    <div className="relative bg-white p-6 rounded-xl shadow-lg border border-gray-200 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      {/* Patient Name */}
      <h3 className="text-2xl font-semibold text-hospital-blue">{patient.name}</h3>

      {/* Patient Details */}
      <div className="mt-3 text-gray-700">
        <p>
          <span className="font-medium">Age:</span> {age} years
        </p>
        <p>
          <span className="font-medium">Bed:</span> {patient.bed_id || "N/A"}
        </p>
  
        <p>
     <span className="font-medium">Algorithm:</span>{" "}
          {patient.is_behavioral
            ? "Behavioral"
            : patient.is_ltc
            ? "Long-Term Care"
            : patient.is_guardianship
            ? "Guardianship"
            : "Not Provided"}
        </p>
              
      </div>

      {/* View Tasks Button */}
      <div className="mt-4 flex justify-center">
        <Link
          to={`/patients/${patient.id}/tasks`}
          className="px-5 py-2 text-lg font-medium btn hover:btn-text-white rounded-lg transition shadow-md"
        >
          View Tasks
        </Link>
      </div>
    </div>
  );
};

export default PatientCard;
