import  { useEffect, useState } from "react";
import { useParams, useNavigate,useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loadPatientsByAlgorithm } from "../redux/slices/algorithmSlice"; // Import action
import { RootState } from "../redux/store";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import type { AppDispatch } from '../redux/store';


const AlgorithmPatients = () => {
  const { algorithm } = useParams();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { patientsByAlgorithm, loading, error } = useSelector(
    (state: RootState) => state.algorithms
  );
  
  const [currentPage, setCurrentPage] = useState(1);
  const [patientsPerPage] = useState(9); // Max number of patients per page (9 for 3x3 grid)
  const location = useLocation();
  const currentPath = location.pathname + location.search;

  useEffect(() => {
    if (algorithm) {
      dispatch(loadPatientsByAlgorithm(algorithm));
    }
  }, [dispatch, algorithm]);

  const indexOfLastPatient = currentPage * patientsPerPage;
  const indexOfFirstPatient = indexOfLastPatient - patientsPerPage;
  const currentPatients = patientsByAlgorithm.slice(
    indexOfFirstPatient,
    indexOfLastPatient
  );

  const handleClick = (id: number) => {
    navigate(`/patients/${id}/tasks`,{
      state: { from: currentPath }
    });
  };

  const nextPage = () => {
    if (currentPage < Math.ceil(patientsByAlgorithm.length / patientsPerPage)) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral text-hospital-dark">
      <Navbar />
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">{algorithm} Patients</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentPatients.map((p) => (
            <div
              key={p.id}
              className="bg-white p-6 rounded-lg shadow-xl cursor-pointer hover:shadow-2xl transform transition-all hover:scale-105"
              onClick={() => handleClick(p.id)}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-800">{p.last_name},{p.first_name}</h2>
              </div>
              <div className="text-sm text-gray-600 mt-3">
                <p>Bed: {p.bed_id}</p>
                <p>DOB: {new Date(p.birth_date).toLocaleDateString()}</p>
                <p>Admitted On: {p.created_at ? new Date(p.created_at).toLocaleDateString() : "N/A"}</p>
              </div>
            </div>
          ))}
        </div>
        
        {/* Pagination Controls */}
        <div className="flex justify-between items-center mt-6">
          <button
            onClick={prevPage}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {Math.ceil(patientsByAlgorithm.length / patientsPerPage)}
          </span>
          <button
            onClick={nextPage}
            disabled={currentPage === Math.ceil(patientsByAlgorithm.length / patientsPerPage)}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300"
          >
            Next
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AlgorithmPatients;
