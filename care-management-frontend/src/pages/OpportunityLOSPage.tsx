import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import OpportunityLOSChart from "../components/OpportunityLOSChart";
import { AppDispatch, RootState } from "../redux/store";
import { fetchOpportunityDaysReport } from "../redux/slices/reportSlice";
import { FaPrint } from "react-icons/fa";
import BlueLoader from "../components/BlueLoader";
import { loadHospitals } from "../redux/slices/hospitalSlice";
const algoColors: Record<string, string> = {
  Behavioral: "var(--algo-behavioral)",
  Guardianship: "var(--algo-guardianship)",
  LTC: "var(--algo-ltc)",
};

const OpportunityLOSPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, error } = useSelector(
    (state: RootState) => state.reports.opportunityLOS || {}
  );
 const { hospitals } = useSelector((s: RootState) => s.hospitals);
  const { user } = useSelector((s: RootState) => s.user);

  const [includeDischarged, setIncludeDischarged] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [algorithm, setAlgorithm] = useState("");
 const [hospitalId, setHospitalId] = useState("");
  // PRINT HANDLER (matches LOS page)
  const handlePrint = () => {
    const content = document.getElementById("opportunity-los-content");
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const rootStyles = getComputedStyle(document.documentElement);

    const cssVars = `
      :root {
        --algo-behavioral: ${rootStyles.getPropertyValue("--algo-behavioral").trim()};
        --algo-guardianship: ${rootStyles.getPropertyValue("--algo-guardianship").trim()};
        --algo-ltc: ${rootStyles.getPropertyValue("--algo-ltc").trim()};
      }
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Opportunity LOS Report</title>
          <link rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css"/>

          <style>
            ${cssVars}

            @page { margin: 12mm; }

            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
            }

            .logo {
              height: 90px;
              display: block;
              margin: 0 auto 12px;
            }

            h1 {
              text-align: center;
              color: #003049;
              font-size: 26px;
              margin-bottom: 10px;
            }

            .no-break {
              page-break-inside: avoid;
              break-inside: avoid;
            }
          </style>
        </head>

        <body>
          <img src="/logo.png" class="logo"/>
          <h1>Opportunity Length of Stay Summary</h1>
          ${content.outerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };
  useEffect(() => {
    if (user?.is_super_admin) dispatch(loadHospitals());
  }, [dispatch, user]);

  // FETCH
  useEffect(() => {
    dispatch(
      fetchOpportunityDaysReport({
        includeDischarged,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        algorithm: algorithm || undefined,
        hospitalId: hospitalId || undefined,
      })
    );
  }, [dispatch, includeDischarged, startDate, endDate, algorithm,hospitalId]);

  // SUMMARY CARD (IDENTICAL STYLE TO LOS)
  const renderSummary = (label: string, values: any) => {
    const color = algoColors[label] || "#003049";

    return (
        <div className="p-5 bg-white rounded-xl shadow-sm border border-gray-200"  style={{ borderLeft: `5px solid ${color}` }}>
        <h3 className="font-bold text-xl mb-3" style={{ color }}>
          {label}
        </h3>

        <div className="space-y-1 text-sm text-gray-700">
          <p><span className="font-medium">Admission Delay:</span> {values.admissionDelay} days</p>
          <p><span className="font-medium">Task Delay:</span> {values.taskDelay} days</p>
          <p><span className="font-medium">Total Delay:</span> {values.totalDelay} days</p>

          <p>
            <span className="font-medium">Estimated Cost:</span>{" "}
            <span style={{ color }}>
              ${values.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral">
      <Navbar />

      <div className="container mx-auto px-4 py-6">
        
        {/* HEADER WITH PRINT BUTTON (MATCHES LOS) */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-6">
            <h1 className="text-3xl font-bold">Opportunity Length of Stay Summary</h1>
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

        {/* FILTERS BOX (IDENTICAL TO LOS PAGE) */}
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
          <div id="opportunity-los-content" className="no-break">

            {/* SUMMARY CARDS (MATCHING LOS) */}
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6 no-break">
              {renderSummary("Behavioral", data.behavioral)}
              {renderSummary("Guardianship", data.guardianship)}
              {renderSummary("LTC", data.ltc)}
            </div>

            {/* CHART */}
            <OpportunityLOSChart
              data={[
                { workflow: "Behavioral", ...data.behavioral },
                { workflow: "Guardianship", ...data.guardianship },
                { workflow: "LTC", ...data.ltc },
              ]}
              nationalAverage={data.nationalAverage}
            />
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default OpportunityLOSPage;
