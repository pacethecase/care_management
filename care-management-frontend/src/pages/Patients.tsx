import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PatientsList from '../components/PatientsList';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPatients, searchPatients } from '../redux/slices/patientSlice';
import { RootState } from '../redux/store';

const Patients = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { patients, searchResults, loading, error } = useSelector((state: RootState) => state.patients);
  const { user } = useSelector((state: RootState) => state.user);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const delay = setTimeout(() => {
      if (searchTerm.trim()) {
        dispatch(searchPatients(searchTerm));
      } else {
        dispatch(fetchPatients());
      }
    }, 100); 
  
    return () => clearTimeout(delay); // cancel previous timeout on re-type
  }, [searchTerm, dispatch]);
  

  const handleSearch = async () => {
    if (searchTerm.trim()) {
      await dispatch(searchPatients(searchTerm));
    } else {
      dispatch(fetchPatients());
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-light)] text-[var(--text-dark)]">
      <Navbar />

      <main className="flex-grow p-6 max-w-7xl mx-auto">      

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Patients List */}
          <PatientsList patients={searchTerm.trim() ? searchResults : patients} user={user} />
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
          <p className="mt-6 text-red-600 text-center">{typeof error === 'string' ? error : 'Error occurred'}</p>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Patients;
