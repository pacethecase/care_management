import  { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import type { AppDispatch } from '../redux/store';
import DischargeBarriers from "../components/DischargeBarriers"; 
import { useNavigate } from 'react-router-dom';
import { fetchStarRating } from "../redux/slices/userSlice";

import { loadPatientCountsByAlgorithm } from "../redux/slices/algorithmSlice"; 
const HomePage = () => {

  const { user } = useSelector((state: RootState) => state.user); 
  

  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate(); 
  // Log the user data whenever it changes
  useEffect(() => {
    dispatch(loadPatientCountsByAlgorithm());
  }, [dispatch]); 


  useEffect(() => {
  if (user?.is_staff) dispatch(fetchStarRating(user.id));
}, [dispatch, user]);

const starRatings = useSelector((state: RootState) => state.user.starRatings);
const stars = user?.id ? starRatings[user.id]?.stars || 0 : 0;

  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral text-hospital-blue">
      <Navbar />
      <div className="container p-6 mx-auto">
        <div className="row">
          <div className="col-md-12">
           <div className="flex justify-between items-center">
        <div>
                <h1 className="text-3xl font-bold mb-4">Welcome</h1>
                {user && <p className="mt-2 text-lg">Hello, {user.name}!</p>}
                {user && user.is_staff && (
                <div className="text-lg mt-1">
                  Your 30-Day Star Rating: <span className="text-yellow-500">{'⭐'.repeat(stars) || "–"}</span>
                </div>
              )}
              </div>
              <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => navigate("/reports/los")}
              className="px-4 py-2 bg-[var(--prussian-blue)] text-white rounded shadow hover:opacity-90 transition w-fit"
            >
              View Length of Stay Dashboard
            </button>
            <button
              onClick={() => navigate("/reports/opportunitysummary")}
              className="px-4 py-2 bg-[var(--prussian-blue)] text-white rounded shadow hover:opacity-90 transition w-fit"
            >
              View Opportunity Days Summary
            </button>
            {user?.is_super_admin && (
            <button
              onClick={() => navigate("/reports/staffPerformance")}
              className="px-4 py-2 bg-[var(--prussian-blue)] text-white rounded shadow hover:opacity-90 transition w-fit"
            >
              View Staff Performance Report
            </button>
          )}
          </div>
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
