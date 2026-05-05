// src/pages/AlgorithmPatients.tsx
import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loadPatientsByAlgorithm } from "../redux/slices/algorithmSlice";
import { RootState, AppDispatch } from "../redux/store";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BlueLoader from "../components/BlueLoader";
import React from "react";
import { loadHospitals } from "../redux/slices/hospitalSlice";
import { useHospitalTimezone } from "../hooks/timezone";


interface AlgorithmType {
  algorithm: "Behavioral" | "Guardianship" | "LTC";
}

const cssVarMap: Record<AlgorithmType["algorithm"], string> = {
  Behavioral:  "var(--algo-behavioral)",
  Guardianship: "var(--algo-guardianship)",
  LTC:          "var(--algo-ltc)",
};


const PatientCard = React.memo(({
  patient, algorithm, onClick,
}: {
  patient: any;
  algorithm: AlgorithmType["algorithm"];
  onClick: () => void;
}) => {
  const { formatDateTime, formatDateOnly } = useHospitalTimezone();

  return (
    <div
      className="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:shadow-xl transition"
      style={{ borderLeft: `5px solid ${cssVarMap[algorithm]}` }}
      onClick={onClick}
    >
      <h2 className="mt-2 text-xl font-semibold text-gray-800">
        {patient.last_name}, {patient.first_name}
      </h2>
      <div className="text-sm text-gray-600 mt-3 space-y-1">
        <p>Room: {patient.room_no || "—"}</p>
        <p>DOB: {formatDateOnly(patient.birth_date)}</p>
        <p>Admitted On: {formatDateTime(patient.admitted_date)}</p>
        <p>System Entry: {formatDateTime(patient.created_at)}</p>
        <p>Hospital: {patient.hospital_name || "—"}</p>
      </div>
    </div>
  );
});

const AlgorithmPatients = () => {
  const { algorithm } = useParams();
  const algo = algorithm as AlgorithmType["algorithm"];

  const dispatch  = useDispatch<AppDispatch>();
  const navigate  = useNavigate();
  const location  = useLocation();
  const currentPath = location.pathname + location.search;

  const { patientsByAlgorithm, loadingCounts, loadingPatients, error } =
    useSelector((s: RootState) => s.algorithms);
  const { hospitals } = useSelector((s: RootState) => s.hospitals);
  const user          = useSelector((s: RootState) => s.user.user);

  const [currentPage, setCurrentPage] = useState(1);
  const [hospitalId,  setHospitalId]  = useState("");
  const patientsPerPage = 9;

  // FIX: role check uses role string
  const isSuperAdmin = user?.role === "super_admin";

  useEffect(() => {
    if (algorithm) {
      dispatch(loadPatientsByAlgorithm({
        algorithm,
        hospitalId: hospitalId || undefined,
      }));
      setCurrentPage(1);
    }
  }, [dispatch, algorithm, hospitalId]);

  useEffect(() => {
    if (isSuperAdmin) dispatch(loadHospitals());
  }, [dispatch, isSuperAdmin]);

  const currentPatients = useMemo(() => {
    const start = (currentPage - 1) * patientsPerPage;
    return patientsByAlgorithm.slice(start, start + patientsPerPage);
  }, [patientsByAlgorithm, currentPage]);

  const totalPages = Math.ceil(patientsByAlgorithm.length / patientsPerPage);

  const handleClick = (id: number) =>
    navigate(`/patients/${id}/tasks`, { state: { from: currentPath } });

  if (loadingCounts || loadingPatients) return <BlueLoader />;
  if (error) return <p className="p-6 text-red-500">{error}</p>;

  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral">
      <Navbar />

      <div className="container p-6 mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-[var(--prussian-blue)]">
            {algorithm} Patients
          </h1>

          {/* FIX: role check */}
          {isSuperAdmin && (
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
          )}
        </div>

        {currentPatients.length === 0 ? (
          <p className="text-gray-500 text-center mt-20">No patients found.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentPatients.map((p) => (
                <PatientCard
                  key={p.id}
                  patient={p}
                  algorithm={algo}
                  onClick={() => handleClick(p.id)}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-6">
                <button
                  onClick={() => setCurrentPage((p) => p - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300"
                >
                  Previous
                </button>
                <span className="text-sm">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default AlgorithmPatients;