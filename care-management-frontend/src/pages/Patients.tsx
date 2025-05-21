import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PatientsList from '../components/PatientsList';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchPatients,
  searchPatients,
  fetchPatientSummary,
} from '../redux/slices/patientSlice';
import { RootState } from '../redux/store';
import type { AppDispatch } from '../redux/store';

const Patients = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { patients, searchResults, loading, error, patientSummary } = useSelector(
    (state: RootState) => state.patients
  );
  const { user } = useSelector((state: RootState) => state.user);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  const displayedPatients = searchTerm.trim() ? searchResults : patients;

  // Fetch patients on load or when search term changes
  useEffect(() => {
    const delay = setTimeout(() => {
      if (searchTerm.trim()) {
        dispatch(searchPatients(searchTerm));
      } else {
        dispatch(fetchPatients());
      }
    }, 100);

    return () => clearTimeout(delay);
  }, [searchTerm, dispatch]);

  // Fetch patient summary when a patient is selected
  useEffect(() => {
    if (selectedPatientId) {
      dispatch(fetchPatientSummary(selectedPatientId));
    }
  }, [selectedPatientId, dispatch]);

  // Disable background scroll when modal is open
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

          {/* Search Box */}
          <div className="w-full lg:w-1/3 bg-white border border-[var(--border-muted)] shadow-sm rounded-xl p-6 h-fit">
            <div className="flex flex-col gap-3">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or MRN"
                className="input w-full max-w-xl"
              />
            </div>
          </div>

          {/* Admin Buttons */}
          {user?.is_admin && (
            <div className="w-full lg:w-1/3 bg-white border border-[var(--border-muted)] shadow-sm rounded-xl p-6 h-fit">
              <div className="flex flex-col gap-3">
                <button
                  className="btn w-full"
                  onClick={() => navigate('/discharged')}
                >
                  View Discharged Patients
                </button>
                <button
                  className="btn w-full"
                  onClick={() => navigate('/add-patient')}
                >
                  + Add Patient
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Status Messages */}
        {loading && (
          <p className="mt-6 text-[var(--text-muted)] text-center">Loading patients...</p>
        )}
        {error && (
          <p className="mt-6 text-red-600 text-center">
            {typeof error === 'string' ? error : 'Error occurred'}
          </p>
        )}

        {/* Summary Modal */}
        {selectedPatientId && patientSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl p-6 relative">
              {/* Close Button */}
              <button
                onClick={() => setSelectedPatientId(null)}
                className="absolute top-3 right-3 text-gray-500 hover:text-black text-xl"
              >
                &times;
              </button>

              <h3 className="text-xl font-bold mb-4">Patient Summary</h3>

              <div className="card non-blocking font-semibold p-3 mb-6 rounded  text-sm shadow">
                <strong>Barrier to Discharge:</strong><br />
                <span className="font-normal">{patientSummary.barrier_to_discharge}</span>
              </div>
              <div className="card font-semibold  mb-6 p-3 rounded text-sm shadow">
                <strong>Daily Prioritization:</strong><br />
                <span className="font-normal">{patientSummary.daily_prioritization}</span>
              </div>
              <div className="card card-missed  font-semibold mb-6 p-3 rounded text-sm shadow">
                <strong>Incomplete Tasks:</strong><br />
                <span className="font-normal">{patientSummary.incomplete_tasks}</span>
              </div>
              <div className="card card-completed font-semibold  mb-6 p-3 rounded text-sm shadow">
                <strong>Projected Timeline to Completion:</strong><br />
                <span className="font-normal">{patientSummary.projected_completion}</span>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Patients;
