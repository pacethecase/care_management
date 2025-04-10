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

  // Accessing patients state, loading, and error from Redux store
  const { patients, loading, error } = useSelector(
    (state: RootState) => state.patients
  );
  const { user, token } = useSelector((state: RootState) => state.user);


  useEffect(() => {
    console.log("User from Redux:", user);
    if (user) {
      dispatch(fetchPatients());
    }
  }, [dispatch, user]);
  

  return (
    <div className="flex flex-col min-h-screen b bg-hospital-neutral">
      <Navbar />
      <div className="p-6">
     

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Patients List Component */}
          <PatientsList patients={patients} />

          {/* Admin: Show Add Patient Button */}
          {user?.is_admin && (
            <div className="w-full lg:w-1/3">
              <button
                className="btn px-6 py-2 rounded w-full"
                onClick={() => navigate('/add-patient')}
              >
                + Add Patient
              </button>
            </div>
          )}
        </div>

        {/* Display loading or error */}
        {loading && <p>Loading patients...</p>}
        {error && <p className="text-red-500">{error}</p>}
      </div>
      <Footer />
    </div>
  );
};

export default Patients;
