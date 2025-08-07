import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "../redux/store";
import {
  fetchUnapprovedUsers,
  approveUser,
  rejectUser,
  addHospital,
  deleteHospital,
  clearAdminError,
  clearHospitalMessage,
} from "../redux/slices/adminSlice";
import { fetchAllUsers } from "../redux/slices/userSlice";
import { loadHospitals,updateDailyBedCost } from "../redux/slices/hospitalSlice";
import { toast } from "react-toastify";
import type { Hospital } from "../redux/types";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { fetchStarRating } from "../redux/slices/userSlice";

const AdminPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { unapprovedUsers, allUsers, hospitalMessage, loading } = useSelector(
    (state: RootState) => state.admin
  );


  const hospitals: Hospital[] = useSelector((state: RootState) => state.hospitals.hospitals || []);
  const hasGlobalAccess = useSelector((state: RootState) => state.user?.has_global_access);
  const isSuperAdmin = useSelector((state: RootState) => state.user?.is_super_admin);
 const hospitalId = useSelector((state: RootState) => state.user.user?.hospital_id);

  const [filterHospitalId, setFilterHospitalId] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewAllUsers, setViewAllUsers] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [rates, setRates] = useState<Record<number, number>>({});
  const [showViewModal, setShowViewModal] = useState(false);
  const usersPerPage = 10;

  useEffect(() => {
    dispatch(fetchUnapprovedUsers());
    dispatch(loadHospitals());
  }, [dispatch]);

  useEffect(() => {
    if (viewAllUsers) dispatch(fetchAllUsers());
  }, [viewAllUsers, dispatch]);

  useEffect(() => {
    if (hospitalMessage) {
      toast.success(hospitalMessage);
      dispatch(clearHospitalMessage());
    }
  }, [hospitalMessage, dispatch]);

  useEffect(() => {
  if (viewAllUsers && allUsers.length > 0) {
    allUsers
      .filter((u) => u.is_staff)
      .forEach((u) => dispatch(fetchStarRating(u.id)));
  }
}, [dispatch, viewAllUsers, allUsers]);
const starRatings = useSelector((state: RootState) => state.user.starRatings);

  const handleApprove = async (id: number) => {
    await dispatch(approveUser(id));
    dispatch(fetchUnapprovedUsers());
    dispatch(fetchAllUsers());
    toast.success("User approved");
  };


const handleRevoke = async (id: number) => {
  try {
    dispatch(clearAdminError());
    const result = await dispatch(rejectUser(id)).unwrap();
    toast.info(result.message || "Access revoked");
  } catch (err: any) {
   
    toast.error(typeof err === "string" ? err : "Failed to revoke access", {
      toastId: `revoke-${id}`, 
    });
  }
};


  const handleHospitalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    if (name) {
      await dispatch(addHospital({ name }));
      await dispatch(loadHospitals());
      form.reset();
      setShowAddModal(false);
    }
  };

