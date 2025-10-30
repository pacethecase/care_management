import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { fetchArchivedPatients, searchPatients } from "../redux/slices/patientSlice";
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
  const {
    archivedPatients,
    archivedLoading,
    archivedError,
    searchResults,
  } = useSelector((state: RootState) => state.patients);

  const { historicalReport, loading: reportLoading } = useSelector(
    (state: RootState) => state.reports
  );

  const { user } = useSelector((state: RootState) => state.user);

  const [currentPage, setCurrentPage] = useState(1);
  const [expandedPatientId, setExpandedPatientId] = useState<number | null>(null);
  const itemsPerPage = 9;

  const [searchTerm, setSearchTerm] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const backLink = "/patients";

  // 🧭 Fetch archived patients by date range
  useEffect(() => {
    dispatch(fetchArchivedPatients({ start: start || undefined, end: end || undefined }));
    setCurrentPage(1);
  }, [dispatch, start, end]);

  useEffect(() => {
    const delay = setTimeout(() => {
      const trimmed = searchTerm.trim();
      if (trimmed.length > 0) {
        dispatch(
          searchPatients({
            query: trimmed,
            status: "archived",
            start: start || undefined,
            end: end || undefined,
          })
        );
      } else {
        dispatch(fetchArchivedPatients({ start: start || undefined, end: end || undefined }));
      }
    }, 300);

    return () => clearTimeout(delay);
  }, [searchTerm, dispatch, start, end]);

  // 🔢 Pagination
  const dataToDisplay = searchTerm.trim() ? searchResults : archivedPatients;
  const totalPages = Math.ceil(dataToDisplay.length / itemsPerPage);

  const paginatedPatients = useMemo(() => {
    return dataToDisplay.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [dataToDisplay, currentPage]);

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
        {/* 🔙 Back Button */}
        <div>
          <Link
            to={backLink}
            className="inline-flex items-center hover:underline mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Link>
        </div>

        {/* 🧾 Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-red-600">
              Archived Patients
            </h2>
            {!archivedLoading && (
              <span className="text-sm text-gray-700">
                Total in range: <b>{archivedPatients.length}</b>
              </span>
            )}
          </div>
        </div>

        {/* 📅 Date Filters + Search */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Date</label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="input input-bordered input-sm rounded-md border-gray-300 focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End Date</label>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="input input-bordered input-sm rounded-md border-gray-300 focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* 🔍 Search Bar (aligned to right) */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or MRN..."
              className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-300 focus:ring-2 focus:ring-blue-400 focus:outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        {/* 📄 Messages */}
        {archivedLoading && <BlueLoader />}
        {archivedError && <p className="text-red-500">{archivedError}</p>}
        {!archivedLoading && dataToDisplay.length === 0 && (
          <p className="text-gray-500">
            {start || end
              ? "No archived patients in this date range."
              : "No archived patients found."}
          </p>
        )}

        {/* 🩺 Patient List */}
        <div className="grid grid-cols-1 gap-6">
          {paginatedPatients.map((patient) => (
            <div key={patient.id}>
              <PatientCard
                patient={patient}
                user={user}
                showArchivedInfo={true}
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

        {/* 📑 Pagination */}
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
