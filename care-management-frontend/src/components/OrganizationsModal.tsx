import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../redux/store";
import {
  fetchOrganizations,
  createOrganization,
  deleteOrganization,
  updateOrganization,
  assignHospitalToOrganization,
  removeHospitalFromOrganization,
} from "../redux/slices/organizationSlice";
import { loadHospitals, updateHospitalTimezone } from "../redux/slices/hospitalSlice";
import { toast } from "react-toastify";
import { US_TIMEZONES } from "../constants/timezones";

interface OrganizationsModalProps {
  onClose: () => void;
}

const OrganizationsModal: React.FC<OrganizationsModalProps> = ({ onClose }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { organizations } = useSelector((s: RootState) => s.organizations);
  const { hospitals } = useSelector((s: RootState) => s.hospitals);

  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgTimezone, setNewOrgTimezone] = useState("America/New_York");
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [editingOrgId, setEditingOrgId] = useState<number | null>(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgTimezone, setEditOrgTimezone] = useState("America/New_York");
  const [selectedHospital, setSelectedHospital] = useState("");
  const [editingHospitalTzId, setEditingHospitalTzId] = useState<number | null>(null);
  const [pendingHospitalTz, setPendingHospitalTz] = useState("");

  useEffect(() => {
    dispatch(fetchOrganizations());
    dispatch(loadHospitals());
  }, [dispatch]);


  const assignedHospitals = hospitals.filter((h) => h.organization_id === selectedOrgId);
  const unassignedHospitals = hospitals.filter((h) => !h.organization_id);

  const handleCreate = () => {
    if (!newOrgName.trim()) return;
    dispatch(createOrganization({ name: newOrgName, timezone: newOrgTimezone }))
      .unwrap()
      .then(() => {
        toast.success("Organization created");
        setNewOrgName("");
        setNewOrgTimezone("America/New_York");
        dispatch(fetchOrganizations());
      })
      .catch((err) => toast.error(err));
  };

  const handleDelete = (orgId: number) => {
    if (!window.confirm("Delete this organization?")) return;
    dispatch(deleteOrganization(orgId))
      .unwrap()
      .then(() => {
        toast.success("Organization deleted");
        if (selectedOrgId === orgId) setSelectedOrgId(null);
        dispatch(fetchOrganizations());
      })
      .catch((err) => toast.error(err));
  };

  const handleStartEditOrg = (org: { id: number; name: string; timezone: string }) => {
    setEditingOrgId(org.id);
    setEditOrgName(org.name);
    setEditOrgTimezone(org.timezone || "America/New_York");
  };

  const handleSaveEditOrg = (orgId: number) => {
    if (!editOrgName.trim()) return;
    dispatch(updateOrganization({ orgId, name: editOrgName, timezone: editOrgTimezone }))
      .unwrap()
      .then(() => {
        toast.success("Organization updated");
        setEditingOrgId(null);
        dispatch(fetchOrganizations());
      })
      .catch((err) => toast.error(err));
  };

  const handleAssign = () => {
    if (!selectedOrgId || !selectedHospital) return;
    dispatch(assignHospitalToOrganization({ orgId: selectedOrgId, hospitalId: Number(selectedHospital) }))
      .unwrap()
      .then(() => {
        toast.success("Hospital assigned");
        dispatch(loadHospitals());
        dispatch(fetchOrganizations());
        setSelectedHospital("");
      })
      .catch((err) => toast.error(err));
  };

  const handleRemove = (hospitalId: number) => {
    dispatch(removeHospitalFromOrganization({ hospitalId }))
      .unwrap()
      .then(() => {
        toast.success("Hospital removed");
        dispatch(loadHospitals());
        dispatch(fetchOrganizations());
      })
      .catch((err) => toast.error(err));
  };

  const handleStartHospitalTz = (hospitalId: number, tz: string) => {
    setEditingHospitalTzId(hospitalId);
    setPendingHospitalTz(tz || "America/New_York");
  };

  const handleSaveHospitalTz = (hospitalId: number) => {
    dispatch(updateHospitalTimezone({ hospitalId, timezone: pendingHospitalTz }))
      .unwrap()
      .then(() => {
        toast.success("Timezone updated");
        setEditingHospitalTzId(null);
        dispatch(loadHospitals());
      })
      .catch((err) => toast.error(err));
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden">

        {/* HEADER */}
        <div className="bg-[var(--prussian-blue)] text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Manage Organizations</h2>
          <button onClick={onClose} className="text-white text-xl hover:opacity-70 transition">✕</button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">

          {/* CREATE ORG */}
          <div className="bg-[var(--prussian-blue)] rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4">Create New Organization</h3>
            <div className="flex gap-3 flex-wrap">
              <input
                className="flex-1 min-w-[200px] bg-white text-black placeholder-gray-400 border-0 rounded-lg py-2 px-3 text-sm"
                placeholder="Organization Name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
              />
              <select
                className="bg-white text-black border-0 rounded-lg py-2 px-3 text-sm"
                value={newOrgTimezone}
                onChange={(e) => setNewOrgTimezone(e.target.value)}
              >
                {US_TIMEZONES.map((tz) => (
                  <option key={tz}>{tz}</option>
                ))}
              </select>
              <button
                onClick={handleCreate}
                disabled={!newOrgName.trim()}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
                  newOrgName.trim()
                    ?  "bg-[var(--primary-blue)] text-white hover:opacity-90" 
                    : "bg-white/30 text-white/50 cursor-not-allowed"
                }`}
              >
                Add Organization
              </button>
            </div>
          </div>

          {/* ORGANIZATIONS TABLE */}
          <div>
            <h3 className="text-base font-semibold text-gray-700 mb-3">Organizations</h3>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Timezone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-sm">
                        No organizations yet. Create one above.
                      </td>
                    </tr>
                  )}
                  {organizations.map((org) => (
                    <>
                      {/* MAIN ROW */}
                      <tr
                        key={org.id}
                        className={`border-b border-gray-100 transition cursor-pointer ${
                          editingOrgId === org.id
                            ? "bg-blue-50"
                            : selectedOrgId === org.id
                            ? "bg-blue-50"
                            : "hover:bg-gray-50"
                        }`}
                        onClick={() => setSelectedOrgId(selectedOrgId === org.id ? null : org.id)}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{org.name}</td>
                        <td className="px-4 py-3 text-gray-500">{org.timezone}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => editingOrgId === org.id ? setEditingOrgId(null) : handleStartEditOrg(org)}
                              className="text-blue-600 text-sm font-medium hover:underline"
                            >
                              {editingOrgId === org.id ? "Cancel" : "Edit"}
                            </button>
                            <button
                              onClick={() => handleDelete(org.id)}
                              className="text-red-500 text-sm font-medium hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* EDIT ROW */}
                      {editingOrgId === org.id && (
                        <tr className="bg-blue-50 border-b border-blue-100">
                          <td colSpan={3} className="px-4 py-4">
                            <div className="flex items-center gap-4 flex-wrap">
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-500 font-medium">Name</label>
                                <input
                                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
                                  value={editOrgName}
                                  onChange={(e) => setEditOrgName(e.target.value)}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Timezone</label>
                                <select
                                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
                                  value={editOrgTimezone}
                                  onChange={(e) => setEditOrgTimezone(e.target.value)}
                                >
                                  {US_TIMEZONES.map((tz) => (
                                    <option key={tz}>{tz}</option>
                                  ))}
                                </select>
                              </div>
                              <button
                                onClick={() => handleSaveEditOrg(org.id)}
                                className="bg-[var(--prussian-blue)] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition"
                              >
                                Save
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* HOSPITALS UNDER THIS ORG */}
                      {selectedOrgId === org.id && !editingOrgId && (
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <td colSpan={3} className="px-4 py-4">
                            <div className="space-y-4">

                              {/* Hospital list */}
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Hospitals under {org.name}
                              </p>

                              {assignedHospitals.length === 0 ? (
                                <p className="text-sm text-gray-400">No hospitals assigned.</p>
                              ) : (
                                <div className="rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100 bg-white">
                                  {assignedHospitals.map((h) => (
                                    <div key={h.id} className="px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                                      <span className="font-medium text-sm text-gray-800">{h.name}</span>

                                      <div className="flex items-center gap-3 flex-wrap">
                                        {editingHospitalTzId === h.id ? (
                                          <>
                                            <select
                                              className="border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white"
                                              value={pendingHospitalTz}
                                              onChange={(e) => setPendingHospitalTz(e.target.value)}
                                            >
                                              {US_TIMEZONES.map((tz) => (
                                                <option key={tz}>{tz}</option>
                                              ))}
                                            </select>
                                            <button
                                              onClick={() => handleSaveHospitalTz(h.id)}
                                              className="bg-[var(--prussian-blue)] text-white px-3 py-1 rounded-lg text-xs font-medium hover:opacity-90"
                                            >
                                              Save
                                            </button>
                                            <button
                                              onClick={() => setEditingHospitalTzId(null)}
                                              className="text-xs text-gray-500 hover:underline"
                                            >
                                              Cancel
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <span className="text-xs text-gray-500">{h.timezone || "No timezone"}</span>
                                            <button
                                              onClick={() => handleStartHospitalTz(h.id, h.timezone)}
                                              className="text-blue-600 text-xs hover:underline"
                                            >
                                              Edit
                                            </button>
                                          </>
                                        )}
                                        <button
                                          onClick={() => handleRemove(h.id)}
                                          className="text-red-500 text-xs hover:underline"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Assign hospital */}
                              {unassignedHospitals.length > 0 && (
                                <div className="flex gap-3 items-center">
                                  <select
                                    className="flex-1 border border-gray-300 rounded-lg py-1.5 px-3 text-sm bg-white"
                                    value={selectedHospital}
                                    onChange={(e) => setSelectedHospital(e.target.value)}
                                  >
                                    <option value="">Assign a hospital...</option>
                                    {unassignedHospitals.map((h) => (
                                      <option key={h.id} value={h.id}>{h.name}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={handleAssign}
                                    disabled={!selectedHospital}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                                      selectedHospital
                                        ? "bg-[var(--prussian-blue)] text-white hover:opacity-90"
                                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    }`}
                                  >
                                    Assign
                                  </button>
                                </div>
                              )}

                            </div>
                          </td>
                        </tr>
                      )}
                    </>
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

export default OrganizationsModal;