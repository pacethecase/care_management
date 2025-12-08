import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PatientsList from '../components/PatientsList';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchPatients,
  searchPatients,
  fetchPatientsByAdmin,
} from '../redux/slices/patientSlice';
import { fetchAdmins } from '../redux/slices/userSlice';
import { RootState } from '../redux/store';
import type { AppDispatch } from '../redux/store';
import BlueLoader from '../components/BlueLoader';
import { loadHospitals } from '../redux/slices/hospitalSlice';
const Patients = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { patients, searchResults, loading: patientLoading, error } = useSelector(
    (state: RootState) => state.patients
  );
  const { user, admins, adminLoading } = useSelector((state: RootState) => state.user);
  const { hospitals } = useSelector((s: RootState) => s.hospitals);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedAdminId, setSelectedAdminId] = useState<number | ''>('');

  const displayedPatients = searchTerm.trim() ? searchResults : patients;
const [hospitalId, setHospitalId] = useState<string | "">("");

  useEffect(() => {
    // Wait until user is fully loaded
    if (user && user.is_super_admin) {
      dispatch(loadHospitals());
    }
  }, [dispatch, user?.is_super_admin]);

useEffect(() => {
  if (!user?.is_staff) {
   dispatch(fetchAdmins({ hospitalId: hospitalId || undefined }));

  }
}, [dispatch, user?.is_staff, hospitalId]);

useEffect(() => {
  const delay = setTimeout(() => {
    const trimmed = searchTerm.trim();

    if (trimmed.length > 0) {
      dispatch(searchPatients({ query: trimmed, status: 'active', hospitalId: hospitalId || undefined ,adminId: selectedAdminId !== '' ? Number(selectedAdminId) : undefined }));
    }
    else if (!user?.is_staff && selectedAdminId !== '') {
      dispatch(fetchPatientsByAdmin(Number(selectedAdminId)));
    }
    else {
      dispatch(fetchPatients({ hospitalId: hospitalId || undefined }));
    }
  }, 300);

  return () => clearTimeout(delay);
}, [searchTerm, selectedAdminId, hospitalId, dispatch, user]);



  // Scroll lock for modal
  useEffect(() => {
    document.body.style.overflow = selectedPatientId ? 'hidden' : 'auto';
  }, [selectedPatientId]);

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-light)] text-[var(--text-dark)]">
      <Navbar />

      <main className="flex-grow p-6 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Patients List */}
          <PatientsList
            patients={displayedPatients}
            user={user}
            onPatientClick={(id: number) => setSelectedPatientId(id)}
          />

    
        <div className="w-full lg:w-1/3 bg-white border border-[var(--border-muted)] shadow-sm rounded-xl p-6 h-fit space-y-4">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or MRN"
            className="input w-full"
          />

          {!user?.is_staff && (
            <>
            {user?.is_super_admin && (
                <>
                  <label className="font-semibold">Filter by Hospital:</label>
                  <select
                    className="input w-full"
                    value={hospitalId}
                    onChange={(e) => setHospitalId(e.target.value)}
                  >
                    <option value="">All Hospitals</option>
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
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
                onChange={(e) =>
                  setSelectedAdminId(e.target.value ? Number(e.target.value) : '')
                }
              >
                <option value="">All Leaders</option>
                {admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <div className="mt-6">
            <h3 className="font-semibold mb-2 text-[var(--prussian-blue)] text-center lg:text-left">
              Status Key
            </h3>
            <div className="flex flex-col items-center lg:items-start space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded-full bg-gray-400"></span>
                <span>Not Started</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded-full bg-blue-500"></span>
                <span>Due Today or Upcoming</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded-full bg-red-600"></span>
                <span>Overdue</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded-full bg-green-600"></span>
                <span>Up-To-Date</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded-full bg-yellow-400"></span>
                <span>Consideration</span>
              </div>
            </div>
          </div>


        </div>


          {/* Admin Buttons */}
          {!user?.is_staff && (
            <div className="w-full lg:w-1/3 bg-white border border-[var(--border-muted)] shadow-sm rounded-xl p-6 h-fit">
              <div className="flex flex-col gap-3">
                <button className="btn w-full" onClick={() => navigate('/discharged')}>
                  View Discharged Patients
                </button>
                 <button className="btn w-full" onClick={() => navigate('/archived')}>
                  View Archived Patients
                </button>
                {!user?.is_super_admin && (
                <button className="btn w-full" onClick={() => navigate('/add-patient')}>
                  + Add Patient
                </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status Messages */}
        {(patientLoading || adminLoading) && (
          <BlueLoader />
        )}
        {error && (
          <p className="mt-6 text-red-600 text-center">
            {typeof error === 'string' ? error : 'Error occurred'}
          </p>
        )}

      
      </main>

      <Footer />
    </div>
  );
};

export default Patients;
