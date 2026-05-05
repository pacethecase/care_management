// src/pages/DischargedPatients.tsx
import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchDischargedPatients, searchPatients } from "../redux/slices/patientSlice";
import { fetchHistoricalTimelineReport } from "../redux/slices/reportSlice";
import { RootState, AppDispatch } from "../redux/store";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BlueLoader from "../components/BlueLoader";
import PatientCard from "../components/PatientCard";
import HistoricalTimelineReport from "../components/HistoricalTimelineReport";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const DischargedPatients = () => {
  const dispatch = useDispatch<AppDispatch>();

  const { dischargedPatients, dischargedCount, searchResults, loading, error } =
    useSelector((s: RootState) => s.patients);
  const { historicalReport, loading: reportLoading } =
    useSelector((s: RootState) => s.reports);
  const { user } = useSelector((s: RootState) => s.user);

  const [expandedPatientId, setExpandedPatientId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [start, setStart]             = useState("");
  const [end, setEnd]                 = useState("");
  const [searchTerm, setSearchTerm]   = useState("");
  const itemsPerPage = 9;

  useEffect(() => {
    dispatch(fetchDischargedPatients({ start: start || undefined, end: end || undefined }));
    setCurrentPage(1);
  }, [dispatch, start, end]);

  useEffect(() => {
    const delay = setTimeout(() => {
      const trimmed = searchTerm.trim();
      if (trimmed) {
        dispatch(searchPatients({ query: trimmed, status: "discharged", start: start || undefined, end: end || undefined }));
      } else {
        dispatch(fetchDischargedPatients({ start: start || undefined, end: end || undefined }));
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [searchTerm, dispatch, start, end]);

  const dataToDisplay = searchTerm.trim() ? searchResults : dischargedPatients;
  const totalPages    = Math.ceil(dataToDisplay.length / itemsPerPage);

  const paginated = useMemo(() =>
    dataToDisplay.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [dataToDisplay, currentPage]
  );

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-light)] text-[var(--text-dark)]">
      <Navbar />

      <div className="p-6">
        <Link to="/patients" className="inline-flex items-center hover:underline mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Link>

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-red-600">Discharged Patients</h2>
            {!loading && (
              <span className="text-sm text-gray-700">
                Total in range: <b>{dischargedCount}</b>
              </span>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Date</label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)}
                className="input input-bordered input-sm rounded-md border-gray-300" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End Date</label>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)}
                className="input input-bordered input-sm rounded-md border-gray-300" />
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <input
              type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name or MRN..."
              className="w-full pl-4 pr-4 py-2 rounded-full border border-gray-300 focus:ring-2 focus:ring-blue-400 focus:outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        {loading && <BlueLoader />}
        {error && <p className="text-red-500">{error}</p>}
        {!loading && dataToDisplay.length === 0 && (
          <p className="text-gray-500">
            {start || end ? "No discharged patients in this date range." : "No discharged patients found."}
          </p>
        )}

        <div className="grid grid-cols-1 gap-6">
          {paginated.map(patient => (
            <div key={patient.id}>
              <PatientCard
                patient={patient}
                user={user}
                showDischargeInfo
                onViewReport={id => {
                  setExpandedPatientId(id);
                  dispatch(fetchHistoricalTimelineReport({ patientId: id }));
                }}
              />
              {expandedPatientId === patient.id && (
                <div className="mt-4">
                  {reportLoading
                    ? <BlueLoader />
                    : historicalReport && <HistoricalTimelineReport report={historicalReport} />}
                </div>
              )}
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8">
            <button onClick={() => { setExpandedPatientId(null); setCurrentPage(p => p - 1); }}
              disabled={currentPage === 1} className="btn btn-outline disabled:opacity-50">Previous</button>
            <span className="text-sm text-gray-700">Page {currentPage} of {totalPages}</span>
            <button onClick={() => { setExpandedPatientId(null); setCurrentPage(p => p + 1); }}
              disabled={currentPage === totalPages} className="btn btn-outline disabled:opacity-50">Next</button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default DischargedPatients;