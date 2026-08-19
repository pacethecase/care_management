// src/pages/RequestsPage.tsx
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "../redux/store";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BlueLoader from "../components/BlueLoader";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { FaPrint } from "react-icons/fa";
import {
  loadApprovals, decideApproval, loadApprovalsReport,
} from "../redux/slices/approvalSlice";
import type { ApprovalRequest } from "../redux/slices/approvalSlice";
import {
  loadOverrideRequests, loadOverrideRequestsReport, decideOverride,
} from "../redux/slices/taskSlice";
import type { OverrideRequest } from "../redux/slices/taskSlice";

type RequestType = "approvals" | "overrides";

const RequestsPage = () => {
  const dispatch = useDispatch<AppDispatch>();

  const { user }      = useSelector((s: RootState) => s.user);
  const { hospitals } = useSelector((s: RootState) => s.hospitals);
  const { list: approvalsList, report: approvalsReport, loading: approvalsLoading } = useSelector((s: RootState) => s.approval);
  const { overrideRequests, overrideReport, overrideLoading } = useSelector((s: RootState) => s.tasks);

  const isSuperAdmin = user?.role === "super_admin";
  const hasGlobal    = user?.role === "administration" && user?.has_global_access;

  const [tab, setTab]                       = useState<RequestType>("approvals");
  const [statusFilter, setStatusFilter]     = useState("");
  const [hospitalId, setHospitalId]         = useState("");
  const [includeDischarged, setIncludeDischarged] = useState(false);
  const [decidingId, setDecidingId]         = useState<number | null>(null);

  useEffect(() => {
    const params = { hospitalId: hospitalId || undefined, status: statusFilter || undefined, includeDischarged };
    if (tab === "approvals") {
      dispatch(loadApprovals(params));
      dispatch(loadApprovalsReport({ hospitalId: hospitalId || undefined, includeDischarged }));
    } else {
      dispatch(loadOverrideRequests(params));
      dispatch(loadOverrideRequestsReport({ hospitalId: hospitalId || undefined, includeDischarged }));
    }
  }, [dispatch, tab, hospitalId, statusFilter, includeDischarged]);

  const reload = () => {
    const params = { hospitalId: hospitalId || undefined, status: statusFilter || undefined, includeDischarged };
    if (tab === "approvals") {
      dispatch(loadApprovals(params));
      dispatch(loadApprovalsReport({ hospitalId: hospitalId || undefined, includeDischarged }));
    } else {
      dispatch(loadOverrideRequests(params));
      dispatch(loadOverrideRequestsReport({ hospitalId: hospitalId || undefined, includeDischarged }));
    }
  };

  const handleApprovalDecision = async (id: number, decision: "Approved" | "Denied") => {
    const decision_note = prompt(`Enter a note for this ${decision.toLowerCase()} decision (optional):`) || undefined;
    setDecidingId(id);
    try {
      await dispatch(decideApproval({ id, decision, decision_note })).unwrap();
      toast.success(`Request ${decision.toLowerCase()}.`);
      reload();
    } catch (err: any) {
      toast.error(typeof err === "string" ? err : `Failed to ${decision.toLowerCase()} request.`);
    } finally {
      setDecidingId(null);
    }
  };

  const handleOverrideDecision = async (requestId: number, patientTaskId: number, decision: "Approved" | "Denied") => {
    const decision_note = prompt(`Enter a note for this ${decision.toLowerCase()} decision (optional):`) || undefined;
    setDecidingId(requestId);
    try {
      await dispatch(decideOverride({ patientTaskId, decision, decision_note })).unwrap();
      toast.success(`Override ${decision.toLowerCase()}.`);
      reload();
    } catch (err: any) {
      toast.error(typeof err === "string" ? err : `Failed to ${decision.toLowerCase()} override.`);
    } finally {
      setDecidingId(null);
    }
  };

  const handlePrint = () => {
    const content = document.getElementById("requests-content");
    const printWindow = window.open("", "_blank");
    if (!content || !printWindow) return;
    const rootStyles = getComputedStyle(document.documentElement);
    printWindow.document.write(`
      <html><head><title>${tab === "approvals" ? "Approvals" : "Overrides"} Report</title>
      <style>
        :root { --prussian-blue: ${rootStyles.getPropertyValue("--prussian-blue").trim()}; }
        @page { margin: 12mm; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 16px; color: #111;
               -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .logo { height: 70px; display: block; margin: 0 auto 8px; }
        h1 { text-align: center; font-size: 22px; color: var(--prussian-blue); margin-bottom: 20px; }
        .grid { display: flex; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
        .grid > div { flex: 1; min-width: 150px; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; }
        h3 { font-size: 12px; font-weight: 600; margin: 0; color: #666; }
        .text-3xl { font-size: 22px; margin: 4px 0 0; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background: var(--prussian-blue) !important; }
        th { color: white !important; padding: 8px 10px; text-align: left; font-size: 11px; }
        td { padding: 7px 10px; font-size: 11px; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) td { background: #f9fafb; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      </style></head>
      <body>
        <img src="/logo.png" class="logo"/>
        <h1>${tab === "approvals" ? "Approvals" : "Overrides"} Report</h1>
        ${content.outerHTML}
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      Pending:  "bg-yellow-500",
      Approved: "bg-green-600",
      Denied:   "bg-red-600",
    };
    return (
      <span className={`text-xs px-2 py-1 rounded-full font-semibold text-white ${colors[status] || "bg-gray-400"}`}>
        {status}
      </span>
    );
  };

  const delayBadge = (days: number | null) => {
    if (days === null || days === undefined) return <span className="text-gray-400">—</span>;
    const color = days > 0 ? "text-red-600" : days < 0 ? "text-green-600" : "text-gray-600";
    const sign  = days > 0 ? "+" : "";
    return <span className={`font-medium ${color}`}>{sign}{days}d</span>;
  };

  if (!user) return <BlueLoader />;

  const loading = tab === "approvals" ? approvalsLoading : overrideLoading;

  const kpis = tab === "approvals" ? [
    { label: "Total Requests", value: approvalsReport?.totals.totalRequests ?? 0, color: "var(--prussian-blue)", isMoney: false },
    { label: "Pending",        value: approvalsReport?.totals.pendingCount ?? 0, color: "#f59e0b", isMoney: false },
    { label: "Approved",       value: approvalsReport?.totals.approvedCount ?? 0, color: "#16a34a", isMoney: false },
    { label: "Denied",         value: approvalsReport?.totals.deniedCount ?? 0, color: "#dc2626", isMoney: false },
    { label: "Total Requested", value: approvalsReport?.totals.totalEstimatedAmount ?? 0, color: "#0ea5e9", isMoney: true },
    { label: "Approved Amount", value: approvalsReport?.totals.approvedAmount ?? 0, color: "#8b5cf6", isMoney: true },
  ] : [
    { label: "Total Requests", value: overrideReport?.totals.totalRequests ?? 0, color: "var(--prussian-blue)", isMoney: false },
    { label: "Pending",        value: overrideReport?.totals.pendingCount ?? 0, color: "#f59e0b", isMoney: false },
    { label: "Approved",       value: overrideReport?.totals.approvedCount ?? 0, color: "#16a34a", isMoney: false },
    { label: "Denied",         value: overrideReport?.totals.deniedCount ?? 0, color: "#dc2626", isMoney: false },
    { label: "Avg Est. Delay", value: overrideReport?.totals.avgDelayDays ?? 0, color: "#ef4444", isMoney: false, suffix: "d" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral text-hospital-blue">
      <Navbar />
      <div className="container mx-auto px-4 py-6">

        {/* Header: title left, print + back right */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h1 className="text-3xl font-bold text-[var(--prussian-blue)]">Requests</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--prussian-blue)] text-white rounded shadow hover:opacity-90 transition text-sm"
            >
              <FaPrint /> Print Report
            </button>
            <Link to="/homepage" className="hover:underline font-medium text-sm">← Back</Link>
          </div>
        </div>

        {/* Filters: report type, status, hospital (super/global only), include discharged */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 overflow-x-auto">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <label className="block text-xs text-gray-600">Report</label>
              <select value={tab} onChange={e => setTab(e.target.value as RequestType)}
                className="border rounded-md px-2 py-1 text-sm min-w-[160px]">
                <option value="approvals">Approvals</option>
                <option value="overrides">Overrides</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm min-w-[160px]">
                <option value="">All</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Denied">Denied</option>
              </select>
            </div>

            {(isSuperAdmin || hasGlobal) && (
              <div>
                <label className="block text-xs text-gray-600">Hospital</label>
                <select value={hospitalId} onChange={e => setHospitalId(e.target.value)}
                  className="border rounded-md px-2 py-1 text-sm min-w-[180px]">
                  <option value="">All Hospitals</option>
                  {hospitals?.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
            )}

            <label className="flex items-center gap-2 mt-4 text-sm">
              <input type="checkbox" checked={includeDischarged}
                onChange={e => setIncludeDischarged(e.target.checked)} />
              Include Discharged
            </label>
          </div>
        </div>

        {loading && <BlueLoader />}

        {!loading && (
          <div id="requests-content">
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              {kpis.map(card => (
                <div key={card.label} className="p-4 bg-white rounded-xl shadow-sm"
                  style={{ borderLeft: `5px solid ${card.color}` }}>
                  <h3 className="text-xs font-semibold text-gray-500">{card.label}</h3>
                  <p className="text-2xl mt-1 font-bold" style={{ color: card.color }}>
                    {(card as any).isMoney ? `$${Number(card.value).toFixed(2)}` : `${card.value}${(card as any).suffix ?? ""}`}
                  </p>
                </div>
              ))}
            </div>

            {/* ── Approvals table ── */}
            {tab === "approvals" && (
              <div className="rounded-xl overflow-x-auto shadow-sm bg-white overflow-y-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-[var(--prussian-blue)] text-white">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Patient</th>
                      {(isSuperAdmin || hasGlobal) && <th className="px-4 py-3 text-left text-sm font-semibold">Hospital</th>}
                      <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Est. Amount</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Requested By</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Requested At</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Decided By</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Decided At</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Notes</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalsList.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="text-center py-6 text-gray-500">No approval requests found.</td>
                      </tr>
                    ) : approvalsList.map((r: ApprovalRequest, i: number) => {
                      const isOwnRequest = r.requested_by === user.id;
                      return (
                        <tr key={r.id} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                          <td className="px-4 py-2 text-sm text-gray-700">{r.patient_name}</td>
                          {(isSuperAdmin || hasGlobal) && <td className="px-4 py-2 text-sm text-gray-700">{r.hospital_name}</td>}
                          <td className="px-4 py-2 text-sm text-gray-700">
                            <div className="font-medium">{r.name}</div>
                            {r.description && <div className="text-xs text-gray-500">{r.description}</div>}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">${Number(r.estimated_amount).toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm">{statusBadge(r.status)}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{r.requested_by_name || "—"}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{new Date(r.requested_at).toLocaleString()}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{r.decided_by_name || "—"}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {r.decided_at ? new Date(r.decided_at).toLocaleString() : "—"}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">{r.decision_note || "—"}</td>
                          <td className="px-4 py-2 text-sm">
                            {r.status === "Pending" ? (
                              isOwnRequest ? (
                                <span className="text-xs text-gray-400 italic">Awaiting another admin</span>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    className="px-3 py-1 text-xs rounded bg-green-600 text-white hover:opacity-90 disabled:opacity-50"
                                    disabled={decidingId === r.id}
                                    onClick={() => handleApprovalDecision(r.id, "Approved")}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:opacity-90 disabled:opacity-50"
                                    disabled={decidingId === r.id}
                                    onClick={() => handleApprovalDecision(r.id, "Denied")}
                                  >
                                    Deny
                                  </button>
                                </div>
                              )
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Overrides table ── */}
            {tab === "overrides" && (
              <div className="rounded-xl overflow-hidden shadow-sm bg-white overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-[var(--prussian-blue)] text-white">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Patient</th>
                      {(isSuperAdmin || hasGlobal) && <th className="px-4 py-3 text-left text-sm font-semibold">Hospital</th>}
                      <th className="px-4 py-3 text-left text-sm font-semibold">Task</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Reason</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Requested By</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Ideal Due Date</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Requested Date</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Est. Delay</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Requested At</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Decided By</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Decided At</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Notes</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overrideRequests.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="text-center py-6 text-gray-500">No override requests found.</td>
                      </tr>
                    ) : overrideRequests.map((r: OverrideRequest, i: number) => {
                      const isOwnRequest = r.requested_by === user.id;
                      return (
                        <tr key={r.id} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                          <td className="px-4 py-2 text-sm text-gray-700">{r.patient_name}</td>
                          {(isSuperAdmin || hasGlobal) && <td className="px-4 py-2 text-sm text-gray-700">{r.hospital_name}</td>}
                          <td className="px-4 py-2 text-sm text-gray-700">{r.task_name}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{r.reason || "—"}</td>
                          <td className="px-4 py-2 text-sm">{statusBadge(r.status)}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{r.requested_by_name || "—"}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {r.ideal_due_date ? new Date(r.ideal_due_date).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">{new Date(r.requested_date).toLocaleDateString()}</td>
                          <td className="px-4 py-2 text-sm">{delayBadge(r.estimated_delay_days)}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{new Date(r.requested_at).toLocaleString()}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{r.decided_by_name || "—"}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {r.decided_at ? new Date(r.decided_at).toLocaleString() : "—"}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">{r.decision_note || "—"}</td>
                          <td className="px-4 py-2 text-sm">
                            {r.status === "Pending" ? (
                              isOwnRequest ? (
                                <span className="text-xs text-gray-400 italic">Awaiting another admin</span>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    className="px-3 py-1 text-xs rounded bg-green-600 text-white hover:opacity-90 disabled:opacity-50"
                                    disabled={decidingId === r.id}
                                    onClick={() => handleOverrideDecision(r.id, r.patient_task_id, "Approved")}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:opacity-90 disabled:opacity-50"
                                    disabled={decidingId === r.id}
                                    onClick={() => handleOverrideDecision(r.id, r.patient_task_id, "Denied")}
                                  >
                                    Deny
                                  </button>
                                </div>
                              )
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default RequestsPage;