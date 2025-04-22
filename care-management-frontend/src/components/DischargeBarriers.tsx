import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loadPatientCountsByAlgorithm } from "../redux/slices/algorithmSlice";
import { RootState, AppDispatch } from "../redux/store";
import { useNavigate } from "react-router-dom";

interface AlgorithmCount {
  algorithm: "Behavioral" | "Guardianship" | "LTC";
  count: number;
}

const DischargeBarriers = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { patientCounts, loading, error } = useSelector((state: RootState) => state.algorithms);

  useEffect(() => {
    dispatch(loadPatientCountsByAlgorithm());
  }, [dispatch]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{String(error)}</div>;

  const cssVarMap: Record<AlgorithmCount["algorithm"], string> = {
    Behavioral: "var(--algo-behavioral)",
    Guardianship: "var(--algo-guardianship)",
    LTC: "var(--algo-ltc)",
  };

  const handleClick = (algorithm: AlgorithmCount["algorithm"]) => {
    navigate(`/algorithms/${algorithm}`);
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">🏥 Discharge Barrier Summary</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {patientCounts.map((item: AlgorithmCount) => (
          <div
            key={item.algorithm}
            className="bg-white shadow-md p-6 rounded-lg flex flex-col items-center justify-between"
            style={{ borderLeft: `5px solid ${cssVarMap[item.algorithm]}` }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: cssVarMap[item.algorithm] }}
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
