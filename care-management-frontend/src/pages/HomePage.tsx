import  { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import type { AppDispatch } from '../redux/store';
import DischargeBarriers from "../components/DischargeBarriers"; 
import { useNavigate } from 'react-router-dom';

import { loadPatientCountsByAlgorithm } from "../redux/slices/algorithmSlice"; 
const HomePage = () => {

  const { user } = useSelector((state: RootState) => state.user); 
  

  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate(); 
  // Log the user data whenever it changes
  useEffect(() => {
    dispatch(loadPatientCountsByAlgorithm());
  }, [dispatch]); 


  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral text-hospital-blue">
      <Navbar />
      <div className="container p-4">
        <div className="row">
          <div className="col-md-12">
           <div className="flex justify-between items-center">
        <div>
                <h1 className="text-3xl font-bold mb-4">Welcome</h1>
                {user && <p className="mt-2 text-lg">Hello, {user.name}!</p>}
              </div>
              <button
                onClick={() => navigate("/reports/los")}
                className="px-4 py-2 bg-[var(--prussian-blue)] text-white rounded shadow hover:opacity-90 transition"
              >
                View Length of Stay Dashboard
              </button>
            </div>
                  <div className="mt-4">
                  
                    <DischargeBarriers />
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default HomePage;
