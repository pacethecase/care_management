import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FaPrint } from "react-icons/fa";

import DailyReport from "../components/DailyReport";
import PriorityReport from "../components/PriorityReport";
import TransitionalCareReport from "../components/TransitionalCareReport";
import HistoricalTimelineReport from "../components/HistoricalTimelineReport";
import ProjectedTimelineReport from "../components/ProjectedTimelineReport";

import { fetchAdmins } from "../redux/slices/userSlice";
import { fetchPatientsByAdmin } from "../redux/slices/patientSlice";
import { fetchPatients } from "../redux/slices/patientSlice";
import { loadHospitals } from "../redux/slices/hospitalSlice";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import type { RootState, AppDispatch } from "../redux/store";

import {
  fetchDailyReport,
  fetchPriorityReport,
  fetchTransitionalReport,
  fetchHistoricalTimelineReport,
  fetchProjectedTimelineReport,
} from "../redux/slices/reportSlice";

type ReportType = "daily" | "priority" | "transitional" | "historical" | "projected";

const ReportPage = () => {
  const dispatch = useDispatch<AppDispatch>();

  const { user, admins } = useSelector((state: RootState) => state.user);
  const { hospitals } = useSelector((state: RootState) => state.hospitals);
  const { patients } = useSelector((state: RootState) => state.patients);

  const { transitionalReport, historicalReport, projectedTimelineReport } =
    useSelector((state: RootState) => state.reports);

  const today = new Date().toLocaleDateString("sv-SE");

  const [selectedReport, setSelectedReport] = useState<ReportType | "">("");
  const [selectedDate, setSelectedDate] = useState(today);

  const [selectedHospitalId, setSelectedHospitalId] = useState<string>("");
  const [selectedAdminId, setSelectedAdminId] = useState<string>("");
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  const [startRange, setStartRange] = useState("");
  const [endRange, setEndRange] = useState(today);

  // Load Hospitals only for super admin
  useEffect(() => {
    if (user?.is_super_admin) {
      dispatch(loadHospitals());
    }
  }, [dispatch, user?.is_super_admin]);

  // Load admins (same as Patients page)
  useEffect(() => {
    if (!user?.is_staff) {
      dispatch(fetchAdmins({ hospitalId: selectedHospitalId || undefined }));
    }
  }, [dispatch, selectedHospitalId, user?.is_staff]);

  // Load patients EXACT SAME logic as Patients.tsx
  useEffect(() => {
    if (!user?.is_staff && selectedAdminId !== "") {
      dispatch(fetchPatientsByAdmin(Number(selectedAdminId)));
    } else {
      dispatch(fetchPatients({ hospitalId: selectedHospitalId || undefined }));
    }
  }, [dispatch, selectedAdminId, selectedHospitalId, user?.is_staff]);

  // Reset dependent selections
  useEffect(() => setSelectedAdminId(""), [selectedHospitalId]);
  useEffect(() => setSelectedPatientId(null), [selectedAdminId, selectedHospitalId, selectedReport]);

  // Fetch reports
  useEffect(() => {
    if (!selectedReport) return;

    if (
      ["transitional", "historical", "projected"].includes(selectedReport) &&
      !selectedPatientId
    ) return;

    switch (selectedReport) {
      case "daily":
        dispatch(
          fetchDailyReport({
            date: selectedDate,
            hospitalId: selectedHospitalId? Number(selectedHospitalId) : undefined,
            adminId: selectedAdminId ? Number(selectedAdminId) : undefined,
          })
        );
        break;

      case "priority":
        dispatch(
          fetchPriorityReport({
            date: selectedDate,
            hospitalId: selectedHospitalId? Number(selectedHospitalId) : undefined,
            adminId: selectedAdminId ? Number(selectedAdminId) : undefined,
          })
        );
        break;

      case "transitional":
        dispatch(fetchTransitionalReport({
          patientId: selectedPatientId!,
          start_date: startRange || undefined,
          end_date: endRange || undefined,
        }));
        break;

      case "historical":
        dispatch(fetchHistoricalTimelineReport({
          patientId: selectedPatientId!,
          start_date: startRange || undefined,
          end_date: endRange || undefined,
        }));
        break;

      case "projected":
        dispatch(fetchProjectedTimelineReport(selectedPatientId!));
        break;
    }

  }, [
    selectedReport,
    selectedDate,
    selectedHospitalId,
    selectedAdminId,
    selectedPatientId,
    startRange,
    endRange,
    dispatch
  ]);

 useEffect(() => {
    if (
      selectedReport === "transitional" ||
      selectedReport === "historical" ||
      selectedReport === "projected"
    ) {
      setSelectedPatientId(null);
    }
  }, [selectedReport]);

  const handlePrint = () => {
    const content = document.getElementById("report-content");
    const printWindow = window.open("", "_blank");

    if (content && printWindow) {
      const reportTitleMap: Record<ReportType, string> = {
         daily: "Daily Report – Overdue Tasks",
        priority: "Priority Report – Tasks Due Today",
        transitional: "Transitional Care Report",
        historical: "Historical Timeline Report",
        projected: "Projected Timeline Report",
      };

      const reportTitle = reportTitleMap[selectedReport || "daily"];

      const printStyles = `
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 1in;
          }
          #report-header h1 {
            font-size: 2.5rem;
            color: #003049;
            margin: 0;
            text-align: center;
          }
          .date {
            text-align: right;
            font-size: 0.9rem;
            color: #555;
          }
          .logo {
            height: 120px;
            width: auto;
            margin: 0 auto 1rem;
            display: block;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th {
            background-color: #003049;
            color: white;
            padding: 8px;
            text-align: left;
          }
          td {
            padding: 8px;
            border-bottom: 1px solid #ddd;
          }
          .no-print { display: none; }
          .only-print { display: block; }
          .workflow-section { margin-top: 2rem; }
          .timeline-container {
            display: flex;
            flex-wrap: wrap;
            align-items: flex-start;
            gap: 8px;
            margin-top: 1rem;
            background-color: #fefefe;
            }

          .meta {
            font-size: 11px;
            margin-top: 2px;
          }
         
          
   

          .print-task-box {
          display: inline-block;
          vertical-align: top;
          break-inside: avoid;
          page-break-inside: avoid;
          background-color: #f9f9f9;   
          min-width: 180px;
          max-width: 200px;
          font-size: 14px;
          font-weight: bold;
    
        
        }



          .print-arrow {
            font-size: 18px;
            margin: 0 5px;
          }

          .print-final-step {
            background-color: #ede9fe;
            color: #5b21b6;
            padding: 6px 12px;
            border-radius: 6px;
            font-weight: bold;
          }
              .print-admitted {
              background-color: #ebe6e7;
              color:#000;
              padding: 6px 12px;
              border-radius: 6px;
              font-weight: bold;
              }
              .print-Pending,
                .print-In-Progress {
                  background-color: #3b82f6  !important;
                }

                .print-Completed,
                .print-Delayed-Completed {
                  background-color: #16a34a  !important;
                }

          .print-Missed {
            background-color: #ef4444  !important;
            }
          .italic { font-style: italic; color: #b91c1c; }
        </style>
      `;

      printWindow.document.write(`
        <html>
          <head>
            <title>${reportTitle} - ${selectedDate}</title>
            ${printStyles}
          </head>
          <body>
            <div id="report-header" class="only-print">
              <img src="/logo.png" alt="Pace The Case Logo" class="logo" />

              <h1>${reportTitle}</h1>
              <div class="date">${selectedDate}</div>
            </div>
            <div id="report-content">
              ${content.innerHTML}
            </div>
          </body>
        </html>
      `);

      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral text-hospital-blue">
      <Navbar />

      <div className="container mx-auto px-4 py-6">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">Reports</h1>
{selectedReport && (
        <div className="mb-6">
          <button
            onClick={handlePrint}
            className="btn btn-secondary"
            disabled={
              (["transitional", "historical", "projected"].includes(selectedReport) && !selectedPatientId)
            }
          >
            <FaPrint className="inline mr-2" />
            Print Report
          </button>
        </div>
        )}
        </div>

        {/* FILTER PANEL */}
        <div className="bg-white rounded-xl shadow-sm  p-4 mb-6">
          <div className="flex flex-wrap gap-6 items-end">

            {/* REPORT */}
            <div>
              <label className="text-xs block">Report</label>
              <select
                value={selectedReport}
                onChange={e => setSelectedReport(e.target.value as ReportType)}
                className="border px-2 py-1 rounded-md"
              >
                <option value="">Select</option>
                <option value="daily">Daily</option>
                <option value="priority">Priority</option>
                <option value="transitional">Transitional</option>
                <option value="historical">Historical</option>
                <option value="projected">Projected</option>
              </select>
            </div>

            {/* DATE */}
            {(selectedReport === "daily" || selectedReport === "priority") && (
              <div>
                <label className="text-xs block">Date</label>
                <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} />
              </div>
            )}

            {/* HOSPITAL */}
            {user?.is_super_admin && (
              <div>
                <label className="text-xs block">Hospital</label>
                <select value={selectedHospitalId} onChange={e=>setSelectedHospitalId(e.target.value)}>
                  <option value="">All Hospitals</option>
                  {hospitals.map(h=>(
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* LEADER */}
            {!user?.is_staff && (
              <div>
                <label className="text-xs block">Leader</label>
                <select value={selectedAdminId} onChange={e=>setSelectedAdminId(e.target.value)}>
                  <option value="">All Leaders</option>
                  {admins.map(a=>(
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* PATIENT */}
            {["transitional","historical","projected"].includes(selectedReport) && (
              <div>
                <label className="text-xs block">Patient</label>
                <select
                  value={selectedPatientId || ""}
                  onChange={e=>setSelectedPatientId(Number(e.target.value))}
                >
                  <option value="">Select Patient</option>
                  {patients.map(p=>(
                    <option key={p.id} value={p.id}>
                      {p.last_name}, {p.first_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* RANGE */}
            {["transitional","historical"].includes(selectedReport) && (
              <>
                <input type="date" value={startRange} onChange={e=>setStartRange(e.target.value)} />
                <input type="date" value={endRange} onChange={e=>setEndRange(e.target.value)} />
              </>
            )}

          </div>
        </div>

        {/* CONTENT */}
        <div id="report-content" className="bg-white rounded-xl shadow p-6">
          {!selectedReport && <p className="italic text-gray-400">Select report</p>}

          {selectedReport === "daily" && <DailyReport date={selectedDate} adminId={Number(selectedAdminId) || undefined} />}
          {selectedReport === "priority" && <PriorityReport date={selectedDate} adminId={Number(selectedAdminId) || undefined} />}

          {selectedReport === "transitional" && selectedPatientId && <TransitionalCareReport report={transitionalReport} />}
          {selectedReport === "historical" && selectedPatientId && <HistoricalTimelineReport report={historicalReport} />}
          {selectedReport === "projected" && selectedPatientId && <ProjectedTimelineReport data={projectedTimelineReport} />}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ReportPage;
