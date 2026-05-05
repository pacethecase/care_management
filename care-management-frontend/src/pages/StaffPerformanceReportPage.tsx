// src/pages/StaffPerformanceReportPage.tsx
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BlueLoader from "../components/BlueLoader";
import { fetchStaffPerformanceReport } from "../redux/slices/reportSlice";
import { fetchStaffs } from "../redux/slices/userSlice";
import { loadHospitals } from "../redux/slices/hospitalSlice";
import { AppDispatch, RootState } from "../redux/store";
import { Link } from "react-router-dom";
import { useHospitalTimezone } from "../hooks/timezone";
import { FaPrint } from "react-icons/fa";

const algorithms = ["Behavioral", "Guardianship", "LTC"];

interface StaffTaskSummary {
  total_tasks?:      number;
  missed_count?:     number;
  delayed_count?:    number;
  overridden_count?: number;
}

const StaffPerformanceReportPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { formatDateTime } = useHospitalTimezone();

  const reportsState    = useSelector((s: RootState) => s.reports.staffPerformanceReport);
  const { data, loading, error, type } = reportsState;
  const drilldown       = Array.isArray(reportsState.drilldown)       ? reportsState.drilldown       : [];
  const topLaggingStaff = Array.isArray(reportsState.topLaggingStaff) ? reportsState.topLaggingStaff : [];
  const topMissedTasks  = Array.isArray(reportsState.topMissedTasks)  ? reportsState.topMissedTasks  : [];

  const { hospitals } = useSelector((s: RootState) => s.hospitals);
  const { user }      = useSelector((s: RootState) => s.user);
  const allStaffs     = useSelector((s: RootState) => s.user.staffs) || [];

  const isSuperAdmin = user?.role === "super_admin";

  const today  = new Date().toISOString().slice(0, 10);
  const past30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [start,              setStart]              = useState(past30);
  const [end,                setEnd]                = useState(today);
  const [selectedStaffId,    setSelectedStaffId]    = useState("");
  const [selectedAlgorithm,  setSelectedAlgorithm]  = useState("");
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [includeDischarged,  setIncludeDischarged]  = useState(false);

  const staffList = selectedHospitalId
    ? allStaffs.filter((s: any) => String(s.hospital_id) === String(selectedHospitalId))
    : allStaffs;

  useEffect(() => {
    if (isSuperAdmin) dispatch(loadHospitals());
  }, [dispatch, isSuperAdmin]);

  useEffect(() => {
    dispatch(fetchStaffs({ hospitalId: selectedHospitalId || undefined }));
  }, [dispatch, selectedHospitalId]);

  useEffect(() => {
    dispatch(fetchStaffPerformanceReport({
      start, end,
      staffId:          selectedStaffId   ? Number(selectedStaffId)   : undefined,
      algorithm:        selectedAlgorithm || undefined,
      hospitalId:       selectedHospitalId || undefined,
      includeDischarged,
    }));
  }, [start, end, selectedStaffId, selectedAlgorithm, selectedHospitalId, includeDischarged, dispatch]);

  const handlePrint = () => {
  const content = document.getElementById("report-content");
  const printWindow = window.open("", "_blank");
  if (!content || !printWindow) return;

  const rootStyles = getComputedStyle(document.documentElement);

  printWindow.document.write(`
    <html><head><title>30-Day Delay Report</title>
    <style>
      :root {
        --prussian-blue:     ${rootStyles.getPropertyValue("--prussian-blue").trim()};
        --algo-behavioral:   ${rootStyles.getPropertyValue("--algo-behavioral").trim()};
        --algo-guardianship: ${rootStyles.getPropertyValue("--algo-guardianship").trim()};
        --algo-ltc:          ${rootStyles.getPropertyValue("--algo-ltc").trim()};
      }
      @page { margin: 12mm; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 16px; color: #111;
             -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .logo { height: 70px; display: block; margin: 0 auto 8px; }
      h1 { text-align: center; font-size: 22px; color: var(--prussian-blue); margin-bottom: 4px; }
      p.sub { text-align: center; font-size: 11px; color: #666; margin-bottom: 20px; }

      /* Cards row */
      .grid { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
      .grid > div { flex: 1; min-width: 200px; padding: 14px; border-radius: 8px;
                    border: 1px solid #e5e7eb; page-break-inside: avoid; }
      .border-l-8 { border-left-width: 8px !important; border-left-style: solid !important; }
      .border-red-500    { border-left-color: #ef4444 !important; }
      .border-orange-400 { border-left-color: #fb923c !important; }
      .text-red-600   { color: #dc2626; }
      .text-orange-500 { color: #f97316; }
      ul { padding-left: 16px; margin: 8px 0 0; }
      li { font-size: 12px; margin-bottom: 3px; }

      /* Table */
      .rounded-xl { border-radius: 8px; overflow: hidden; }
      table { width: 100%; border-collapse: collapse; }
      thead tr {
        background: var(--prussian-blue) !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      th {
        background: var(--prussian-blue) !important;
        color: white !important;
        padding: 8px 10px;
        text-align: left;
        font-size: 11px;
        font-weight: 600;
      }
      td { padding: 7px 10px; font-size: 11px; border-bottom: 1px solid #e5e7eb; color: #374151; }
      tr:nth-child(even) td { background: #f9fafb; }

      /* Staff summary cards */
      .sm\\:grid-cols-4 { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
      .sm\\:grid-cols-4 > div {
        flex: 1; min-width: 120px; padding: 12px; border-radius: 8px;
        border: 1px solid #e5e7eb; page-break-inside: avoid;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      h3 { font-size: 13px; font-weight: bold; margin: 0 0 4px; }
      .text-3xl { font-size: 24px; margin: 4px 0 0; }

      /* Force all inline styles to render correctly in print */
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    </style></head>
    <body>
      <img src="/logo.png" class="logo"/>
      <h1>30-Day Delay Report</h1>
      <p class="sub">From: ${start} &nbsp;|&nbsp; To: ${end}</p>
      ${content.outerHTML}
    </body></html>
  `);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
};

  // ── Table helpers ──────────────────────────────────────────────────────────
  const ModernTable: React.FC<{ headers: string[]; rows: any[] }> = ({ headers, rows }) => (
    <div className="rounded-xl overflow-hidden shadow-sm bg-white">
      <table className="min-w-full border-collapse">
        <thead className="bg-[var(--prussian-blue)] text-white">
          <tr>{headers.map(h => <th key={h} className="px-4 py-3 text-left text-sm font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.map((row: any[], i: number) => (
            <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
              {Array.isArray(row)
                ? row.map((cell: any, j: number) => (
                    <td key={j} className="px-4 py-2 text-sm text-gray-700">{cell ?? "—"}</td>
                  ))
                : <td className="px-4 py-2 text-sm text-gray-700" colSpan={headers.length}>{row}</td>}
            </tr>
          )) : (
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

  const buildPatientRows = () =>
    (Array.isArray(data) ? data : []).map((p: any) => [
      p.patient_name      ?? "—",
      p.total_tasks       ?? 0,
      p.missed            ?? 0,
      p.delayed_completed ?? 0,
      p.pending           ?? 0,
      p.completed_on_time ?? 0,
      p.overridden        ?? 0,
      p.manual            ?? 0,
      (Array.isArray(p.staff) ? p.staff : []).join(", ") || "—",
    ]);

  const buildAlgorithmRows = () => drilldown.map((d: any) => [
    d.task_name      ?? "—",
    d.patient_name   ?? "—",
    d.status         ?? "—",
    d.missed_reason  ?? "—",
    d.override_reason ?? "—",
    d.override_count ?? 0,
    d.last_override_at ? formatDateTime(d.last_override_at) : "—",
  ]);

  const buildDrilldownRows = () => drilldown.map((d: any) => [
    d.task_name       ?? "—",
    d.patient_name    ?? "—",
    d.status          ?? "—",
    d.missed_reason   ?? "—",
    d.override_count  ?? 0,
    d.last_override_at ? formatDateTime(d.last_override_at) : "—",
    d.override_reason ?? "—",
  ]);

  // ── Render report ──────────────────────────────────────────────────────────
  const renderTable = () => {
    const safeType = typeof type === "string" ? type : "summary";

    if (safeType === "summary") return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="p-5 bg-white rounded-xl shadow-sm border-l-8 border-red-500">
            <h2 className="text-lg font-bold text-red-600">Top Missed Tasks</h2>
            {topMissedTasks.length === 0
              ? <p className="text-sm text-gray-500 mt-2">No missed tasks in this period.</p>
              : (
                <ul className="mt-2 list-disc list-inside text-gray-700">
                  {topMissedTasks.map((t: any) => (
                    <li key={t.task_name ?? Math.random()}>
                      {t.task_name ?? "—"} — <b>{t.total_issues ?? 0}</b>
                    </li>
                  ))}
                </ul>
              )}
          </div>
          <div className="p-5 bg-white rounded-xl shadow-sm border-l-8 border-orange-400">
            <h2 className="text-lg font-bold text-orange-500">Staff Performance</h2>
            {topLaggingStaff.length === 0
              ? <p className="text-sm text-gray-500 mt-2">No issues found for any staff in this period.</p>
              : (
                <ul className="mt-2 list-disc list-inside text-gray-700">
                  {topLaggingStaff.map((s: any) => (
                    <li key={s.staff_name ?? Math.random()}>
                      {s.staff_name ?? "—"} — <b>{s.missed_count ?? 0} missed, {s.delayed_count ?? 0} delayed</b>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </div>
        <ModernTable
          headers={["Patient","Total","Missed","Delayed","Pending","On Time","Overridden","Manual","Staff"]}
          rows={buildPatientRows()}
        />
      </>
    );

    if (safeType === "algorithm") return (
      <>
        {drilldown.length === 0
          ? <p className="text-gray-500 text-center py-8">No issues found for this workflow in the selected period.</p>
          : (
            <ModernTable
              headers={["Task Name","Patient","Status","Missed Reason","Override Reason","Override Count","Override At"]}
              rows={buildAlgorithmRows()}
            />
          )}
      </>
    );

    if (safeType === "staff" || safeType === "staff-task") {
      const d = (Array.isArray(data) && data.length > 0
        ? data[0]
        : (data && typeof data === "object" ? data : {})) as StaffTaskSummary;
      return (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-6">
            {[
              { label: "Total Tasks", value: d.total_tasks      ?? 0, color: "var(--prussian-blue)" },
              { label: "Missed",      value: d.missed_count     ?? 0, color: "#dc2626" },
              { label: "Delayed",     value: d.delayed_count    ?? 0, color: "#fb923c" },
              { label: "Overridden",  value: d.overridden_count ?? 0, color: "#3b82f6" },
            ].map(card => (
              <div key={card.label} className="p-5 bg-white rounded-xl shadow-sm"
                style={{ borderLeft: `5px solid ${card.color}` }}>
                <h3 className="text-lg font-bold">{card.label}</h3>
                <p className="text-3xl mt-2">{card.value}</p>
              </div>
            ))}
          </div>
          {drilldown.length === 0
            ? <p className="text-gray-500 text-center py-8">No issues found for this staff member in the selected period.</p>
            : (
              <ModernTable
                headers={["Task","Patient","Status","Missed Reason","Override Count","Override At","Override Reason"]}
                rows={buildDrilldownRows()}
              />
            )}
        </>
      );
    }

    return <p className="text-gray-600">No data found.</p>;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral text-hospital-blue">
      <Navbar />
      <div className="container mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-[var(--prussian-blue)]">30-Day Delay Report</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--prussian-blue)] text-white rounded shadow hover:opacity-90 transition text-sm"
            >
              <FaPrint /> Print Report
            </button>
            <Link to="/homepage" className="hover:underline font-medium text-sm">← Back</Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 overflow-x-auto">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <label className="block text-xs text-gray-600">From</label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600">To</label>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600">Workflow</label>
              <select value={selectedAlgorithm} onChange={e => setSelectedAlgorithm(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm min-w-[160px]">
                <option value="">All</option>
                {algorithms.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {isSuperAdmin && (
              <div>
                <label className="block text-xs text-gray-600">Hospital</label>
                <select value={selectedHospitalId}
                  onChange={e => { setSelectedHospitalId(e.target.value); setSelectedStaffId(""); }}
                  className="border rounded-md px-2 py-1 text-sm min-w-[180px]">
                  <option value="">All Hospitals</option>
                  {hospitals.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-600">Staff</label>
              <select value={selectedStaffId} onChange={e => setSelectedStaffId(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm min-w-[160px]">
                <option value="">All Staff</option>
                {staffList.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" checked={includeDischarged}
                onChange={e => setIncludeDischarged(e.target.checked)} />
              <label className="text-sm">Include Discharged</label>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading && <BlueLoader />}
        {error   && <p className="text-red-500">{typeof error === "string" ? error : JSON.stringify(error)}</p>}
        {!loading && !error && (
          <div id="report-content" className="overflow-x-auto">
            {renderTable()}
          </div>
        )}

      </div>
      <Footer />
    </div>
  );
};

export default StaffPerformanceReportPage;