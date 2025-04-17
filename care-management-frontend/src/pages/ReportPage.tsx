import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FaPrint } from "react-icons/fa";
import DailyReport from "../components/DailyReport";
import PriorityReport from "../components/PriorityReport";
import TransitionCareReport from "../components/TransitionCareReport";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import logo from "../assets/logo.png";
import { RootState } from "../redux/store";
import { fetchPatients } from "../redux/slices/patientSlice";
import {
  fetchDailyReport,
  fetchPriorityReport,
  fetchTransitionReport,
} from "../redux/slices/reportSlice";

const ReportPage = () => {
  const dispatch = useDispatch();
  const { patients } = useSelector((state: RootState) => state.patients);
  const { transitionReport } = useSelector((state: RootState) => state.reports);

  const [selectedReport, setSelectedReport] = useState<"daily" | "priority" | "transition" | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  useEffect(() => {
    dispatch(fetchPatients() as any);
  }, [dispatch]);

  useEffect(() => {
    if (selectedReport === "daily") {
      dispatch(fetchDailyReport(selectedDate) as any);
    } else if (selectedReport === "priority") {
      dispatch(fetchPriorityReport(selectedDate) as any);
    } else if (selectedReport === "transition" && selectedPatientId) {
      dispatch(fetchTransitionReport(selectedPatientId) as any);
    }
  }, [selectedReport, selectedDate, selectedPatientId, dispatch]);

  const handlePrint = () => {
    const content = document.getElementById("report-content");
    const printWindow = window.open("", "_blank");

    if (content && printWindow) {
      const reportTitle =
        selectedReport === "daily"
          ? "DAILY REPORT"
          : selectedReport === "priority"
          ? "PRIORITY REPORT"
          : selectedReport === "transition"
          ? "TRANSITIONAL CARE REPORT"
          :"REPORT";
          

      const printStyles = `
        <style>
          @media print {
            body {
              font-family: Arial, sans-serif;
              margin: 1in;
            }
            #report-header h1 {
              font-size: 2.5rem;
              color: #FF7F00;
              margin: 0;
              text-align: center;
            }
            .date {
              text-align: right;
              font-size: 0.9rem;
              color: #555;
            }
            .logo {
              height: 20%;
              width: auto;
              margin: 0 auto;
              display: block;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th {
              background-color: #FF7F00;
              color: white;
              padding: 8px;
              text-align: left;
            }
            td {
              padding: 8px;
              border-bottom: 1px solid #ddd;
            }
            .no-print {
              display: none;
            }
            .only-print {
              display: block;
            }
          }
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
    <div className="flex flex-col min-h-screen bg-hospital-neutral text-hospital-blue">
      <Navbar />
      <div className="container p-6 mx-auto">
        <h1 className="text-3xl font-bold mb-6">Reports</h1>

        {/* Date Picker */}
        <div className="mb-4">
          <label className="text-lg">Select Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border rounded p-2 ml-4"
          />
        </div>

        {/* Report Type Selection */}
        <div className="space-x-4 mb-4 no-print">
          <button
            className={`btn ${selectedReport === "daily" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setSelectedReport("daily")}
          >
            Daily Report
          </button>
          <button
            className={`btn ${selectedReport === "priority" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setSelectedReport("priority")}
          >
            Priority Report
          </button>
          <button
            className={`btn ${selectedReport === "transition" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setSelectedReport("transition")}
          >
            Transitional Care Report
          </button>
        </div>

        {/* Patient Selector for Transitional Care */}
        {selectedReport === "transition" && (
          <div className="mb-4">
            <label className="text-lg mr-2">Select Patient:</label>
            <select
              value={selectedPatientId ?? ""}
              onChange={(e) => setSelectedPatientId(Number(e.target.value))}
              className="border rounded p-2"
            >
              <option value="">-- Select Patient --</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name} – MRN {patient.mrn || "N/A"}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Print Button */}
        {selectedReport && (
          <div className="mb-6">
            <button onClick={handlePrint} className="btn btn-secondary">
              <FaPrint className="inline mr-2" />
              Print Report
            </button>
          </div>
        )}

        {/* Report Display */}
        <div id="report-content" className="bg-white rounded-lg shadow p-6 min-h-[150px]">
          {!selectedReport && <p className="text-gray-500">Select a report to view.</p>}

          {selectedReport === "daily" && <DailyReport date={selectedDate} />}
          {selectedReport === "priority" && <PriorityReport date={selectedDate} />}
          {selectedReport === "transition" && transitionReport && (
  <TransitionCareReport report={transitionReport} />
)}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ReportPage;
