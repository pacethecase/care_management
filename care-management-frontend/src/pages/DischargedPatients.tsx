import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchDischargedPatients } from "../redux/slices/patientSlice";
import { fetchHistoricalTimelineReport } from "../redux/slices/reportSlice";
import { RootState } from "../redux/store";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import PatientCard from "../components/PatientCard";
import HistoricalTimelineReport from "../components/HistoricalTimelineReport";
import type { AppDispatch } from "../redux/store";

const DischargedPatients = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { dischargedPatients, dischargedCount, loading, error } = useSelector(
    (state: RootState) => state.patients
  );
  const { historicalReport, loading: reportLoading } = useSelector(
    (state: RootState) => state.reports
  );
  const { user } = useSelector((state: RootState) => state.user);


  const [expandedPatientId, setExpandedPatientId] = useState<number | null>(null);


  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");


  useEffect(() => {
    dispatch(fetchDischargedPatients({ start: start || undefined, end: end || undefined }));
    setCurrentPage(1);
  }, [dispatch, start, end]);

  const totalPages = Math.ceil(dischargedPatients.length / itemsPerPage);

  const paginatedPatients = useMemo(() => {
    return dischargedPatients.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [dischargedPatients, currentPage]);

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
        {/* header with count */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-red-600">Discharged Patients</h2>
          {!loading && (
            <span className="text-sm text-gray-700">
              Total in range: <b>{dischargedCount}</b>
            </span>
          )}
        </div>

        {/* date filters */}
        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-xs text-gray-600">Start Date</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="input input-bordered input-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600">End Date</label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="input input-bordered input-sm"
            />
          </div>
        </div>

        {/* messages */}
        {loading && <p>Loading patients...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {!loading && dischargedPatients.length === 0 && (
          <p className="text-gray-500">
            {start || end
              ? "No discharged patients in this date range."
              : "No discharged patients found."}
          </p>
        )}

        {/* patient list */}
        <div className="grid grid-cols-1 gap-6">
          {paginatedPatients.map((patient) => (
            <div key={patient.id}>
              <PatientCard
                patient={patient}
                user={user}
                showDischargeInfo={true}
                onViewReport={(id) => {
                  if (typeof id === "number") {
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
                    historicalReport && <HistoricalTimelineReport report={historicalReport} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8">
            <button
              onClick={handlePrev}
              disabled={currentPage === 1}
              className={`btn btn-outline ${
                currentPage === 1 ? "opacity-50 cursor-not-allowed" : ""
              }`}
              aria-label="Previous page"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className={`btn btn-outline ${
                currentPage === totalPages ? "opacity-50 cursor-not-allowed" : ""
              }`}
              aria-label="Next page"
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
