import { useEffect,useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import OpportunityLOSChart from "../components/OpportunityLOSChart";
import { AppDispatch, RootState } from "../redux/store";
import { fetchOpportunityDaysReport } from "../redux/slices/reportSlice";
import { Link } from "react-router-dom";


const OpportunityLOSPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, error } = useSelector((state: RootState) => state.reports.opportunityLOS || {});
  const [includeDischarged, setIncludeDischarged] = useState(false);

  useEffect(() => {
    dispatch(fetchOpportunityDaysReport({ includeDischarged }));
  }, [dispatch, includeDischarged]);

  const renderSummary = (label: string, values: any) => (
    <div className="border rounded p-4 shadow bg-white">
      <h3 className="font-bold text-xl mb-2">{label}</h3>
      <p>Admission Delay: {values.admissionDelay} days</p>
      <p>Task Delay: {values.taskDelay} days</p>
      <p>Total Delay: {values.totalDelay} days</p>
      <p>Estimated Cost: ${values.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral text-hospital-blue">
      <Navbar />
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">Opportunity Length of Stay Summary</h1>
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
              {renderSummary("Behavioral", data.behavioral)}
              {renderSummary("Guardianship", data.guardianship)}
              {renderSummary("LTC", data.ltc)}
            </div>
            <OpportunityLOSChart
              data={[
                {
                  workflow: "Behavioral",
                  ...data.behavioral,
                },
                {
                  workflow: "Guardianship",
                  ...data.guardianship,
                },
                {
                  workflow: "LTC",
                  ...data.ltc,
                },
              ]}
              nationalAverage={data.nationalAverage}
            />
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default OpportunityLOSPage;
