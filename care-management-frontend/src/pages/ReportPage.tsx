import  { useState, useEffect,useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FaPrint } from "react-icons/fa";
import DailyReport from "../components/DailyReport";
import PriorityReport from "../components/PriorityReport";
import TransitionalCareReport from "../components/TransitionalCareReport";
import HistoricalTimelineReport from "../components/HistoricalTimelineReport";
import ProjectedTimelineReport from "../components/ProjectedTimelineReport";
import { fetchAdmins } from "../redux/slices/userSlice";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import logo from "../assets/logo.png";
import { RootState } from "../redux/store";
import {
  fetchDailyReport,
  fetchPriorityReport,
  fetchTransitionalReport,
  fetchHistoricalTimelineReport,
  fetchProjectedTimelineReport,
} from "../redux/slices/reportSlice";
import { fetchPatients } from "../redux/slices/patientSlice";
import type { AppDispatch } from "../redux/store";


type ReportType = "daily" | "priority" | "transitional" | "historical" | "projected";

const ReportPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { patients } = useSelector((state: RootState) => state.patients);
  const { transitionalReport, historicalReport, projectedTimelineReport } = useSelector(
    (state: RootState) => state.reports
  );

  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const { admins, user } = useSelector((state: RootState) => state.user);
const [selectedAdminId, setSelectedAdminId] = useState<number | ''>('');

  const getLocalDateString = () =>
    new Date().toLocaleDateString("sv-SE"); 
  
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  const [startRange, setStartRange] = useState<string>("");
  const [endRange, setEndRange] = useState<string>(getLocalDateString());
  useEffect(() => {
    dispatch(fetchPatients());
  }, [dispatch]);

  useEffect(() => {
  if (user?.is_admin) {
    dispatch(fetchAdmins());
  }
}, [dispatch, user?.is_admin]);


  useEffect(() => {
    if (
      (selectedReport === "transitional" ||
        selectedReport === "historical" ||
        selectedReport === "projected") &&
      !selectedPatientId
    )
      return;

    switch (selectedReport) {
      case "daily":
      dispatch(fetchDailyReport({ date: selectedDate, adminId: selectedAdminId || undefined }));
        break;
      case "priority":
        dispatch(fetchPriorityReport({ date: selectedDate, adminId: selectedAdminId || undefined} ));
        break;
      case "transitional":
        if (selectedPatientId)  dispatch(
  fetchTransitionalReport({
    patientId: selectedPatientId!,
    start_date: startRange || undefined,
    end_date: endRange || undefined,
  })
);

        break;
      case "historical":
        if (selectedPatientId)  dispatch(
  fetchHistoricalTimelineReport({
    patientId: selectedPatientId!,
    start_date: startRange || undefined,
    end_date: endRange || undefined,
  })
);

        break;
      case "projected":
        if (selectedPatientId) dispatch(fetchProjectedTimelineReport(selectedPatientId));
        break;
    }
  }, [selectedReport, selectedDate, selectedPatientId,selectedAdminId,  startRange, endRange, dispatch]);

  useEffect(() => {
    if (
      selectedReport === "transitional" ||
      selectedReport === "historical" ||
      selectedReport === "projected"
    ) {
      setSelectedPatientId(null);
    }
  }, [selectedReport]);

  useEffect(() => {
  setSelectedAdminId(''); 
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
              <img src="${logo}" alt="Pace The Case Logo" class="logo"/>
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
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="container p-6 mx-auto">
        <h1 className="text-3xl font-bold mb-6">Reports</h1>

    {selectedReport && ["daily", "priority"].includes(selectedReport) && (
  <div className="mb-4">
    <label className="text-lg">Select Date:</label>
    <input
      type="date"
      value={selectedDate}
      onChange={(e) => setSelectedDate(e.target.value)}
      className="border rounded p-2 ml-4"
    />
  </div>
)}


       {selectedReport && ["transitional", "historical"].includes(selectedReport) && (
  <div className="mb-4 space-x-4">
    <label>From:</label>
    <input
      type="date"
      value={startRange}
      onChange={(e) => setStartRange(e.target.value)}
      className="border p-2"
    />
    <label>To:</label>
    <input
      type="date"
      value={endRange}
      onChange={(e) => setEndRange(e.target.value)}
      className="border p-2"
    />
  </div>
)}


     <div className="space-x-4 mb-4 no-print">
  {(["daily", "priority", "transitional", "historical", "projected"] as ReportType[]).map((type) => {
        const reportLabels = useMemo(() => ({
        daily: "Daily Report – Overdue Tasks",
        priority: "Priority Report – Tasks Due Today",
        transitional: "Transitional Care Report",
        historical: "Historical Timeline Report",
        projected: "Projected Timeline Report",
      }), []);


    return (
      <button
        key={type}
        className={`btn ${selectedReport === type ? "btn-primary" : "btn-outline"}`}
        onClick={() => setSelectedReport(type)}
      >
        {reportLabels[type]}
      </button>
    );
  })}
</div>

  {(selectedReport === "daily"  ||
      selectedReport === "priority") &&  (
              <div className="mb-4">
                <label htmlFor="adminFilter" className="font-semibold">
                  Filter by Leader:
                </label>
                <select
                  id="adminFilter"
                  className="border rounded p-2"
                  value={selectedAdminId}
                  onChange={(e) =>
                    setSelectedAdminId(e.target.value ? Number(e.target.value) : '')
                  }
                >
                  <option value="">All Leaders</option>
                  {admins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

        {(selectedReport === "transitional" ||
          selectedReport === "historical" ||
          selectedReport === "projected") && (
          <div className="mb-4">
          <label className="text-lg mr-2">Select Patient:</label>
            <select
              value={selectedPatientId ?? ""}
              onChange={(e) => setSelectedPatientId(Number(e.target.value))}
              className="border rounded p-2"
            >
              <option value="">-- Select Patient --</option>
              {patients
                .slice() 
                .sort((a, b) => a.last_name.localeCompare(b.last_name))
                .map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.last_name}, {patient.first_name} – MRN {patient.mrn || "N/A"}
                  </option>
                ))}
            </select>

          </div>
        )}

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


        <div id="report-content" className="bg-white rounded-lg shadow p-6 min-h-[150px]">
          {!selectedReport && <p className="text-gray-500">Select a report to view.</p>}
          {selectedReport === "daily" && <DailyReport date={selectedDate} />}
          {selectedReport === "priority" && <PriorityReport date={selectedDate} />}
          {selectedReport === "transitional" &&
            selectedPatientId &&
            transitionalReport && <TransitionalCareReport report={transitionalReport} />}
          {selectedReport === "historical" &&
            selectedPatientId &&
            historicalReport && <HistoricalTimelineReport report={historicalReport} />}
          {selectedReport === "projected" &&
            selectedPatientId &&
            projectedTimelineReport && <ProjectedTimelineReport data={projectedTimelineReport} />}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ReportPage;
