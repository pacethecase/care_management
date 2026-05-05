// src/components/HospitalsModal.tsx
import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../redux/store";
import { loadHospitals, updateDailyRoomCost, updateHospitalTimezone } from "../redux/slices/hospitalSlice";
import { addHospital, deleteHospital } from "../redux/slices/adminSlice";
import { fetchOrganizations } from "../redux/slices/organizationSlice";
import { toast } from "react-toastify";
import { US_TIMEZONES } from "../constants/timezones";
import React from "react";
const HospitalsModal = ({ onClose }: { onClose: () => void }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { hospitals }     = useSelector((s: RootState) => s.hospitals);
  const { organizations } = useSelector((s: RootState) => s.organizations);
  const { user }          = useSelector((s: RootState) => s.user);

  // FIX: role check
  const isSuperAdmin = user?.role === "super_admin";

  const [newHospital,  setNewHospital]  = useState("");
  const [newTimezone,  setNewTimezone]  = useState("America/New_York");
  const [editingId,    setEditingId]    = useState<number | null>(null);
  const [editRate,     setEditRate]     = useState<number>(0);
  const [editTimezone, setEditTimezone] = useState("America/New_York");

  useEffect(() => {
    dispatch(loadHospitals());
    dispatch(fetchOrganizations());
  }, [dispatch]);

  const getOrgName = (orgId: number | null) =>
    orgId ? (organizations.find((o) => o.id === orgId)?.name ?? "—") : "—";

  const handleStartEdit = (h: any) => {
    setEditingId(h.id);
    setEditRate(h.daily_room_cost);
    setEditTimezone(h.timezone || "America/New_York");
  };

  const handleSaveEdit = async (id: number) => {
    try {
      await dispatch(updateDailyRoomCost({ hospitalId: id, daily_room_cost: editRate })).unwrap();
      await dispatch(updateHospitalTimezone({ hospitalId: id, timezone: editTimezone })).unwrap();
      toast.success("Hospital updated");
      setEditingId(null);
    } catch (err: any) {
      toast.error(err);
    }
  };

  const handleAddHospital = () => {
    if (!newHospital.trim()) return;
    dispatch(addHospital({ name: newHospital, timezone: newTimezone }))
      .unwrap()
      .then(() => {
        toast.success("Hospital added");
        dispatch(loadHospitals());
        setNewHospital("");
        setNewTimezone("America/New_York");
      })
      .catch((err) => toast.error(err));
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("Delete this hospital?")) return;
    dispatch(deleteHospital(id))
      .unwrap()
      .then(() => {
        toast.success("Hospital deleted");
        dispatch(loadHospitals());
        if (editingId === id) setEditingId(null);
      })
      .catch((err) => toast.error(err));
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-[var(--prussian-blue)] text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Manage Hospitals</h2>
          <button onClick={onClose} className="text-white text-xl hover:opacity-70 transition">✕</button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">

          {/* Add hospital */}
          {isSuperAdmin && (
          <div className="bg-[var(--prussian-blue)] rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4">Add New Hospital</h3>
            <div className="flex gap-3 flex-wrap">
              <input
                className="flex-1 min-w-[200px] bg-white text-black placeholder-gray-400 border-0 rounded-lg py-2 px-3 text-sm"
                placeholder="Hospital Name"
                value={newHospital}
                onChange={(e) => setNewHospital(e.target.value)}
              />
              <select
                className="bg-white text-black border-0 rounded-lg py-2 px-3 text-sm"
                value={newTimezone}
                onChange={(e) => setNewTimezone(e.target.value)}
              >
                {US_TIMEZONES.map((tz) => <option key={tz}>{tz}</option>)}
              </select>
              <button
                onClick={handleAddHospital}
                disabled={!newHospital.trim()}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
                  newHospital.trim()
                    ? "bg-[var(--primary-blue)] text-white hover:opacity-90"
                    : "bg-white/30 text-white/50 cursor-not-allowed"
                }`}
              >
                Add Hospital
              </button>
            </div>
          </div>
          )}

          {/* Hospital table */}
          <div>
            <h3 className="text-base font-semibold text-gray-700 mb-3">Hospitals</h3>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Organization</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Timezone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Daily Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hospitals.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                        No hospitals yet. Add one above.
                      </td>
                    </tr>
                  )}
                  {hospitals.map((h) => (
                    // FIX: key on Fragment, not on inner <tr> — React needs key on the outermost element
                    <React.Fragment key={h.id}>
                      <tr className={`border-b border-gray-100 transition ${
                        editingId === h.id ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}>
                        <td className="px-4 py-3 font-medium text-gray-900">{h.name}</td>
                        <td className="px-4 py-3 text-gray-500">{getOrgName(h.organization_id)}</td>
                        <td className="px-4 py-3 text-gray-500">{h.timezone}</td>
                        <td className="px-4 py-3 text-gray-500">${Number(h.daily_room_cost).toLocaleString()}/day</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-3">
                            <button
                              onClick={() => editingId === h.id ? setEditingId(null) : handleStartEdit(h)}
                              className="text-blue-600 text-sm font-medium hover:underline"
                            >
                              {editingId === h.id ? "Cancel" : "Edit"}
                            </button>
                            <button
                              onClick={() => handleDelete(h.id)}
                              className="text-red-500 text-sm font-medium hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {editingId === h.id && (
                        <tr className="bg-blue-50 border-b border-blue-100">
                          <td colSpan={5} className="px-4 py-4">
                            <div className="flex items-center gap-4 flex-wrap">
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Timezone</label>
                                <select
                                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
                                  value={editTimezone}
                                  onChange={(e) => setEditTimezone(e.target.value)}
                                >
                                  {US_TIMEZONES.map((tz) => <option key={tz}>{tz}</option>)}
                                </select>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Daily Rate ($)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="border border-gray-300 rounded-lg px-3 py-1.5 w-32 text-sm bg-white"
                                  value={editRate}
                                  onChange={(e) => setEditRate(Number(e.target.value))}
                                />
                              </div>
                              <button
                                onClick={() => handleSaveEdit(h.id)}
                                className="bg-[var(--prussian-blue)] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition"
                              >
                                Save Changes
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default HospitalsModal;