const handleDeleteHospital = async (id: number) => {
  try {
    await dispatch(deleteHospital(id)).unwrap();
    await dispatch(loadHospitals());
    toast.success("Hospital deleted");
  } catch (err: any) {
    const errorMsg = typeof err === "string" ? err : err?.message || "Failed to delete hospital";
    toast.error(errorMsg);
  }
};


  const getHospitalName = (id: number | undefined) => {
    if (!id) return "N/A";
    const hospital = hospitals.find((h) => h.id === id);
    return hospital ? hospital.name : `Hospital #${id}`;
  };

  const baseUsers = viewAllUsers ? allUsers : unapprovedUsers;

  const filteredUsers = baseUsers.filter((user) => {
    const matchHospital = filterHospitalId === "all" || user.hospital_id?.toString() === filterHospitalId;
    const matchRole =
      filterRole === "all" ||
      (filterRole === "admin" && user.is_admin) ||
      (filterRole === "staff" && user.is_staff);
    return matchHospital && matchRole;
  });

  const paginatedUsers = filteredUsers.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral text-hospital-blue">
      <Navbar />

      <div className="p-6">
        <div className="flex justify-between mb-4">
          <h1 className="text-2xl font-bold text-[var(--prussian-blue)]">Admin Dashboard</h1>
          {hasGlobalAccess && (
            <div className="flex gap-3">
              <button className="btn" onClick={() => setShowAddModal(true)}>
                + Add Hospital
              </button>
              <button className="btn" onClick={() => setShowViewModal(true)}>
                View Hospitals
              </button>
            </div>
          )}
        </div>

        <div>
             {isSuperAdmin && (
              <div className="mt-6">
                <h2 className="text-lg font-bold mb-2">Edit Hospital Bed Rates</h2>
                <ul className="divide-y max-w-md">
                  {[...hospitals]
                  .filter((h) => h.id === hospitalId)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((h) => (
                    <li key={h.id} className="py-2 flex justify-between items-center">
                      <span>{h.name}</span>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const newRate = rates[h.id] ?? h.daily_bed_cost;
                          dispatch(updateDailyBedCost({ hospitalId: h.id, daily_bed_cost: newRate }))
                            .unwrap()
                            .then(() => toast.success(`Updated rate for ${h.name}`))
                            .catch((_err) => toast.error("Failed to update"));
                        }}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={rates[h.id] ?? h.daily_bed_cost}
                          onChange={(e) =>
                            setRates((prev) => ({ ...prev, [h.id]: Number(e.target.value) }))
                          }
                          className="w-24 px-2 py-1 border rounded text-sm"
                        />
                        <button type="submit" className="text-sm px-3 py-1 bg-[var(--prussian-blue)] text-white rounded">
                          Save
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>

        <div className="flex justify-end gap-4 items-end mb-4">
       

          {hasGlobalAccess && (
            <select
              value={filterHospitalId}
              onChange={(e) => setFilterHospitalId(e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="all">All Hospitals</option>
              {[...hospitals].sort((a, b) => a.name.localeCompare(b.name)).map((h) => (
                <option key={h.id} value={h.id.toString()}>
                  {h.name}
                </option>
              ))}
            </select>
          )}
    
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="px-3 py-2 border rounded">
            <option value="all">All Roles</option>
            <option value="admin">Admins</option>
            <option value="staff">Staff</option>
          </select>

          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={viewAllUsers}
              onChange={() => {
                setViewAllUsers(!viewAllUsers);
                setCurrentPage(1);
              }}
            />
            Show All Users
          </label>
        </div>

        {loading ? (
          <div className="text-center py-10 font-medium text-lg">Loading...</div>
        ) : (
          <div className="overflow-auto max-h-[60vh] border rounded-xl">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-[var(--prussian-blue)] text-white">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  {hasGlobalAccess && <th className="px-4 py-2 text-left">Hospital</th>}
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                     {hasGlobalAccess && <th className="px-4 py-2 text-left">Ratings</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center">
                      No users found
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{user.name}</td>
                      <td className="px-4 py-2">{user.email}</td>
                      <td className="px-4 py-2">{user.is_admin ? "Admin" : "Staff"}</td>
                      {hasGlobalAccess && <td className="px-4 py-2">{getHospitalName(user.hospital_id)}</td>}
                      <td className="px-4 py-2">
                        {user.is_approved ? (
                          <span className="text-green-700 font-medium">Approved</span>
                        ) : (
                          <span className="text-yellow-700 font-medium">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-2 flex gap-2">
                        {!user.is_approved ? (
                          <button onClick={() => handleApprove(user.id)} className="bg-green-700 text-white px-3 py-1 rounded">
                            Approve
                          </button>
                        ) : (
                          <button onClick={() => handleRevoke(user.id)} className="bg-yellow-600 text-white px-3 py-1 rounded">
                            Revoke Access
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2">
                      {user.is_staff
                        ? "⭐".repeat(starRatings[user.id]?.stars || 0) || "–"
                        : "–"}
                    </td>
                                </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center mt-4 space-x-2">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`px-3 py-1 rounded ${
                  currentPage === i + 1 ? "bg-[var(--prussian-blue)] text-white" : "bg-white border"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      <Footer />

      {/* Add Hospital Modal */}
      {hasGlobalAccess && showAddModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-white/10 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Add Hospital</h2>
            <form onSubmit={handleHospitalSubmit}>
              <input name="name" type="text" placeholder="Hospital Name" className="w-full mb-4 px-3 py-2 border rounded" required />
              <div className="flex justify-end gap-2">
                <button type="submit" className="btn">Add</button>
                <button type="button" className="btn" onClick={() => setShowAddModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Hospitals Modal */}
      {hasGlobalAccess && showViewModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-white/10 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl max-w-lg w-full max-h-[70vh] overflow-auto">
            <h2 className="text-lg font-bold mb-4">Hospitals</h2>
            <ul className="divide-y">
             {[...hospitals].sort((a, b) => a.name.localeCompare(b.name)).map(h => (
  <li key={h.id} className="py-2 flex justify-between items-center">
    <div>{h.name}</div>

    {/* Editable rate input */}
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const newRate = rates[h.id] ?? h.daily_bed_cost;
        dispatch(updateDailyBedCost({ hospitalId: h.id, daily_bed_cost: newRate }))
          .unwrap()
          .then(() => toast.success(`Updated rate for ${h.name}`))
          .catch(() => toast.error("Failed to update"));
      }}
      className="text-sm text-gray-600 flex items-center gap-2"
    >
      <input
        type="number"
        step="0.01"
        className="border px-2 py-1 rounded w-24"
        value={rates[h.id] ?? h.daily_bed_cost}
        onChange={(e) =>
          setRates((prev) => ({
            ...prev,
            [h.id]: parseFloat(e.target.value),
          }))
        }
        onBlur={() => {
          const newRate = rates[h.id];
          if (newRate !== undefined && newRate !== h.daily_bed_cost) {
            dispatch(updateDailyBedCost({ hospitalId: h.id, daily_bed_cost: newRate }))
              .unwrap()
              .then(() => toast.success(`Updated rate for ${h.name}`))
              .catch(() => toast.error("Failed to update"));
          }
        }}
      />
      /day
    </form>

    <button
      onClick={() => handleDeleteHospital(h.id)}
      className="text-red-600 text-sm"
    >
      Delete
    </button>
  </li>
))}

            </ul>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowViewModal(false)} className="btn">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
