import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchLengthOfStayReport } from "../redux/slices/reportSlice";
import type { RootState, AppDispatch } from "../redux/store";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Link } from "react-router-dom";
import LOSDashboardChart from "../components/LOSDashboardChart";
import { FaPrint } from "react-icons/fa";

import BlueLoader from "../components/BlueLoader";
const LengthOfStayReport = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, error } = useSelector((state: RootState) => state.reports.los);

  const [includeDischarged, setIncludeDischarged] = useState(false);
  const [startDate, setStartDate] = useState("");
const [endDate, setEndDate] = useState("");
const [algorithm, setAlgorithm] = useState("");

  const handlePrint = () => {
    const content = document.getElementById("los-content");
    const printWindow = window.open("", "_blank");

    if (content && printWindow) {
      // Get CSS variables
      const rootStyles = getComputedStyle(document.documentElement);
      const cssVariables = `
        :root {
          --algo-behavioral: ${rootStyles.getPropertyValue("--algo-behavioral").trim()};
          --algo-guardianship: ${rootStyles.getPropertyValue("--algo-guardianship").trim()};
          --algo-ltc: ${rootStyles.getPropertyValue("--algo-ltc").trim()};
        }
      `;

      const printStyles = `
        <style>
          ${cssVariables}
          body { font-family: Arial, sans-serif; margin: 1in; }
          h1 { text-align: center; color: #003049; }
          .logo { height: 100px; display: block; margin: 0 auto 1rem; }
          .border { border: 1px solid #ddd; border-radius: 8px; }
          .shadow { box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
          .bg-white { background: white; }
          .mb-2 { margin-bottom: 0.5rem; }
          .text-xl { font-size: 1.25rem; }
          .font-bold { font-weight: bold; }
          .recharts-rectangle { shape-rendering: crispEdges; }

          #los-print {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          #los-print .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            width: 100%;
            max-width: 900px;
          }
          .chart-container {
            display: flex;
            justify-content: center;
            width: 100%;
            margin-top: 20px;
          }
          .chart-container > div {
            width: 80%;
          }
          .page-break { page-break-before: always; }
        </style>
      `;

      // Extract boxes and charts
      const boxesHTML = content.querySelector(".grid")?.outerHTML || "";
      const charts = Array.from(
        content.querySelectorAll(".p-4.bg-white.rounded-xl.shadow-md")
      )
        .map(
          (chart) =>
            `<div class="page-break"></div>
             <div class="chart-container">${chart.outerHTML}</div>`
        )
        .join("");

      // Final HTML
      const printHTML = `
        <div id="los-print">
          ${boxesHTML}
          ${charts}
        </div>
      `;

      printWindow.document.write(`
        <html>
          <head>
            <title>Length of Stay Report</title>
            ${printStyles}
          </head>
          <body>
             <img src="/logo.png" alt="Logo" class="logo"/>
            <h1>Length of Stay Dashboard</h1>
            <div style="text-align:right; font-size: 0.9rem; color: #555;">
              ${new Date().toLocaleDateString()}
            </div>
            ${printHTML}
          </body>
        </html>
      `);

      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
    }
  };
  useEffect(() => {
    dispatch(fetchLengthOfStayReport({ 
      includeDischarged ,  
      startDate: startDate || undefined, 
      endDate: endDate || undefined, 
      algorithm: algorithm || undefined }));
  }, [dispatch, includeDischarged, startDate, endDate, algorithm]);

  const renderCard = (label: string, values: any) => (
    <div className="border rounded p-4 shadow bg-white">
      <h3 className="font-bold text-xl mb-2">{label}</h3>
      <p>Total Patients: {values.count}</p>
      <p>Total Days: {values.totalDays}</p>
      <p>Average LOS: {values.avgDays} days</p>
      <p>Total Cost: ${values.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral text-hospital-blue">
      <Navbar />
      <div className="container mx-auto px-4 py-6">
     <div className="flex items-center justify-between mb-4">
  <h1 className="text-3xl font-bold">Length of Stay Dashboard</h1>
  <div className="flex items-center gap-6">
    

    <Link to="/homepage" className="hover:underline font-medium text-sm">
      ← Back
    </Link>
  </div>
</div>

<div className="flex items-center gap-3 mb-4 flex-wrap">
  {/* From Date */}
  <div className="flex items-center gap-2">
    <label className="text-sm whitespace-nowrap">From:</label>
    <input
      type="date"
      value={startDate}
      onChange={(e) => setStartDate(e.target.value)}
      className="border rounded px-1 py-1 text-sm"
    />
  </div>

  {/* To Date */}
  <div className="flex items-center gap-2">
    <label className="text-sm whitespace-nowrap">To:</label>
    <input
      type="date"
      value={endDate}
      onChange={(e) => setEndDate(e.target.value)}
      className="border rounded px-1 py-1 text-sm"
    />
  </div>

  {/* Workflow */}
  <select
    value={algorithm}
    onChange={(e) => setAlgorithm(e.target.value)}
    className="border rounded px-2 py-1 text-sm w-44"
  >
    <option value="">All Workflows</option>
    <option value="Behavioral">Behavioral</option>
    <option value="Guardianship">Guardianship</option>
    <option value="LTC">LTC</option>
  </select>

  {/* Include Discharged */}
  <label className="flex items-center gap-1 text-sm whitespace-nowrap">
    <input
      type="checkbox"
      checked={includeDischarged}
      onChange={() => setIncludeDischarged((v) => !v)}
    />
    Include Discharged
  </label>
</div>

{/* Print Button */}
<div className="mb-6 flex justify-end">
  <button onClick={handlePrint} className="btn btn-secondary">
    <FaPrint className="inline mr-2" />
    Print Report
  </button>
</div>


       {loading && <BlueLoader />}
        {error && <p className="text-red-600">{error}</p>}

        {data && (
          <>
           <div id="los-content">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      {renderCard("Behavioral", data.behavioral)}
      {renderCard("Guardianship", data.guardianship)}
      {renderCard("LTC", data.ltc)}
    </div>
    <LOSDashboardChart
      data={[
        { workflow: "Behavioral", totalDays: data.behavioral.totalDays, totalCost: data.behavioral.cost },
        { workflow: "Guardianship", totalDays: data.guardianship.totalDays, totalCost: data.guardianship.cost },
        { workflow: "LTC", totalDays: data.ltc.totalDays, totalCost: data.ltc.cost },
      ]}
      nationalAverage={data.nationalAverage}
    />
  </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default LengthOfStayReport;
