import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { fetchStaffPerformanceReport } from "../redux/slices/reportSlice";
import { fetchStaffs } from "../redux/slices/userSlice";
import { AppDispatch, RootState } from "../redux/store";
import { Link } from "react-router-dom";
import BlueLoader from "../components/BlueLoader";
import { loadHospitals } from "../redux/slices/hospitalSlice";
const formatDate = (date: Date) => date.toISOString().slice(0, 10);
const algorithms = ["Behavioral", "Guardianship", "LTC"];
interface StaffTaskSummary {
  total_tasks?: number;
  missed_count?: number;
  delayed_count?: number;
  overridden_count?: number;
}
const StaffPerformanceReportPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  // selectors with safe defaults
  const reportsState = useSelector((state: RootState) => state.reports.staffPerformanceReport) || {} as any;
  const data = reportsState.data;
  const loading = reportsState.loading;
  const error = reportsState.error;
  const type = reportsState.type;
  const drilldown = Array.isArray(reportsState.drilldown) ? reportsState.drilldown : [];
  const topLaggingStaff = Array.isArray(reportsState.topLaggingStaff) ? reportsState.topLaggingStaff : [];
  const topMissedTasks = Array.isArray(reportsState.topMissedTasks) ? reportsState.topMissedTasks : [];

 
  const { hospitals } = useSelector((s: RootState) => s.hospitals);
  const { user } = useSelector((s: RootState) => s.user);
  // Filters
  const [start, setStart] = useState(formatDate(new Date(Date.now() - 30 * 86400000)));
  const [end, setEnd] = useState(formatDate(new Date()));
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("");
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [includeDischarged, setIncludeDischarged] = useState(false);
// staff selector (fixed)
const allStaffs = useSelector((state: RootState) => state.user.staffs) || [];
const staffList = selectedHospitalId
  ? allStaffs.filter(
      (s: any) => String(s.hospital_id) === String(selectedHospitalId)
    )
  : allStaffs;
  useEffect(() => {
    // Wait until user is fully loaded
    if (user && user.is_super_admin) {
      dispatch(loadHospitals());
    }
  }, [dispatch, user?.is_super_admin]);


 useEffect(() => {
  dispatch(fetchStaffs({ hospitalId: selectedHospitalId || undefined }));
}, [dispatch, selectedHospitalId]);


  useEffect(() => {
    dispatch(
      fetchStaffPerformanceReport({
        start,
        end,
        staffId: selectedStaffId ? Number(selectedStaffId) : undefined,
        algorithm: selectedAlgorithm || undefined,
        hospitalId: selectedHospitalId || undefined,
        includeDischarged,
      })
    );
  }, [start, end, selectedStaffId, selectedAlgorithm, selectedHospitalId, includeDischarged, dispatch]);

  // ModernTable accepts rows as array of arrays or React nodes
  const ModernTable: React.FC<{ headers: string[]; rows: any[] }> = ({ headers, rows }) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    return (
      <div className="rounded-xl overflow-hidden shadow-sm bg-white">
        <table className="min-w-full border-collapse">
          <thead className="bg-[var(--prussian-blue)] text-white">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-4 py-3 text-left text-sm font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {safeRows.length > 0 ? (
              safeRows.map((row: any[], i: number) => (
                <tr key={i} className={`${i % 2 === 0 ? "bg-gray-50" : "bg-white"} hover:bg-gray-100 transition`}> 
                  {Array.isArray(row)
                    ? row.map((cell: any, j: number) => (
                        <td key={j} className="px-4 py-2 text-sm text-gray-700">
                          {cell ?? "—"}
                        </td>
                      ))
                    : (
                        <td className="px-4 py-2 text-sm text-gray-700" colSpan={headers.length}>
                          {row}
                        </td>
                      )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length} className="text-center py-6 text-gray-500">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // Build rows safely
  const buildPatientRows = () => {
    const list = Array.isArray(data) ? data : [];
    return list.map((p: any) => [
      p.patient_name ?? "—",
      p.total_tasks ?? 0,
      p.missed ?? 0,
      p.delayed_completed ?? 0,
      p.pending ?? 0,
      p.completed_on_time ?? 0,
      p.overridden ?? 0,
      p.manual ?? 0,
      (Array.isArray(p.staff) ? p.staff : []).join(", ") || "—",
    ]);
  };

  const buildAlgorithmRows = () => (Array.isArray(drilldown) ? drilldown : []).map((d: any) => [
    d.task_name ?? "—",
    d.patient_name ?? "—",
    d.status ?? "—",
    d.missed_reason ?? "—",
    d.override_reason ?? "—",
    d.override_count ?? 0,
    d.last_override_at ? new Date(d.last_override_at).toLocaleString() : "—",
  ]);

  const buildDrilldownRows = () => (Array.isArray(drilldown) ? drilldown : []).map((d: any) => [
    d.task_name ?? "—",
    d.patient_name ?? "—",
    d.status ?? "—",
    d.missed_reason ?? "—",
    d.override_count ?? 0,
    d.last_override_at ? new Date(d.last_override_at).toLocaleString() : "—",
    d.override_reason ?? "—",
  ]);

  const renderTable = () => {
    // default guards
    const safeType = typeof type === "string" ? type : "summary";

    if (safeType === "summary") {
      return (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="p-5 bg-white rounded-xl shadow-sm border-l-8 border-red-500">
              <h2 className="text-lg font-bold text-red-600">Top Missed Tasks</h2>
              <ul className="mt-2 list-disc list-inside text-gray-700">
                {(Array.isArray(topMissedTasks) ? topMissedTasks : []).map((t: any) => (
                  <li key={t.task_name ?? Math.random()}>
                    {t.task_name ?? "—"} — <b>{t.total_issues ?? 0}</b>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-5 bg-white rounded-xl shadow-sm border-l-8 border-orange-400">
              <h2 className="text-lg font-bold text-orange-500">Top Lagging Staff</h2>
              <ul className="mt-2 list-disc list-inside text-gray-700">
                {(Array.isArray(topLaggingStaff) ? topLaggingStaff : []).map((s: any) => (
                  <li key={s.staff_name ?? Math.random()}>
                    {s.staff_name ?? "—"} — <b>{(s.missed_count ?? 0) + " missed, " + (s.delayed_count ?? 0) + " delayed"}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <ModernTable
            headers={["Patient","Total","Missed","Delayed","Pending","On Time","Overridden","Manual Tasks","Staff"]}
            rows={buildPatientRows()}
          />
        </>
      );
    }

    if (safeType === "algorithm") {
      return (
        <ModernTable headers={["Task Name","Patient","Status","Missed Reason","Override Reason","Override Count","Override At"]} rows={buildAlgorithmRows()} />
      );
    }

    if (safeType === "staff" || safeType === "staff-task") {
     const d = (Array.isArray(data) && data.length > 0
      ? data[0]
      : (data && typeof data === "object" ? data : {})) as StaffTaskSummary;


      return (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-6">
            {[
              { label: "Total Tasks", value: d.total_tasks ?? 0, color: "var(--prussian-blue)" },
              { label: "Missed", value: d.missed_count ?? 0, color: "#dc2626" },
              { label: "Delayed", value: d.delayed_count ?? 0, color: "#fb923c" },
              { label: "Overridden", value: d.overridden_count ?? 0, color: "#3b82f6" },
            ].map((card) => (
              <div key={card.label} className="p-5 bg-white rounded-xl shadow-sm" style={{ borderLeft: `5px solid ${card.color}` }}>
                <h3 className="text-lg font-bold">{card.label}</h3>
                <p className="text-3xl mt-2">{card.value}</p>
              </div>
            ))}
          </div>

          <ModernTable
            headers={["Task","Patient","Status","Reason","Override Count","Override At","Override Reason"]}
            rows={buildDrilldownRows()}
          />
        </>
      );
    }

    return <p className="text-gray-600">No data found.</p>;
  };

  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral text-hospital-blue">
      <Navbar />

      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-[var(--prussian-blue)]">30-Day Delay Report</h1>
          <Link to="/homepage" className="hover:underline font-medium text-sm">← Back</Link>
        </div>

  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 overflow-x-auto">
  <div className="flex items-center gap-6 whitespace-nowrap">
  {/* Date From */}
    <div>
      <label className="block text-xs text-gray-600">From</label>
      <input
        type="date"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        className="border rounded-md px-2 py-1 text-sm"
      />
    </div>

    {/* Date To */}
    <div>
      <label className="block text-xs text-gray-600">To</label>
      <input
        type="date"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        className="border rounded-md px-2 py-1 text-sm"
      />
    </div>
     <div>
      <label className="block text-xs text-gray-600">Workflow</label>
      <select
        value={selectedAlgorithm}
        onChange={(e) => setSelectedAlgorithm(e.target.value)}
        className="border rounded-md px-2 py-1 text-sm min-w-[160px]"
      >
        <option value="">All</option>
        {algorithms.map((algo) => (
          <option key={algo} value={algo}>{algo}</option>
        ))}
      </select>
    </div>

  

     {user?.is_super_admin && (
      <div>
        <label className="block text-xs text-gray-600">Hospital</label>
        <select
          value={selectedHospitalId}
          onChange={(e) => {
            setSelectedHospitalId(e.target.value);
            setSelectedStaffId(""); // reset staff on hospital change
          }}
          className="border rounded-md px-2 py-1 text-sm min-w-[180px]"
        >
          <option value="">All Hospitals</option>
          {hospitals.map((h: any) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </div>
    )}

    {/* Staff — filtered by hospital */}
    <div>
      <label className="block text-xs text-gray-600">Staff</label>
      <select
        value={selectedStaffId}
        onChange={(e) => setSelectedStaffId(e.target.value)}
        className="border rounded-md px-2 py-1 text-sm min-w-[160px]"
      >
        <option value="">All Staff</option>
        {staffList.map((s: any) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>

    {/* Algorithm */}
   
    {/* Include Discharged */}
    <div className="flex items-center gap-2 mt-6">
      <input
        type="checkbox"
        checked={includeDischarged}
        onChange={(e) => setIncludeDischarged(e.target.checked)}
      />
      <label className="text-sm">Include Discharged</label>
    </div>

  </div>
</div>


        {loading && <BlueLoader />}
        {error && <p className="text-red-500">{typeof error === 'string' ? error : JSON.stringify(error)}</p>}

        {!loading && !error && <div className="overflow-x-auto">{renderTable()}</div>}
      </div>

      <Footer />
    </div>
  );
};

export default StaffPerformanceReportPage;
