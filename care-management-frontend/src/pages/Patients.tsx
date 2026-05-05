// src/pages/Patients.tsx
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  fetchPatients, searchPatients, fetchPatientsByAdmin,
} from "../redux/slices/patientSlice";
import { fetchAdmins } from "../redux/slices/userSlice";
import { loadHospitals } from "../redux/slices/hospitalSlice";
import { RootState, AppDispatch } from "../redux/store";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import PatientsList from "../components/PatientsList";
import BlueLoader from "../components/BlueLoader";

const Patients = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { patients, searchResults, loading: patientLoading, error } =
    useSelector((s: RootState) => s.patients);
  const { user, admins, adminLoading } = useSelector((s: RootState) => s.user);
  const { hospitals }                  = useSelector((s: RootState) => s.hospitals);

  const [searchTerm,      setSearchTerm]      = useState("");
  const [selectedAdminId, setSelectedAdminId] = useState<number | "">("");
  const [hospitalId,      setHospitalId]      = useState("");

  // FIX: role checks use role string
  const isSuperAdmin = user?.role === "super_admin";
  const isStaff      = user?.role === "staff";
  const isAdmin      = user?.role === "admin";

  const displayedPatients = searchTerm.trim() ? searchResults : patients;

  useEffect(() => {
    if (isSuperAdmin) dispatch(loadHospitals());
  }, [dispatch, isSuperAdmin]);

  useEffect(() => {
    // FIX: role check
    if (!isStaff) dispatch(fetchAdmins({ hospitalId: hospitalId || undefined }));
  }, [dispatch, isStaff, hospitalId]);

  useEffect(() => {
    const delay = setTimeout(() => {
      const trimmed = searchTerm.trim();
      if (trimmed) {
        dispatch(searchPatients({
          query: trimmed, status: "active",
          hospitalId:  hospitalId      || undefined,
          adminId:     selectedAdminId !== "" ? Number(selectedAdminId) : undefined,
        }));
      } else if (!isStaff && selectedAdminId !== "") {
        dispatch(fetchPatientsByAdmin(Number(selectedAdminId)));
      } else {
        dispatch(fetchPatients({ hospitalId: hospitalId || undefined }));
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [searchTerm, selectedAdminId, hospitalId, dispatch, user]);

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-light)] text-[var(--text-dark)]">
      <Navbar />

      <main className="flex-grow p-6 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Patient list */}
          <PatientsList patients={displayedPatients} user={user} />

          {/* Sidebar — search + filters */}
          <div className="w-full lg:w-1/3 bg-white border border-[var(--border-muted)] shadow-sm rounded-xl p-6 h-fit space-y-4">
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name or MRN"
              className="input w-full"
            />

            {/* FIX: role checks */}
            {!isStaff && (
              <>
                {isSuperAdmin && (
                  <>
                    <label className="font-semibold">Filter by Hospital:</label>
                    <select
                      className="input w-full"
                      value={hospitalId}
                      onChange={e => setHospitalId(e.target.value)}
                    >
                      <option value="">All Hospitals</option>
                      {hospitals.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </>
                )}

                <label htmlFor="adminFilter" className="font-semibold">
                  Filter by Leader:
                </label>
                <select
                  id="adminFilter"
                  className="input w-full"
                  value={selectedAdminId}
                  onChange={e => setSelectedAdminId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">All Leaders</option>
                  {admins.map(admin => (
                    <option key={admin.id} value={admin.id}>{admin.name}</option>
                  ))}
                </select>
              </>
            )}

            {/* Status key */}
            <div className="mt-6">
              <h3 className="font-semibold mb-2 text-[var(--prussian-blue)] text-center lg:text-left">
                Status Key
              </h3>
              <div className="flex flex-col items-center lg:items-start space-y-2 text-sm">
                {[
                  ["bg-gray-400",   "Not Started"],
                  ["bg-blue-500",   "Due Today or Upcoming"],
                  ["bg-red-600",    "Overdue"],
                  ["bg-green-600",  "Up-To-Date"],
                  ["bg-yellow-400", "Consideration"],
                ].map(([color, label]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className={`inline-block w-4 h-4 rounded-full ${color}`} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons — not staff */}
          {/* FIX: role checks */}
          {!isStaff && (
            <div className="w-full lg:w-1/3 bg-white border border-[var(--border-muted)] shadow-sm rounded-xl p-6 h-fit">
              <div className="flex flex-col gap-3">
                <button className="btn w-full" onClick={() => navigate("/discharged")}>
                  View Discharged Patients
                </button>
                <button className="btn w-full" onClick={() => navigate("/archived")}>
                  View Archived Patients
                </button>
                {/* FIX: only hospital admin can add patients, not super_admin */}
                {isAdmin && (
                  <button className="btn w-full" onClick={() => navigate("/add-patient")}>
                    + Add Patient
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {(patientLoading || adminLoading) && <BlueLoader />}
        {error && (
          <p className="mt-6 text-red-600 text-center">
            {typeof error === "string" ? error : "Error occurred"}
          </p>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Patients;