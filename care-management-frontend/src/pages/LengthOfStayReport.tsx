import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchLengthOfStayReport } from "../redux/slices/reportSlice";
import type { RootState, AppDispatch } from "../redux/store";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Link } from "react-router-dom";
import LOSDashboardChart from "../components/LOSDashboardChart";

const LengthOfStayReport = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, error } = useSelector((state: RootState) => state.reports.los);

  const [includeDischarged, setIncludeDischarged] = useState(false);

  useEffect(() => {
    dispatch(fetchLengthOfStayReport({ includeDischarged }));
  }, [dispatch, includeDischarged]);

  const renderCard = (label: string, values: any) => (
    <div className="border rounded p-4 shadow bg-white">
      <h3 className="font-bold text-xl mb-2">{label}</h3>
      <p>Total Patients: {values.count}</p>
      <p>Total Days: {values.totalDays}</p>
      <p>Average LOS: {values.avgDays} days</p>
      <p>Total Cost: ${values.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral text-hospital-blue">
      <Navbar />
      <div className="container mx-auto px-4 py-6">
     <div className="flex items-center justify-between mb-4">
  <h1 className="text-3xl font-bold">Length of Stay Dashboard</h1>

  <div className="flex items-center gap-6">
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={includeDischarged}
        onChange={() => setIncludeDischarged((v) => !v)}
      />
      Include Discharged Patients
    </label>

    <Link to="/homepage" className="hover:underline font-medium text-sm">
      ← Back
    </Link>
  </div>
</div>


        {loading && <p>Loading...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {renderCard("Behavioral", data.behavioral)}
              {renderCard("Guardianship", data.guardianship)}
              {renderCard("LTC", data.ltc)}
            </div>

            <LOSDashboardChart
              data={[
                { workflow: "Behavioral", totalDays: data.behavioral.totalDays, totalCost: data.behavioral.cost },
                { workflow: "Guardianship", totalDays: data.guardianship.totalDays, totalCost: data.guardianship.cost },
                { workflow: "LTC", totalDays: data.ltc.totalDays, totalCost: data.ltc.cost },
              ]}
            />
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default LengthOfStayReport;
