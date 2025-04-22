import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { fetchPatients, updatePatient } from '../redux/slices/patientSlice';
import { fetchStaffs } from '../redux/slices/userSlice';
import { RootState } from '../redux/store';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import type { AppDispatch } from '../redux/store';

const EditPatientPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId: string }>(); 

  const staffs = useSelector((state: RootState) => state.user.staffs);
  const { patients } = useSelector((state: RootState) => state.patients);

  const patient = patients.find((p) => p.id === Number(patientId));

  const [formData, setFormData] = useState({
    name: '',
    birth_date: '',
    age: '',
    bedId: '',
    mrn: '',
    medical_info: '',
    assignedStaffId: '',
  });

  useEffect(() => {
    dispatch(fetchPatients());
    dispatch(fetchStaffs());
  }, [dispatch]);

  useEffect(() => {
    if (patient) {
      const birthDate = new Date(patient.birth_date);
      const today = new Date();
      const calculatedAge = Math.floor(
        (today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );

      setFormData({
        name: patient.name || '',
        birth_date: new Date(patient.birth_date).toISOString().split("T")[0],
        age: calculatedAge >= 0 ? calculatedAge.toString() : '',
        bedId: patient.bed_id || '',
        mrn: patient.mrn || '',
        medical_info: patient.medical_info || '',
        assignedStaffId: String(patient.assigned_staff_id || ""),
      });
    }
  }, [patient]);
  useEffect(() => {
    if (formData.birth_date) {
      const birthDate = new Date(formData.birth_date);
      const today = new Date();
      const calculatedAge = Math.floor(
        (today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
  
      setFormData((prev) => ({
        ...prev,
        age: calculatedAge >= 0 ? calculatedAge.toString() : '',
      }));
    }
  }, [formData.birth_date]);
  

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    try {
        dispatch(updatePatient({ id: Number(patientId), data: formData }));
      navigate('/patients');
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  if (!patient) return <p className="p-6">Loading patient info...</p>;

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-light)] text-[var(--text-dark)]">
      <Navbar />
      <main className="flex-grow container mx-auto px-6 py-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-3xl font-semibold text-[var(--deep-navy)]">Edit Patient</h3>
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
             
              />
            </div>

            <div>
              <label className="block font-medium">Age*</label>
              <input
                type="number"
                name="age"
                value={formData.age}
                readOnly
               
              />
            </div>

            <div>
              <label className="block font-medium">MRN</label>
              <input
                type="text"
                name="mrn"
                value={formData.mrn}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block font-medium">Bed ID*</label>
              <input
                type="text"
                name="bedId"
                value={formData.bedId}
                onChange={handleChange}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-medium">Medical Information</label>
              <textarea
                name="medical_info"
                value={formData.medical_info}
                onChange={handleChange}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-medium">Assign Nurse</label>
              <select
                name="assignedStaffId"
                value={formData.assignedStaffId}
                onChange={handleChange}
              >
                <option value="">Select a Nurse</option>
                {staffs?.length > 0 ? (
                  staffs.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))
                ) : (
                  <option disabled>Loading staff...</option>
                )}
              </select>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-6 italic">
            ⚠️ Algorithms are locked after admission and cannot be changed here.
          </p>

          <button className="btn mt-6" onClick={handleSubmit}>
            Save Changes
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default EditPatientPage;
