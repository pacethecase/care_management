// src/components/UsersModal.tsx
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../redux/store";
import { fetchUnapprovedUsers, approveUser, revokeUser } from "../redux/slices/adminSlice";
import { fetchAllUsers, fetchStarRating } from "../redux/slices/userSlice";
import { loadHospitals } from "../redux/slices/hospitalSlice";
import { fetchOrganizations } from "../redux/slices/organizationSlice";
import BlueLoader from "../components/BlueLoader";
import { toast } from "react-toastify";

const getRoleLabel = (role: string) => {
  if (role === 'super_admin') return 'Organization Admin';
  if (role === 'admin') return 'Admin';
  if (role === 'administration') return 'Administration';
  return 'Staff';
};

const UsersModal = ({ onClose }: { onClose: () => void }) => {
  const dispatch = useDispatch<AppDispatch>();

  const currentUser   = useSelector((s: RootState) => s.user.user);
  const { allUsers }  = useSelector((s: RootState) => s.admin);
  const hospitals     = useSelector((s: RootState) => s.hospitals.hospitals);
  const organizations = useSelector((s: RootState) => s.organizations.organizations);
  const starRatings   = useSelector((s: RootState) => s.user.starRatings);

  const [filterRole, setFilterRole]       = useState<'all' | 'super_admin' | 'admin' | 'staff'>('all');
  const [filterOrg, setFilterOrg]         = useState('');
  const [filterHospital, setFilterHospital] = useState('');
  const [loadingUserId, setLoadingUserId] = useState<number | null>(null); // ← ADD

  useEffect(() => {
    dispatch(fetchAllUsers({}));
    dispatch(fetchUnapprovedUsers());
    dispatch(loadHospitals());
    dispatch(fetchOrganizations());
  }, [dispatch]);

  useEffect(() => {
    allUsers.forEach((u) => {
      if (u.role === 'staff') dispatch(fetchStarRating(u.id));
    });
  }, [dispatch, allUsers]);

  const getHospitalName = (id: number | null | undefined) =>
    hospitals.find((h) => h.id === id)?.name ?? '—';

  const getOrgName = (id: number | null | undefined) =>
    organizations.find((o) => o.id === id)?.name ?? '—';

  // ← ADD proper error extractor
  const getError = (err: any) => {
    if (typeof err === "string") return err;
    if (err?.error) return err.error;
    if (err?.message) return err.message;
    return "Something went wrong";
  };

  // ← ADD handlers
  const handleApprove = async (u: any) => {
    setLoadingUserId(u.id);
    try {
      await dispatch(approveUser(u.id)).unwrap();
      toast.success(`${u.name} approved successfully`);
      dispatch(fetchAllUsers({}));
      dispatch(fetchUnapprovedUsers());
    } catch (err: any) {
      toast.error(getError(err));
    } finally {
      setLoadingUserId(null);
    }
  };

  const handleRevoke = async (u: any) => {
    setLoadingUserId(u.id);
    try {
      await dispatch(revokeUser(u.id)).unwrap();
      toast.success(`${u.name} revoked successfully`);
      dispatch(fetchAllUsers({}));
      dispatch(fetchUnapprovedUsers());
    } catch (err: any) {
      toast.error(getError(err));
    } finally {
      setLoadingUserId(null);
    }
  };

  let filteredUsers = [...allUsers];

  if (currentUser?.role === 'administration' && currentUser?.has_global_access) {
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
  } else if (currentUser?.role === 'super_admin') {
    filteredUsers = filteredUsers.filter(
      (u) => u.organization_id === currentUser.organization_id
    );
    if (filterHospital) {
      filteredUsers = filteredUsers.filter(
        (u) => String(u.hospital_id) === filterHospital
      );
    }
  } else if (currentUser?.role === 'admin') {
    filteredUsers = filteredUsers.filter(
      (u) => u.hospital_id === currentUser.hospital_id
    );
  } else {
    filteredUsers = filteredUsers.filter((u) => u.id === currentUser?.id);
  }

  if (filterRole !== 'all') {
    filteredUsers = filteredUsers.filter((u) => u.role === filterRole);
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-xl overflow-hidden relative"> {/* ← ADD relative */}

        {/* ← ADD BlueLoader overlay */}
        {loadingUserId !== null && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl">
            <BlueLoader />
          </div>
        )}

        {/* Header */}
        <div className="bg-[var(--prussian-blue)] text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Manage Users</h2>
          <button onClick={onClose} className="text-white text-xl hover:opacity-80">✕</button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto">

          {/* Filters */}
          <div className="flex mb-4">
            <div className="ml-auto flex gap-3">

              {currentUser?.role === 'administration' && currentUser?.has_global_access && (
                <select
                  className="border border-gray-300 bg-white text-black px-3 py-2 rounded-md"
                  value={filterOrg}
                  onChange={(e) => {
                    setFilterOrg(e.target.value);
                    setFilterHospital('');
                  }}
                >
                  <option value="">All Organizations</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              )}

              {currentUser?.role === 'super_admin' && (
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
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                </select>
              )}

              {currentUser?.role !== 'staff' && (
                <select
                  className="border border-gray-300 bg-white text-black px-3 py-2 rounded-md"
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value as any)}
                >
                  <option value="all">All Users</option>
                  <option value="super_admin">Organization Admins</option>
                  <option value="admin">Admins</option>
                  <option value="staff">Staff</option>
                </select>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--prussian-blue)] text-white">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-left">Organization</th>
                  <th className="p-3 text-left">Hospital</th>
                  <th className="p-3 text-left">Verified</th> {/* ← ADD */}
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Rating</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-gray-400">
                      No users found.
                    </td>
                  </tr>
                )}
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="bg-white hover:bg-gray-50">
                    <td className="p-3">{u.name}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{getRoleLabel(u.role)}</td>
                    <td className="p-3">{getOrgName(u.organization_id)}</td>
                    <td className="p-3">{getHospitalName(u.hospital_id)}</td>
                    {/* ← ADD verified column */}
                    <td className="p-3">
                      {u.is_verified ? (
                        <span className="text-green-700">Verified</span>
                      ) : (
                        <span className="text-red-500">Not Verified</span>
                      )}
                    </td>
                    <td className="p-3">
                      {u.is_approved ? (
                        <span className="text-green-700">Approved</span>
                      ) : (
                        <span className="text-yellow-700">Pending</span>
                      )}
                    </td>
                    <td className="p-3">
                      {u.role === 'staff'
                        ? '⭐'.repeat(starRatings[u.id]?.stars ?? 0) || '—'
                        : '—'}
                    </td>
                    <td className="p-3 flex gap-2">
                      {!u.is_approved ? (
                        <button
                          className="bg-[var(--prussian-blue)] text-white px-3 py-1 rounded hover:opacity-90 disabled:opacity-50"
                          disabled={loadingUserId !== null}
                          onClick={() => handleApprove(u)}
                        >
                          Approve
                        </button>
                      ) : (
                        <button
                          className="bg-red-600 text-white px-3 py-1 rounded hover:opacity-90 disabled:opacity-50"
                          disabled={loadingUserId !== null}
                          onClick={() => handleRevoke(u)}
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