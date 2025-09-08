import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { fetchArchivedPatients } from "../redux/slices/patientSlice";
import { fetchHistoricalTimelineReport } from "../redux/slices/reportSlice";
import { RootState } from "../redux/store";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import PatientCard from "../components/PatientCard";
import HistoricalTimelineReport from "../components/HistoricalTimelineReport";
import BlueLoader from "../components/BlueLoader";
import type { AppDispatch } from "../redux/store";
import { ArrowLeft } from "lucide-react";

const ArchivedPatients = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { archivedPatients, archivedLoading, archivedError } = useSelector(
    (state: RootState) => state.patients
  );
  const { historicalReport, loading: reportLoading } = useSelector(
    (state: RootState) => state.reports
  );
  const { user } = useSelector((state: RootState) => state.user);

  const [currentPage, setCurrentPage] = useState(1);
  const [expandedPatientId, setExpandedPatientId] = useState<number | null>(null);
  const itemsPerPage = 9;

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const backLink = "/patients";
  useEffect(() => {
    dispatch(fetchArchivedPatients({ start: start || undefined, end: end || undefined }));
    setCurrentPage(1);
  }, [dispatch, start, end]);

  const totalPages = Math.ceil(archivedPatients.length / itemsPerPage);

  const paginatedPatients = useMemo(() => {
    return archivedPatients.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [archivedPatients, currentPage]);

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
        {/* header with back button + count */}
        <div>
              <Link
                to={backLink}
                className="inline-flex items-center hover:underline mb-4"
            >
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Link>
        </div>
        <div className="flex justify-between items-center mb-4">
          
          <div className="flex flex-col">
            <h2 className="text-2xl font-semibold text-red-600">
              Archived Patients
            </h2>
          </div>

          {!archivedLoading && (
            <span className="text-sm text-gray-700">
              Total archived: <b>{archivedPatients.length}</b>
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
        {archivedLoading && <BlueLoader />}
        {archivedError && <p className="text-red-500">{archivedError}</p>}
        {!archivedLoading && archivedPatients.length === 0 && (
          <p className="text-gray-500">
            {start || end
              ? "No archived patients in this date range."
              : "No archived patients found."}
          </p>
        )}

        {/* patient list */}
        <div className="grid grid-cols-1 gap-6">
          {paginatedPatients.map((patient) => (
            <div key={patient.id}>
              <PatientCard
                patient={patient}
                user={user}
                showArchivedInfo={true}
                onViewReport={(id) => {
                  setExpandedPatientId(id);
                  dispatch(fetchHistoricalTimelineReport({ patientId: id }));
                }}
              />

              {expandedPatientId === patient.id && (
                <div className="mt-4">
                  {reportLoading ? (
                    <p className="text-gray-600">Loading historical timeline...</p>
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

export default ArchivedPatients;
