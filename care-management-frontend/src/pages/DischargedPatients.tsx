import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchDischargedPatients } from "../redux/slices/patientSlice";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

const DischargedPatients = () => {
  const dispatch = useDispatch();
  const { dischargedPatients, loading, error } = useSelector((state: RootState) => state.patients);

  useEffect(() => {
    dispatch(fetchDischargedPatients());
  }, [dispatch]);

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-light)] text-[var(--text-dark)]">
      <Navbar />
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-red-600">Discharged Patients</h2>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}
      <ul className="space-y-2">
        {dischargedPatients.map((p) => (
          <li key={p.id} className="border p-4 rounded shadow">
            <strong>{p.name}</strong> — Discharged on {new Date(p.discharge_date).toLocaleDateString()}
            <br />
            <em>{p.discharge_note}</em>
          </li>
        ))}
      </ul>
    </div>
    <Footer />
    </div>
  );
};

export default DischargedPatients;