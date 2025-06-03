import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loadPatientsByAlgorithm } from "../redux/slices/algorithmSlice";
import { RootState } from "../redux/store";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import type { AppDispatch } from "../redux/store";
import React from "react";

// ✅ Memoized Card component
const PatientCard = React.memo(({ patient, onClick }: { patient: any; onClick: () => void }) => (
  <div
    className="bg-white p-6 rounded-lg shadow-xl cursor-pointer hover:shadow-2xl transform transition-all hover:scale-105"
    onClick={onClick}
  >
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-semibold text-gray-800">
        {patient.last_name}, {patient.first_name}
      </h2>
    </div>
    <div className="text-sm text-gray-600 mt-3">
      <p>Bed: {patient.bed_id}</p>
      <p>DOB: {new Date(patient.birth_date).toLocaleDateString()}</p>
      <p>Admitted On: {patient.created_at ? new Date(patient.created_at).toLocaleDateString() : "N/A"}</p>
    </div>
  </div>
));

const AlgorithmPatients = () => {
  const { algorithm } = useParams();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname + location.search;

  const { patientsByAlgorithm, loadingCounts, loadingPatients, error } = useSelector(
    (state: RootState) => state.algorithms
  );

  const [currentPage, setCurrentPage] = useState(1);
  const patientsPerPage = 9;

  useEffect(() => {
    if (algorithm) {
      dispatch(loadPatientsByAlgorithm(algorithm));
      setCurrentPage(1);
    }
  }, [dispatch, algorithm]);

  // ✅ Memoized paginated data
  const currentPatients = useMemo(() => {
    const start = (currentPage - 1) * patientsPerPage;
    return patientsByAlgorithm.slice(start, start + patientsPerPage);
  }, [patientsByAlgorithm, currentPage]);

  const handleClick = (id: number) => {
    navigate(`/patients/${id}/tasks`, { state: { from: currentPath } });
  };

  const totalPages = Math.ceil(patientsByAlgorithm.length / patientsPerPage);

  const nextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  if (loadingCounts || loadingPatients) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral text-hospital-dark">
      <Navbar />
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">{algorithm} Patients</h1>

        {currentPatients.length === 0 ? (
          <div className="text-gray-500 text-center col-span-full mt-8">No patients found.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentPatients.map((p) => (
                <PatientCard key={p.id} patient={p} onClick={() => handleClick(p.id)} />
              ))}
            </div>

            <div className="flex justify-between items-center mt-6">
              <button
                onClick={prevPage}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={nextPage}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default AlgorithmPatients;
