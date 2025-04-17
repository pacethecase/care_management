import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loadPatientCountsByAlgorithm } from "../redux/slices/algorithmSlice"; // Import the action
import { RootState } from "../redux/store";
import { useNavigate } from "react-router-dom";

const DischargeBarriers = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { patientCounts, loading, error } = useSelector(
    (state: RootState) => state.algorithms
  );

  useEffect(() => {
    dispatch(loadPatientCountsByAlgorithm());
  }, [dispatch]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  const handleClick = (algorithm: string) => {
    navigate(`/algorithms/${algorithm}`);
  };

  // Colors for the three algorithms
  const colors = {
    Behavioral: "#F7D140", // Yellow
    Guardianship: "#28A745", // Green
    LTC: "#003366", // Blue
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">🏥 Discharge Barrier Summary</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {patientCounts.map((item) => (
          <div
            key={item.algorithm}
            className="bg-white shadow-md p-6 rounded-lg flex flex-col items-center justify-between"
            style={{ borderLeft: `5px solid ${colors[item.algorithm]}` }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: colors[item.algorithm] }}
            >
              <span className="text-white font-bold">{item.algorithm[0]}</span>
            </div>
            <h3 className="text-lg font-semibold mt-4">{item.algorithm}</h3>
            <p className="text-md text-gray-600">Current patients</p>
            <p className="text-2xl font-bold text-gray-800">{item.count}</p>
            <button
              onClick={() => handleClick(item.algorithm)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-full text-sm hover:bg-blue-700"
            >
              View details
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DischargeBarriers;
