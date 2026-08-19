// src/pages/ReportPage.tsx
import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FaPrint } from "react-icons/fa";

import DailyReport from "../components/DailyReport";
import PriorityReport from "../components/PriorityReport";
import TransitionalCareReport from "../components/TransitionalCareReport";
import HistoricalTimelineReport from "../components/HistoricalTimelineReport";
import ProjectedTimelineReport from "../components/ProjectedTimelineReport";

import { fetchAdmins } from "../redux/slices/userSlice";
import { fetchPatientsByAdmin, fetchPatients } from "../redux/slices/patientSlice";
import { loadHospitals } from "../redux/slices/hospitalSlice";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import type { RootState, AppDispatch } from "../redux/store";

import {
  fetchDailyReport, fetchPriorityReport,
  fetchTransitionalReport, fetchHistoricalTimelineReport,
  fetchProjectedTimelineReport,
} from "../redux/slices/reportSlice";

type ReportType = "daily" | "priority" | "transitional" | "historical" | "projected";

const ReportPage = () => {
  const dispatch = useDispatch<AppDispatch>();

  const { user, admins }    = useSelector((s: RootState) => s.user);
  const { hospitals }       = useSelector((s: RootState) => s.hospitals);
  const { patients }        = useSelector((s: RootState) => s.patients);
  const { transitionalReport, historicalReport, projectedTimelineReport } =
    useSelector((s: RootState) => s.reports);

  const today = new Date().toLocaleDateString("sv-SE");

  const [selectedReport,    setSelectedReport]    = useState<ReportType | "">("");
  const [selectedDate,      setSelectedDate]      = useState(today);
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [selectedAdminId,   setSelectedAdminId]   = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [startRange,        setStartRange]        = useState("");
  const [endRange,          setEndRange]          = useState(today);

  // FIX: role checks use role string
  const isSuperAdmin = user?.role === "super_admin";
  const isStaff      = user?.role === "staff";

  useEffect(() => {
    if (isSuperAdmin) dispatch(loadHospitals());
  }, [dispatch, isSuperAdmin]);

  useEffect(() => {
    if (!isStaff) dispatch(fetchAdmins({ hospitalId: selectedHospitalId || undefined }));
  }, [dispatch, selectedHospitalId, isStaff]);

  useEffect(() => {
    if (!isStaff && selectedAdminId !== "") {
      dispatch(fetchPatientsByAdmin(Number(selectedAdminId)));
    } else {
      dispatch(fetchPatients({ hospitalId: selectedHospitalId || undefined }));
    }
  }, [dispatch, selectedAdminId, selectedHospitalId, isStaff]);

  useEffect(() => { setSelectedAdminId(""); }, [selectedHospitalId]);
  useEffect(() => { setSelectedPatientId(null); }, [selectedAdminId, selectedHospitalId, selectedReport]);

  useEffect(() => {
    if (!selectedReport) return;
    if (["transitional","historical","projected"].includes(selectedReport) && !selectedPatientId) return;

    switch (selectedReport) {
      case "daily":
        dispatch(fetchDailyReport({
          date:       selectedDate,
          hospitalId: selectedHospitalId ? Number(selectedHospitalId) : undefined,
          adminId:    selectedAdminId    ? Number(selectedAdminId)    : undefined,
        }));
        break;
      case "priority":
        dispatch(fetchPriorityReport({
          date:       selectedDate,
          hospitalId: selectedHospitalId ? Number(selectedHospitalId) : undefined,
          adminId:    selectedAdminId    ? Number(selectedAdminId)    : undefined,
        }));
        break;
      case "transitional":
        dispatch(fetchTransitionalReport({
          patientId:  selectedPatientId!,
          start_date: startRange || undefined,
          end_date:   endRange   || undefined,
        }));
        break;
      case "historical":
        dispatch(fetchHistoricalTimelineReport({
          patientId:  selectedPatientId!,
          start_date: startRange || undefined,
          end_date:   endRange   || undefined,
        }));
        break;
      case "projected":
        dispatch(fetchProjectedTimelineReport(selectedPatientId!));
        break;
    }
  }, [selectedReport, selectedDate, selectedHospitalId, selectedAdminId,
      selectedPatientId, startRange, endRange, dispatch]);

   const handlePrint = () => {
    const content     = document.getElementById("report-content");
    const printWindow = window.open("", "_blank");
    if (!content || !printWindow) return;

    const titleMap: Record<ReportType, string> = {
      daily:        "Daily Report – Overdue Tasks",
      priority:     "Priority Report – Tasks Due Today",
      transitional: "Transitional Care Report",
      historical:   "Historical Timeline Report",
      projected:    "Projected Timeline Report",
    };

    printWindow.document.write(`
      <html>
        <head>
          <title>${titleMap[selectedReport as ReportType]} - ${selectedDate}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 1in; }
            #report-header h1 { font-size: 2.5rem; color: #003049; margin: 0; text-align: center; }
            .date { text-align: right; font-size: 0.9rem; color: #555; }
            .logo { height: 120px; width: auto; margin: 0 auto 1rem; display: block; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #003049; color: white; padding: 8px; text-align: left; }
            td { padding: 8px; border-bottom: 1px solid #ddd; }
            .no-print { display: none; }
            .only-print { display: block; }
            .print-task-box { display: inline-block; vertical-align: top; break-inside: avoid; page-break-inside: avoid; background-color: #f9f9f9; min-width: 180px; max-width: 200px; font-size: 14px; font-weight: bold; }
            .print-Pending, .print-In-Progress { background-color: #3b82f6 !important; }
            .print-Completed, .print-Delayed-Completed { background-color: #16a34a !important; }
            .print-Missed { background-color: #ef4444 !important; }
            .italic { font-style: italic; color: #b91c1c; }

            /* FIX: approval request card styling — Tailwind classes don't
               carry over into this standalone print document, so these are
               written out explicitly to match bg-purple-50/border-purple-200 etc. */
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            .bg-purple-50  { background-color: #faf5ff !important; }
            .border-purple-200 { border-color: #e9d5ff !important; }
            .text-purple-500 { color: #a855f7 !important; }
            .text-purple-700 { color: #7e22ce !important; }
            .text-purple-800 { color: #6b21a8 !important; }
            .text-purple-900 { color: #581c87 !important; }
            .rounded { border-radius: 0.25rem; }
            .border { border-width: 1px; border-style: solid; }
            .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
            .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
            .py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
            .mt-1 { margin-top: 0.25rem; }
            .mt-2 { margin-top: 0.5rem; }
            .mb-2 { margin-bottom: 0.5rem; }
            .space-y-2 > * + * { margin-top: 0.5rem; }
            .font-semibold { font-weight: 600; }
            .font-medium   { font-weight: 500; }
            .italic { font-style: italic; }
            .text-xs { font-size: 0.75rem; }
            .text-sm { font-size: 0.875rem; }
            .ml-1 { margin-left: 0.25rem; }
            .px-1\\.5 { padding-left: 0.375rem; padding-right: 0.375rem; }
            .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
            .rounded-full { border-radius: 9999px; }
            .bg-yellow-100 { background-color: #fef9c3 !important; }
            .text-yellow-700 { color: #a16207 !important; }
            .bg-green-100  { background-color: #dcfce7 !important; }
            .text-green-700 { color: #15803d !important; }
            .bg-red-100    { background-color: #fee2e2 !important; }
            .text-red-700  { color: #b91c1c !important; }
            .bg-gray-100   { background-color: #f3f4f6 !important; }
            .text-gray-700 { color: #374151 !important; }
          </style>
        </head>
        <body>
          <div id="report-header" class="only-print">
            <img src="/logo.png" alt="Pace The Case Logo" class="logo" />
            <h1>${titleMap[selectedReport as ReportType]}</h1>
            <div class="date">${selectedDate}</div>
          </div>
          <div id="report-content">${content.innerHTML}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  const needsPatient = ["transitional","historical","projected"].includes(selectedReport);

  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral text-hospital-blue">
      <Navbar />

      <div className="container mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">Reports</h1>
          {selectedReport && (
            <button
              onClick={handlePrint}
              className="btn btn-secondary"
              disabled={needsPatient && !selectedPatientId}
            >
              <FaPrint className="inline mr-2" /> Print Report
            </button>
          )}
        </div>

        {/* Filter panel */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-6 items-end">

            <div>
              <label className="text-xs block">Report</label>
              <select value={selectedReport}
                onChange={e => setSelectedReport(e.target.value as ReportType)}
                className="border px-2 py-1 rounded-md">
                <option value="">Select</option>
                <option value="daily">Daily</option>
                <option value="priority">Priority</option>
                <option value="transitional">Transitional</option>
                <option value="historical">Historical</option>
                <option value="projected">Projected</option>
              </select>
            </div>

            {(selectedReport === "daily" || selectedReport === "priority") && (
              <div>
                <label className="text-xs block">Date</label>
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
              </div>
            )}

            {/* FIX: role check */}
            {isSuperAdmin && (
              <div>
                <label className="text-xs block">Hospital</label>
                <select value={selectedHospitalId} onChange={e => setSelectedHospitalId(e.target.value)}>
                  <option value="">All Hospitals</option>
                  {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
            )}

            {/* FIX: role check */}
            {!isStaff && (
              <div>
                <label className="text-xs block">Leader</label>
                <select value={selectedAdminId} onChange={e => setSelectedAdminId(e.target.value)}>
                  <option value="">All Leaders</option>
                  {admins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}

            {needsPatient && (
              <div>
                <label className="text-xs block">Patient</label>
                <select value={selectedPatientId || ""}
                  onChange={e => setSelectedPatientId(Number(e.target.value))}>
                  <option value="">Select Patient</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>
                  ))}
                </select>
              </div>
            )}

            {["transitional","historical"].includes(selectedReport) && (
              <>
                <div>
                  <label className="text-xs block">From</label>
                  <input type="date" value={startRange} onChange={e => setStartRange(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs block">To</label>
                  <input type="date" value={endRange} onChange={e => setEndRange(e.target.value)} />
                </div>
              </>
            )}

          </div>
        </div>

        {/* Report content */}
        <div id="report-content" className="bg-white rounded-xl shadow p-6">
          {!selectedReport && <p className="italic text-gray-400">Select a report to view</p>}
          {selectedReport === "daily"        && <DailyReport />}
          {selectedReport === "priority"     && <PriorityReport />}
          {selectedReport === "transitional" && selectedPatientId && <TransitionalCareReport report={transitionalReport} />}
          {selectedReport === "historical"   && selectedPatientId && <HistoricalTimelineReport report={historicalReport} />}
          {selectedReport === "projected"    && selectedPatientId && <ProjectedTimelineReport data={projectedTimelineReport} />}
        </div>

      </div>
      <Footer />
    </div>
  );
};

export default ReportPage;