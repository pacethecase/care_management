import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../redux/store";

import {
  fetchUnapprovedUsers,
  approveUser,
  rejectUser,
} from "../redux/slices/adminSlice";

import { fetchAllUsers, fetchStarRating } from "../redux/slices/userSlice";
import { loadHospitals } from "../redux/slices/hospitalSlice";
import { fetchOrganizations } from "../redux/slices/organizationSlice";

const UsersModal = ({ onClose }: { onClose: () => void }) => {
  const dispatch = useDispatch<AppDispatch>();

  const currentUser = useSelector((s: RootState) => s.user.user);

  const { allUsers } = useSelector((s: RootState) => s.admin);
  const hospitals = useSelector((s: RootState) => s.hospitals.hospitals);
  const organizations = useSelector((s: RootState) => s.organizations.organizations);
  const starRatings = useSelector((s: RootState) => s.user.starRatings);

  const [filterRole, setFilterRole] = useState("all");
  const [filterOrg, setFilterOrg] = useState("");
  const [filterHospital, setFilterHospital] = useState("");

  useEffect(() => {
    dispatch(fetchAllUsers({}));
    dispatch(fetchUnapprovedUsers());
    dispatch(loadHospitals());
    dispatch(fetchOrganizations());
  }, [dispatch]);

  useEffect(() => {
    allUsers.forEach((u) => {
      if (u.is_staff) dispatch(fetchStarRating(u.id));
    });
  }, [dispatch, allUsers]);

  const getHospitalName = (id: number | null | undefined) =>
    hospitals.find((h) => h.id === id)?.name || "—";

  const getOrgName = (id: number | null | undefined) =>
    organizations.find((o) => o.id === id)?.name || "—";

  // ---------------------------- FILTER LOGIC ----------------------------

  let filteredUsers = [...allUsers];

  if (currentUser?.has_global_access) {
    if (filterOrg) {
      filteredUsers = filteredUsers.filter(
        (u) => String(u.organization_id) === filterOrg
      );
    }
    if (filterHospital) {
      filteredUsers = filteredUsers.filter(
        (u) => String(u.hospital_id) === filterHospital
      );
    }
  } else if (currentUser?.is_super_admin) {
    filteredUsers = filteredUsers.filter(
      (u) => u.organization_id === currentUser.organization_id
    );
    if (filterHospital) {
      filteredUsers = filteredUsers.filter(
        (u) => String(u.hospital_id) === filterHospital
      );
    }
  } else if (currentUser?.is_admin) {
    filteredUsers = filteredUsers.filter(
      (u) => u.hospital_id === currentUser.hospital_id
    );
  } else {
    filteredUsers = filteredUsers.filter((u) => u.id === currentUser?.id);
  }

  filteredUsers = filteredUsers.filter((u) =>
    filterRole === "all"
      ? true
      : filterRole === "admin"
      ? u.is_admin && !u.is_super_admin
      : u.is_staff
  );

  // ---------------------------- UI ----------------------------

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-xl overflow-hidden">

        {/* HEADER */}
        <div className="bg-[var(--prussian-blue)] text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Manage Users</h2>
          <button onClick={onClose} className="text-white text-xl hover:opacity-80">✕</button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto">

          {/* ---------------------------- FILTERS (RIGHT ALIGNED) ---------------------------- */}
          <div className="flex mb-4">
            <div className="ml-auto flex gap-3">

              {currentUser?.has_global_access && (
                <select
                  className="border border-gray-300 bg-white text-black px-3 py-2 rounded-md"
                  value={filterOrg}
                  onChange={(e) => {
                    setFilterOrg(e.target.value);
                    setFilterHospital("");
                  }}
                >
                  <option value="">All Organizations</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              )}

              {(currentUser?.has_global_access || currentUser?.is_super_admin) && (
                <select
                  className="border border-gray-300 bg-white text-black px-3 py-2 rounded-md"
                  value={filterHospital}
                  onChange={(e) => setFilterHospital(e.target.value)}
                >
                  <option value="">All Hospitals</option>
                  {hospitals
                    .filter((h) =>
                      currentUser?.has_global_access
                        ? !filterOrg || h.organization_id === Number(filterOrg)
                        : h.organization_id === currentUser?.organization_id
                    )
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                </select>
              )}

              {!currentUser?.is_staff && (
                <select
                  className="border border-gray-300 bg-white text-black px-3 py-2 rounded-md"
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                >
                  <option value="all">All Users</option>
                  <option value="admin">Admins</option>
                  <option value="staff">Staff</option>
                </select>
              )}
            </div>
          </div>

          {/* ---------------------------- TABLE ---------------------------- */}
          <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="min-w-full text-sm">
              
              {/* BLUE HEADER */}
              <thead className="bg-[var(--prussian-blue)] text-white">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-left">Organization</th>
                  <th className="p-3 text-left">Hospital</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Rating</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="bg-white hover:bg-gray-50">
                    <td className="p-3">{u.name}</td>
                    <td className="p-3">{u.email}</td>

                    <td className="p-3">
                      {u.is_super_admin
                        ? "Organization Admin"
                        : u.is_admin
                        ? "Admin"
                        : "Staff"}
                    </td>

                    <td className="p-3">{getOrgName(u.organization_id)}</td>
                    <td className="p-3">{getHospitalName(u.hospital_id)}</td>

                    <td className="p-3">
                      {u.is_approved ? (
                        <span className="text-green-700">Approved</span>
                      ) : (
                        <span className="text-yellow-700">Pending</span>
                      )}
                    </td>

                    <td className="p-3">
                      {"⭐".repeat(starRatings[u.id]?.stars || 0)}
                    </td>

                    <td className="p-3 flex gap-2">
                      {!u.is_approved ? (
                        <button
                          className="bg-[var(--prussian-blue)] text-white px-3 py-1 rounded hover:opacity-90"
                          onClick={() => dispatch(approveUser(u.id))}
                        >
                          Approve
                        </button>
                      ) : (
                        <button
                          className="bg-red-600 text-white px-3 py-1 rounded hover:opacity-90"
                          onClick={() => dispatch(rejectUser(u.id))}
                        >
                          Revoke
                        </button>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>
          </div>

        </div>

      </div>
    </div>
  );
};

export default UsersModal;
