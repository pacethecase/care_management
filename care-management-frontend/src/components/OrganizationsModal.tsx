// src/modals/OrganizationsModal.tsx
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../redux/store";

import {
  fetchOrganizations,
  createOrganization,
  deleteOrganization,
  assignHospitalToOrganization,
  removeHospitalFromOrganization,
} from "../redux/slices/organizationSlice";

import { loadHospitals } from "../redux/slices/hospitalSlice";
import { toast } from "react-toastify";

interface OrganizationsModalProps {
  onClose: () => void;
}

const OrganizationsModal: React.FC<OrganizationsModalProps> = ({ onClose }) => {
  const dispatch = useDispatch<AppDispatch>();

  const { organizations } = useSelector((s: RootState) => s.organizations);
  const { hospitals } = useSelector((s: RootState) => s.hospitals);

  const [newOrgName, setNewOrgName] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [selectedHospital, setSelectedHospital] = useState("");

  useEffect(() => {
    dispatch(fetchOrganizations());
    dispatch(loadHospitals());
  }, [dispatch]);

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId);

  const assignedHospitals = hospitals.filter(
    (h) => h.organization_id === selectedOrgId
  );
  const unassignedHospitals = hospitals.filter((h) => !h.organization_id);

  const handleCreate = () => {
    if (!newOrgName.trim()) return;

    dispatch(createOrganization({ name: newOrgName }))
      .unwrap()
      .then(() => {
        toast.success("Organization created");
        setNewOrgName("");
        dispatch(fetchOrganizations());
      })
      .catch((err) => toast.error(err));
  };

  const handleDelete = (orgId: number) => {
    dispatch(deleteOrganization(orgId))
      .unwrap()
      .then(() => {
        toast.success("Organization deleted");
        dispatch(fetchOrganizations());
      })
      .catch((err) => toast.error(err));
  };

  const handleAssign = () => {
    if (!selectedOrgId || !selectedHospital) return;

    dispatch(
      assignHospitalToOrganization({
        orgId: selectedOrgId,
        hospitalId: Number(selectedHospital),
      })
    )
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

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden">


        <div className="bg-[var(--prussian-blue)] text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Manage Organizations</h2>
          <button className="text-white text-xl hover:opacity-80" onClick={onClose}>✕</button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto">

          {/* CREATE ORGANIZATION */}
          <div className="card w-full text-white">
            <h3 className="text-lg font-semibold mb-3">Create New Organization</h3>

            <div className="flex gap-3">
              <input
                className="bg-white text-black placeholder-gray-400 border rounded py-2 px-3"
                placeholder="Organization Name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
              />

              <button
                onClick={handleCreate}
                disabled={!newOrgName.trim()}
                className={`
                  btn 
                  ${
                    newOrgName
                      ? "bg-[var(--prussian-blue)] hover:opacity-90"
                      : "bg-gray-300 cursor-not-allowed"
                  }
                `}
              >
                Create
              </button>
            </div>
          </div>

          {/* ORGANIZATION LIST */}
          <h3 className="text-lg font-semibold mt-3 mb-3">Organizations</h3>

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            {organizations.map((org) => (
              <div
                key={org.id}
                className={`px-4 py-3 flex justify-between items-center cursor-pointer transition
                  ${selectedOrgId === org.id ? "bg-blue-50" : "hover:bg-gray-50"}
                `}
                onClick={() => setSelectedOrgId(org.id)}
              >
                <span className="font-medium">{org.name}</span>

                <button
                  className="text-red-600 text-sm hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(org.id);
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

          {/* DETAILS PANEL */}
          {selectedOrg && (
            <div className="mt-8 card p-5 rounded-xl text-white">
              <h3 className="text-lg font-semibold mb-3">
                Hospitals under {selectedOrg.name}
              </h3>

              <div className="rounded-xl border border-gray-200 bg-white mb-4">
                {assignedHospitals.length ? (
                  assignedHospitals.map((h) => (
                    <div key={h.id} className="px-4 py-3 flex text-black justify-between">
                      <span>{h.name}</span>
                      <button
                        onClick={() => handleRemove(h.id)}
                        className="text-red-600 text-sm hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="p-3 text-gray-500 text-sm">No hospitals assigned.</p>
                )}
              </div>

              {/* Assign Hospital */}
              {unassignedHospitals.length > 0 && (
                <>
                  <h4 className="text-md font-medium mb-2">Assign Hospital</h4>

                  <div className="flex gap-3">
                    <select
                      className=" w-full bg-white text-black border rounded py-2 px-3"
                      onChange={(e) => setSelectedHospital(e.target.value)}
                    >
                      <option value="">Select Hospital</option>
                      {unassignedHospitals.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleAssign}
                      disabled={!selectedHospital}
                      className={`
                        btn
                        ${
                          selectedHospital
                            ? "bg-[var(--prussian-blue)] hover:opacity-90"
                            : "bg-gray-300 cursor-not-allowed"
                        }
                      `}
                    >
                      Assign
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default OrganizationsModal;
