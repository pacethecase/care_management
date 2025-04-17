import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { addPatient } from '../redux/slices/patientSlice';
import { fetchStaffs } from '../redux/slices/userSlice';
import { RootState } from '../redux/store';
import AlgorithmSelection from "../components/AlgorithmSelection";
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const AddPatientPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const staffs = useSelector((state: RootState) => state.user.staffs);

  const [formData, setFormData] = useState({
    name: '',
    birth_date: '',
    age: '',
    bedId: '',
    mrn: '',
    medical_info: '',
    assignedStaffId: '',
    is_behavioral: false,
    is_restrained: false,
    is_geriatric_psych_available: false,
    is_behavioral_team: false,
    is_ltc: false,
    is_ltc_medical: false,
    is_ltc_financial: false,
    is_guardianship: false,
    is_guardianship_financial: false,
    is_guardianship_person: false,
    is_guardianship_emergency: false,
  });

  useEffect(() => {
    dispatch(fetchStaffs());
  }, [dispatch]);

  useEffect(() => {
    if (formData.birth_date) {
      const birthDate = new Date(formData.birth_date);
      const today = new Date();
      const calculatedAge = Math.floor(
        (today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
      setFormData((prev) => ({
        ...prev,
        age: calculatedAge >= 0 ? calculatedAge : '',
        is_geriatric_psych_available: calculatedAge > 65 ? prev.is_geriatric_psych_available : false,
      }));
    }
  }, [formData.birth_date]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async () => {
    try {
      await dispatch(addPatient(formData)).unwrap();
      setFormData({
        name: '',
        birth_date: '',
        age: '',
        bedId: '',
        mrn:'',
        medical_info: '',
        assignedStaffId: '',
        is_behavioral: false,
        is_restrained: false,
        is_geriatric_psych_available: false,
        is_behavioral_team: false,
        is_ltc: false,
        is_ltc_medical: false,
        is_ltc_financial: false,
        is_guardianship: false,
        is_guardianship_financial: false,
        is_guardianship_person: false,
        is_guardianship_emergency:false,
      });
      navigate('/patients');
    } catch (err) {
      if (err && err.message) {
        alert(`Error: ${err.message}`);
        console.error("Submit failed:", err.message);
      } else {
        console.error("Submit failed (unknown):", err);
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-light)] text-[var(--text-dark)]">
      <Navbar />
      <main className="flex-grow container mx-auto px-6 py-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-3xl font-semibold text-[var(--deep-navy)]">Add New Patient</h3>
          <Link to="/patients" className="text-[var(--funky-orange)] hover:underline font-medium text-sm">
            ← Back to Patients
          </Link>
        </div>

        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block font-medium">Patient Name*</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter patient name"
                required
              />
            </div>

            <div>
              <label className="block font-medium">Birth Date*</label>
              <input
                type="date"
                name="birth_date"
                value={formData.birth_date}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="block font-medium">Age*</label>
              <input
                type="number"
                name="age"
                value={formData.age}
                readOnly
                className="bg-gray-100 cursor-not-allowed"
                placeholder="Auto-calculated"
                required
              />
            </div>
            <div>
              <label className="block font-medium">MRN (Medical Record Number)</label>
              <input
                type="text"
                name="mrn"
                value={formData.mrn}
                onChange={handleChange}
                placeholder="Enter MRN"
                required
              />
            </div>
            <div>
              <label className="block font-medium">Bed ID*</label>
              <input
                type="text"
                name="bedId"
                value={formData.bedId}
                onChange={handleChange}
                placeholder="Enter Bed ID"
                required
              />
            </div>  

            <div className="md:col-span-2">
              <label className="block font-medium">Medical Information</label>
              <textarea
                name="medical_info"
                value={formData.medical_info}
                onChange={handleChange}
                placeholder="Enter medical details"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-medium">Assign Staff</label>
              <select
                name="assignedStaffId"
                value={formData.assignedStaffId}
                onChange={handleChange}
              >
                <option value="">Select a Staff</option>
                {staffs?.length > 0 ? (
                  staffs.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))
                ) : (
                  <option disabled>Loading staffs...</option>
                )}
              </select>
            </div>

            <div className="md:col-span-2">
              <AlgorithmSelection formData={formData} setFormData={setFormData} />
            </div>
          </div>

          <button className="btn mt-6" onClick={handleSubmit}>
            Add Patient
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AddPatientPage;
