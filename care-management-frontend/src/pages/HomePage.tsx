// src/pages/HomePage.tsx
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "../redux/store";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import BlueLoader from "../components/BlueLoader";
import DischargeBarriers from "../components/DischargeBarriers";
import { useNavigate } from "react-router-dom";
import { fetchStarRating } from "../redux/slices/userSlice";
import { loadHospitals } from "../redux/slices/hospitalSlice";
import { loadPatientCountsByAlgorithm } from "../redux/slices/algorithmSlice";

const HomePage = () => {
  const dispatch  = useDispatch<AppDispatch>();
  const navigate  = useNavigate();

  const { user }      = useSelector((s: RootState) => s.user);
  const { hospitals } = useSelector((s: RootState) => s.hospitals);
  const starRatings   = useSelector((s: RootState) => s.user.starRatings);

  const [hospitalId, setHospitalId] = useState("");

  const stars = user?.id ? starRatings[user.id]?.stars ?? 0 : 0;

  // FIX: role checks use role string
  const isSuperAdmin = user?.role === "super_admin";
  const isStaff      = user?.role === "staff";

  useEffect(() => {
    if (isSuperAdmin) dispatch(loadHospitals());
  }, [dispatch, isSuperAdmin]);

  useEffect(() => {
    dispatch(loadPatientCountsByAlgorithm(hospitalId));
  }, [dispatch, hospitalId]);

  useEffect(() => {
    if (isStaff && user?.id) dispatch(fetchStarRating(user.id));
  }, [dispatch, user?.id, isStaff]);

  if (!user) return <BlueLoader />;

  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral text-hospital-blue">
      <Navbar />
      <div className="container p-6 mx-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-4">Welcome</h1>
            <p className="mt-2 text-lg">Hello, {user.name}!</p>
            {/* FIX: role check */}
            {isStaff && (
              <div className="text-lg mt-1">
                Your 30-Day Star Rating:{" "}
                <span className="text-yellow-500">
                  {stars > 0 ? "⭐".repeat(stars) : "–"}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => navigate("/reports/los")}
              className="px-4 py-2 bg-[var(--prussian-blue)] text-white rounded shadow hover:opacity-90 transition"
            >
              View Length of Stay Dashboard
            </button>
            <button
              onClick={() => navigate("/reports/opportunitysummary")}
              className="px-4 py-2 bg-[var(--prussian-blue)] text-white rounded shadow hover:opacity-90 transition"
            >
              View Opportunity Days Summary
            </button>
            {/* FIX: role check — staff cannot see staff performance report */}
            {!isStaff && (
              <button
                onClick={() => navigate("/reports/staffPerformance")}
                className="px-4 py-2 bg-[var(--prussian-blue)] text-white rounded shadow hover:opacity-90 transition"
              >
                View Staff Performance Report
              </button>
            )}
          </div>
        </div>

        {/* Hospital filter — super_admin only */}
        {isSuperAdmin && (
          <div className="flex justify-end mt-4">
            <div>
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
          </div>
        )}

        <div className="mt-4">
          <DischargeBarriers />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default HomePage;