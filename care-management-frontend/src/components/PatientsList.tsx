import React from "react";
import PatientCard from "./PatientCard";

const PatientsList = ({ patients }) => {
  return (
    <div className="w-full lg:w-3/4 p-6 mx-auto">
      <h2 className="text-3xl font-bold text-hospital-blue mb-6">Patients</h2>

      {patients.length === 0 ? (
        <p className="text-gray-500 text-lg text-center">No patients found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {patients.map((patient) => (
            <PatientCard key={patient.id} patient={patient} />
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientsList;
