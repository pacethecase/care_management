import React, { useState } from "react";
import PatientCard from "./PatientCard";

const PatientsList = ({ patients , user}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  // Sort by created_at (newest first)
  const sortedPatients = [...patients].sort((a, b) =>
    new Date(b.created_at || b.id).getTime() - new Date(a.created_at || a.id).getTime()
  );

  const totalPages = Math.ceil(sortedPatients.length / itemsPerPage);
  const paginated = sortedPatients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  return (
    <div className="w-full lg:w-3/4 p-6 mx-auto">
      <h2 className="text-3xl font-bold text-hospital-blue mb-6">Patients</h2>

      {patients.length === 0 ? (
        <p className="text-gray-500 text-lg text-center">No patients found.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginated.map((patient) => (
            <PatientCard key={patient.id} patient={patient} user={user} />
          ))}
          </div>

          {/* Next/Previous Pagination */}
          <div className="mt-8 flex justify-center gap-4 items-center">
            <button
              onClick={handlePrev}
              disabled={currentPage === 1}
              className={`px-5 py-2 rounded-lg text-sm font-medium border ${
                currentPage === 1
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-white text-gray-700 border-[var(--border-muted)] hover:bg-[var(--hover-tab)]"
              }`}
            >
              ← Previous
            </button>

            <span className="text-gray-600 text-sm">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className={`px-5 py-2 rounded-lg text-sm font-medium border ${
                currentPage === totalPages
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-white text-gray-700 border-[var(--border-muted)] hover:bg-[var(--hover-tab)]"
              }`}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PatientsList;
