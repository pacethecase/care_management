import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loadPatientsByAlgorithm } from "../redux/slices/algorithmSlice";
import { RootState } from "../redux/store";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import type { AppDispatch } from "../redux/store";
import React from "react";
import { loadHospitals } from "../redux/slices/hospitalSlice";
interface AlgorithmType {
  algorithm: "Behavioral" | "Guardianship" | "LTC";
}

const cssVarMap: Record<AlgorithmType["algorithm"], string> = {
  Behavioral: "var(--algo-behavioral)",
  Guardianship: "var(--algo-guardianship)",
  LTC: "var(--algo-ltc)",
};

// -------------------------------------------------------------------

const PatientCard = React.memo(
  ({
    patient,
    algorithm,
    onClick,
  }: {
    patient: any;
    algorithm: AlgorithmType["algorithm"];
    onClick: () => void;
  }) => (
    <div
      className="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:shadow-xl transition"
      style={{
        borderLeft: `5px solid ${cssVarMap[algorithm]}`,
      }}
      onClick={onClick}
    >
      <h2 className="mt-2 text-xl font-semibold text-gray-800">
        {patient.last_name}, {patient.first_name}
      </h2>

      <div className="text-sm text-gray-600 mt-3">
        <p>Room: {patient.room_no}</p>
        <p>DOB: {patient.birth_date}</p>

        <p>
          Admitted On:{" "}
          {patient.admitted_date
            ? new Date(patient.admitted_date).toLocaleDateString()
            : "N/A"}
        </p>

        <p>
          System Entry:{" "}
          {patient.created_at
            ? new Date(patient.created_at).toLocaleDateString()
            : "N/A"}
        </p>

        <p>Hospital: {patient.hospital_name || "—"}</p>
      </div>
    </div>
  )
);

// ======================================================================

const AlgorithmPatients = () => {
  const { algorithm } = useParams();
  const algo = algorithm as AlgorithmType["algorithm"];

  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname + location.search;

  const { patientsByAlgorithm, loadingCounts, loadingPatients, error } =
    useSelector((state: RootState) => state.algorithms);

  const { hospitals } = useSelector((s: RootState) => s.hospitals);
  const user = useSelector((s: RootState) => s.user.user);

  const [currentPage, setCurrentPage] = useState(1);
  const [hospitalId, setHospitalId] = useState("");

  const patientsPerPage = 9;


 useEffect(() => {
  if (algorithm) {
    dispatch(
      loadPatientsByAlgorithm({
        algorithm,
        hospitalId: hospitalId || undefined,
      })
    );
    setCurrentPage(1);
  }
}, [dispatch, algorithm, hospitalId]);

  
  useEffect(() => {
    if (user?.is_super_admin) dispatch(loadHospitals());
  }, [dispatch, user]);


  const currentPatients = useMemo(() => {
    const start = (currentPage - 1) * patientsPerPage;
    return patientsByAlgorithm.slice(start, start + patientsPerPage);
  }, [patientsByAlgorithm, currentPage]);

  const handleClick = (id: number) => {
    navigate(`/patients/${id}/tasks`, { state: { from: currentPath } });
  };

  const totalPages = Math.ceil(patientsByAlgorithm.length / patientsPerPage);

  if (loadingCounts || loadingPatients) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral">
      <Navbar />

       <div className="container p-6 mx-auto">

        <div className="flex justify-between items-center mb-4">

          <h1 className="text-3xl font-bold text-[var(--prussian-blue)]">
            {algorithm} Patients
          </h1>

         
         {user?.is_super_admin && (
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

            <div className="flex justify-between items-center mt-6">
              <button
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300"
              >
                Previous
              </button>

              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default AlgorithmPatients;
