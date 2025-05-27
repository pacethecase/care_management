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

const Patients = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { patients, searchResults, loading: patientLoading, error } = useSelector(
    (state: RootState) => state.patients
  );
  const { user, admins, adminLoading } = useSelector((state: RootState) => state.user);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedAdminId, setSelectedAdminId] = useState<number | ''>('');

  const displayedPatients = searchTerm.trim() ? searchResults : patients;

  // Fetch admins only once if user is admin
  useEffect(() => {
    if (user?.is_admin) {
      dispatch(fetchAdmins());
    }
  }, [dispatch, user?.is_admin]);

  // Fetch patients on change of search term or admin selection
  useEffect(() => {
    const delay = setTimeout(() => {
      if (searchTerm.trim()) {
        dispatch(searchPatients(searchTerm));
      } else if (user?.is_admin && selectedAdminId !== '') {
        dispatch(fetchPatientsByAdmin(Number(selectedAdminId)));
      } else {
        dispatch(fetchPatients());
      }
    }, 300);

    return () => clearTimeout(delay);
  }, [searchTerm, selectedAdminId, dispatch, user]);



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

          {/* Search & Admin Filter */}
          <div className="w-full lg:w-1/3 bg-white border border-[var(--border-muted)] shadow-sm rounded-xl p-6 h-fit space-y-4">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or MRN"
              className="input w-full"
            />

            {user?.is_admin && (
              <>
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
          </div>

          {/* Admin Buttons */}
          {user?.is_admin && (
            <div className="w-full lg:w-1/3 bg-white border border-[var(--border-muted)] shadow-sm rounded-xl p-6 h-fit">
              <div className="flex flex-col gap-3">
                <button className="btn w-full" onClick={() => navigate('/discharged')}>
                  View Discharged Patients
                </button>
                <button className="btn w-full" onClick={() => navigate('/add-patient')}>
                  + Add Patient
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Status Messages */}
        {(patientLoading || adminLoading) && (
          <p className="mt-6 text-[var(--text-muted)] text-center">Loading patients...</p>
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
