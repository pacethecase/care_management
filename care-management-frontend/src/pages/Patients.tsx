import React, { useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PatientsList from '../components/PatientsList';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPatients } from '../redux/slices/patientSlice';
import { RootState } from '../redux/store';

const Patients = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { patients, loading, error } = useSelector((state: RootState) => state.patients);
  const { user } = useSelector((state: RootState) => state.user);

  useEffect(() => {
    if (user) {
      dispatch(fetchPatients());
    }
  }, [dispatch, user]);

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-light)] text-[var(--text-dark)]">
      <Navbar />

      <main className="flex-grow p-6 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Patients List */}
          <PatientsList patients={patients} user={user} />

          {/* Add Patient (Admin Only) */}
          {user?.is_admin && (
            <div className="w-full lg:w-1/3 bg-white border border-[var(--border-muted)] shadow-sm rounded-xl p-6 h-fit">
              <div className="flex flex-col gap-3">
                <button
                  className="btn w-full"
                  onClick={() => navigate("/discharged")}
                >
                  View Discharged Patients
                </button>
                <button
                  className="btn w-full"
                  onClick={() => navigate("/add-patient")}
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
          <p className="mt-6 text-red-600 text-center">{error}</p>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Patients;
