import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchDischargedPatients,
} from "../redux/slices/patientSlice";
import {
  fetchHistoricalTimelineReport,
} from "../redux/slices/reportSlice";
import { RootState } from "../redux/store";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import PatientCard from "../components/PatientCard";
import HistoricalTimelineReport from "../components/HistoricalTimelineReport";
import type { AppDispatch } from "../redux/store";

const DischargedPatients = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { dischargedPatients, loading, error } = useSelector(
    (state: RootState) => state.patients
  );
  const { historicalReport, loading: reportLoading } = useSelector(
    (state: RootState) => state.reports
  );
  const { user } = useSelector((state: RootState) => state.user);

  const [expandedPatientId, setExpandedPatientId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  useEffect(() => {
    dispatch(fetchDischargedPatients());
  }, [dispatch]);

  const totalPages = Math.ceil(dischargedPatients.length / itemsPerPage);
  const paginatedPatients = dischargedPatients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleNext = () => {
    if (currentPage < totalPages) {
      setExpandedPatientId(null);
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentPage > 1) {
      setExpandedPatientId(null);
      setCurrentPage((prev) => prev - 1);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-light)] text-[var(--text-dark)]">
      <Navbar />
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6 text-red-600">Discharged Patients</h2>

        {loading && <p>Loading patients...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {dischargedPatients.length === 0 && !loading && (
          <p>No discharged patients found.</p>
        )}

        <div className="grid grid-cols-1 gap-6">
          {paginatedPatients.map((patient) => (
            <div key={patient.id}>
              <PatientCard
                patient={patient}
                user={user}
                showDischargeInfo={true}
               onViewReport={(id) => {
              if (id && typeof id === "number") {
                setExpandedPatientId(id);
                dispatch(fetchHistoricalTimelineReport({ patientId: id }));
              }
            }}

              />

              {expandedPatientId === patient.id && (
                <div className="mt-4">
                  {reportLoading ? (
                    <p className="text-gray-600">Loading historical report...</p>
                  ) : (
                    historicalReport && (
                      <HistoricalTimelineReport report={historicalReport} />
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8">
            <button
              onClick={handlePrev}
              disabled={currentPage === 1}
              className="btn btn-outline"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className="btn btn-outline"
            >
              Next
            </button>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default DischargedPatients;
