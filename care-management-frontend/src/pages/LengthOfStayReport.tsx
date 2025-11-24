import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchLengthOfStayReport } from "../redux/slices/reportSlice";
import { loadHospitals } from "../redux/slices/hospitalSlice";
import type { RootState, AppDispatch } from "../redux/store";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import LOSDashboardChart from "../components/LOSDashboardChart";
import BlueLoader from "../components/BlueLoader";

import { FaPrint } from "react-icons/fa";

const algoColors: Record<string, string> = {
  Behavioral: "var(--algo-behavioral)",
  Guardianship: "var(--algo-guardianship)",
  LTC: "var(--algo-ltc)",
};

const LengthOfStayReport = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, error } = useSelector((s: RootState) => s.reports.los);
  const { hospitals } = useSelector((s: RootState) => s.hospitals);
  const { user } = useSelector((s: RootState) => s.user);

  // Filters
  const [includeDischarged, setIncludeDischarged] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [algorithm, setAlgorithm] = useState("");
  const [hospitalId, setHospitalId] = useState("");

  useEffect(() => {
    if (user?.is_super_admin) dispatch(loadHospitals());
  }, [dispatch, user]);

  useEffect(() => {
    dispatch(
      fetchLengthOfStayReport({
        includeDischarged,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        algorithm: algorithm || undefined,
        hospitalId: hospitalId || undefined,
      })
    );
  }, [dispatch, includeDischarged, startDate, endDate, algorithm, hospitalId]);

  // ------- PRINT ---------
  const handlePrint = () => {
    const content = document.getElementById("los-content");
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const rootStyles = getComputedStyle(document.documentElement);

    const cssVariables = `
      :root {
        --algo-behavioral: ${rootStyles.getPropertyValue("--algo-behavioral").trim()};
        --algo-guardianship: ${rootStyles.getPropertyValue("--algo-guardianship").trim()};
        --algo-ltc: ${rootStyles.getPropertyValue("--algo-ltc").trim()};
      }
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Length of Stay Report</title>
          <link rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" />

          <style>
            ${cssVariables}

            @page { margin: 12mm; }

            body {
              font-family: Arial, sans-serif;
              margin: 0 !important;
              padding: 0 !important;
            }

            .logo {
              height: 80px;
              display: block;
              margin: 0 auto 10px;
            }

            h1 {
              text-align: center;
              font-size: 26px;
              color: #003049;
              margin-bottom: 10px;
            }

            .no-break, .card, .chart-container {
              page-break-inside: avoid;
              break-inside: avoid;
            }
          </style>
        </head>

        <body>
          <img src="/logo.png" class="logo"/>
          <h1>Length of Stay Dashboard</h1>
          ${content.outerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  // ------- SUMMARY CARD -------
  const renderCard = (label: string, values: any) => {
    const color = algoColors[label] || "#003049";

    return (
      <div className="p-5 bg-white rounded-xl shadow-sm border border-gray-200"  style={{ borderLeft: `5px solid ${color}` }}>
        
        <h3 className="font-bold text-xl mb-3" style={{ color }}>
          {label}
        </h3>

        <div className="space-y-1 text-sm text-gray-700">
          <p><span className="font-medium">Total Patients:</span> {values.count}</p>
          <p><span className="font-medium">Total Days:</span> {values.totalDays}</p>
          <p><span className="font-medium">Average LOS:</span> {values.avgDays} days</p>
          <p>
            <span className="font-medium">Total Cost:</span>{" "}
            <span style={{ color }}>
              ${values.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </p>
        </div>
      </div>
    );
  };

 
  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral text-hospital-blue">
      <Navbar />

      <div className="container mx-auto px-4 py-6">          
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-6">
            <h1 className="text-3xl font-bold">Length of Stay Dashboard</h1>    
          </div>


          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--prussian-blue)] 
                      text-white rounded shadow hover:opacity-90 transition w-fit"
          >
            <FaPrint />
            Print Report
          </button>

        </div>


        {/* FILTERS SECTION */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-8">
       <div className="grid grid-cols-1 gap-4 items-start">


            {/* LEFT FILTERS */}
            <div className="flex flex-wrap gap-6">
              {/* Date, Workflow, Hospital */}
              {[{
                label: "Start Date", value: startDate, setter: setStartDate, type: "date"
              },{
                label: "End Date", value: endDate, setter: setEndDate, type: "date"
              }].map((item, i) => (
                <div key={i}>
                  <label className="block text-xs text-gray-500 mb-1">{item.label}</label>
                  <input
                    type="date"
                    value={item.value}
                    onChange={(e) => item.setter(e.target.value)}
                    className="border rounded-md px-2 py-1 text-sm"
                  />
                </div>
              ))}

              {/* Workflow */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Workflow</label>
                <select
                  value={algorithm}
                  onChange={(e) => setAlgorithm(e.target.value)}
                  className="border rounded-md px-2 py-1 text-sm w-44"
                >
                  <option value="">All Workflows</option>
                  <option value="Behavioral">Behavioral</option>
                  <option value="Guardianship">Guardianship</option>
                  <option value="LTC">LTC</option>
                </select>
              </div>

              {/* Hospital */}
              {user?.is_super_admin && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Hospital</label>
                  <select
                    value={hospitalId}
                    onChange={(e) => setHospitalId(e.target.value)}
                    className="border rounded-md px-2 py-1 text-sm w-48"
                  >
                    <option value="">All Hospitals</option>
                    {hospitals?.map((h: any) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Include Discharged */}
              <label className="flex items-center gap-2 mt-6 text-sm">
                <input
                  type="checkbox"
                  checked={includeDischarged}
                  onChange={() => setIncludeDischarged(!includeDischarged)}
                />
                Include Discharged
              </label>
            </div>

         
  

          </div>
        </div>

        {/* RESULTS */}
        {loading && <BlueLoader />}
        {error && <p className="text-red-600">{error}</p>}

        {data && (
          <div id="los-content">

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6 no-break">
              {renderCard("Behavioral", data.behavioral)}
              {renderCard("Guardianship", data.guardianship)}
              {renderCard("LTC", data.ltc)}
            </div>

            {/* CHART */}
            <div className="chart-container">
              <LOSDashboardChart
                data={[
                  { workflow: "Behavioral", totalDays: data.behavioral.totalDays, totalCost: data.behavioral.cost },
                  { workflow: "Guardianship", totalDays: data.guardianship.totalDays, totalCost: data.guardianship.cost },
                  { workflow: "LTC", totalDays: data.ltc.totalDays, totalCost: data.ltc.cost },
                ]}
                nationalAverage={data.nationalAverage}
              />
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default LengthOfStayReport;
