// src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "../redux/store";
import { fetchOrganizations } from "../redux/slices/organizationSlice";
import { loadHospitals } from "../redux/slices/hospitalSlice";
import { fetchAllUsers } from "../redux/slices/userSlice";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import OrganizationsModal from "../components/OrganizationsModal";
import HospitalsModal from "../components/HospitalsModal";
import UsersModal from "../components/UsersModal";

const Dashboard = () => {
  const dispatch = useDispatch<AppDispatch>();
  const user          = useSelector((s: RootState) => s.user.user);
  const { organizations } = useSelector((s: RootState) => s.organizations);
  const { hospitals }     = useSelector((s: RootState) => s.hospitals);
  const { allUsers }      = useSelector((s: RootState) => s.user);

  const [showOrgsModal,      setShowOrgsModal]      = useState(false);
  const [showHospitalsModal, setShowHospitalsModal] = useState(false);
  const [showUsersModal,     setShowUsersModal]     = useState(false);

  // FIX: role checks use role string
  const isSuperAdmin  = user?.role === "super_admin";
  const isAdmin       = user?.role === "admin";
  const isAdministration = user?.role === "administration";
  // global super_admin = super_admin WITH has_global_access — sees ALL orgs/hospitals
  const isGlobalAdmin = isAdministration && !!user?.has_global_access;

  useEffect(() => {
    if (!user) return;
    dispatch(fetchOrganizations());
    dispatch(loadHospitals());
    dispatch(fetchAllUsers({}));
  }, [dispatch, user]);

  // Filtering logic — same behaviour as before, role flags corrected:
  // isGlobalAdmin    → no filter, sees everything
  // isSuperAdmin     → scoped to their organization only
  // isAdmin          → scoped to their org + their one hospital
  let filteredOrganizations = organizations;
  let filteredHospitals     = hospitals;

  if (!isGlobalAdmin) {
    if (isSuperAdmin) {
      filteredOrganizations = organizations.filter(o => o.id === user?.organization_id);
      filteredHospitals     = hospitals.filter(h => h.organization_id === user?.organization_id);
    } else if (isAdmin) {
      filteredOrganizations = organizations.filter(o => o.id === user?.organization_id);
      filteredHospitals     = hospitals.filter(h => h.id === user?.hospital_id);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar />
      <main className="flex-grow p-6">
        <div className="container p-6 mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">Dashboard</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Only global super_admin sees Organizations card */}
            {isGlobalAdmin && (
              <SummaryCard
                title="Organizations"
                count={filteredOrganizations?.length}
                onClick={() => setShowOrgsModal(true)}
              />
            )}
            <SummaryCard
              title="Hospitals"
              count={filteredHospitals?.length}
              onClick={() => setShowHospitalsModal(true)}
            />
            <SummaryCard
              title="Users"
              count={allUsers?.length}
              onClick={() => setShowUsersModal(true)}
            />
          </div>
        </div>
      </main>

      <Footer />

      {showOrgsModal && isGlobalAdmin && (
        <OrganizationsModal onClose={() => setShowOrgsModal(false)} />
      )}
      {showHospitalsModal && (
        <HospitalsModal onClose={() => setShowHospitalsModal(false)} />
      )}
      {showUsersModal && (
        <UsersModal onClose={() => setShowUsersModal(false)} />
      )}
    </div>
  );
};

export default Dashboard;

interface SummaryCardProps {
  title:   string;
  count?:  number;
  onClick: () => void;
}

const SummaryCard = ({ title, count, onClick }: SummaryCardProps) => (
  <div
    onClick={onClick}
    className="p-6 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer flex flex-col items-start"
  >
    <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
    <p className="text-4xl font-bold text-gray-900 mt-2 mb-4">{count ?? "–"}</p>
    <button className="px-4 py-2 text-sm bg-[var(--prussian-blue)] text-white rounded-md hover:opacity-90 transition">
      Manage {title}
    </button>
  </div>
);