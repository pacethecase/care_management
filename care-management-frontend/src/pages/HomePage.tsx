import  { useEffect,useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import type { AppDispatch } from '../redux/store';
import DischargeBarriers from "../components/DischargeBarriers"; 
import { useNavigate } from 'react-router-dom';
import { fetchStarRating } from "../redux/slices/userSlice";
import { loadHospitals } from '../redux/slices/hospitalSlice';
import { loadPatientCountsByAlgorithm } from "../redux/slices/algorithmSlice"; 
const HomePage = () => {

  const { user } = useSelector((state: RootState) => state.user); 
  const { hospitals } = useSelector((s: RootState) => s.hospitals);
  const [hospitalId, setHospitalId] = useState("");

  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate(); 
  // Log the user data whenever it changes
  
  useEffect(() => {
    if (user?.is_super_admin) {
      dispatch(loadHospitals());
    }
  }, [dispatch, user]);
  useEffect(() => {
    dispatch(loadPatientCountsByAlgorithm(hospitalId));
  }, [dispatch, hospitalId]);

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
                  {!user?.is_staff && (
                  <button
                    onClick={() => navigate("/reports/staffPerformance")}
                    className="px-4 py-2 bg-[var(--prussian-blue)] text-white rounded shadow hover:opacity-90 transition w-fit"
                  >
                    View Staff Performance Report
                  </button>
                )}
               </div>
            </div>
            <div className="flex justify-end items-center mt-4">
               {user?.is_super_admin && (
                      <div className="mb-4">
                        <label className="block text-xs text-gray-500 mb-1">Hospital</label>
                        <select
                          value={hospitalId}
                          onChange={(e) => setHospitalId(e.target.value)}
                          className="border rounded-md px-2 py-1 text-sm w-48"
                        >
                          <option value="">All Hospitals</option>
                          {hospitals?.map((h: any) => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
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
