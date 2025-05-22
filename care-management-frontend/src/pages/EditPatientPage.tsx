import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { fetchPatients, updatePatient } from '../redux/slices/patientSlice';
import { fetchStaffs } from '../redux/slices/userSlice';
import { RootState } from '../redux/store';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Select from 'react-select';
import AlgorithmSelection from "../components/AlgorithmSelection";
import { reactSelectStyles } from '../reactSelectStyles';
import type { AppDispatch } from '../redux/store';

const EditPatientPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId: string }>();
  const staffs = useSelector((state: RootState) => state.user.staffs);
  const { patients } = useSelector((state: RootState) => state.patients);
  const patient = patients.find((p) => p.id === Number(patientId));

  const [formData, setFormData] = useState<any>({
    first_name: '',
    last_name: '',
    birth_date: '',
    age: '',
    bedId: '',
    mrn: '',
    medical_info: '',
    assignedStaffIds: [] as string[],
    selected_algorithms: [] as string[],

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
    dispatch(fetchPatients());
    dispatch(fetchStaffs());
  }, [dispatch]);

  useEffect(() => {
    if (patient) {
      const birthDate = new Date(patient.birth_date);
      const today = new Date();
      const calculatedAge = Math.floor((today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

      setFormData({
        first_name: patient.first_name || '',
        last_name: patient.last_name || '',
        birth_date: new Date(patient.birth_date).toISOString().split("T")[0],
        age: calculatedAge >= 0 ? calculatedAge.toString() : '',
        bedId: patient.bed_id || '',
        mrn: patient.mrn || '',
        medical_info: patient.medical_info || '',
        assignedStaffIds: patient.assigned_staff?.map((s) => String(s.id)) || [],
        selected_algorithms: patient.selected_algorithms || [],

        is_behavioral: patient.is_behavioral || false,
        is_restrained: patient.is_restrained || false,
        is_geriatric_psych_available: patient.is_geriatric_psych_available || false,
        is_behavioral_team: patient.is_behavioral_team || false,

        is_ltc: patient.is_ltc || false,
        is_ltc_medical: patient.is_ltc_medical || false,
        is_ltc_financial: patient.is_ltc_financial || false,

        is_guardianship: patient.is_guardianship || false,
        is_guardianship_financial: patient.is_guardianship_financial || false,
        is_guardianship_person: patient.is_guardianship_person || false,
        is_guardianship_emergency: patient.is_guardianship_emergency || false,
      });
    }
  }, [patient]);

  useEffect(() => {
    if (formData.birth_date) {
      const birthDate = new Date(formData.birth_date);
      const today = new Date();
      const calculatedAge = Math.floor((today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      setFormData((prev: any) => ({
        ...prev,
        age: calculatedAge >= 0 ? calculatedAge.toString() : '',
        is_geriatric_psych_available: calculatedAge <= 65 ? false : prev.is_geriatric_psych_available,
      }));
    }
  }, [formData.birth_date]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    try {
      const algorithms = [];

    if (formData.is_behavioral) algorithms.push("Behavioral");
    if (formData.is_guardianship) algorithms.push("Guardianship");
    if (formData.is_ltc) algorithms.push("LTC");

    const updatedForm = {
      ...formData,
      selected_algorithms: algorithms,
      age: Number(formData.age),
    };
    await dispatch(updatePatient({ id: Number(patientId), data: updatedForm }));
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
              <label className="block font-medium">First Name*</label>
              <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="block font-medium">Last Name*</label>
              <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="block font-medium">Birth Date*</label>
              <input type="date" name="birth_date" value={formData.birth_date} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="block font-medium">Age</label>
              <input type="number" name="age" value={formData.age} readOnly className="input" />
            </div>
            <div>
              <label className="block font-medium">MRN</label>
              <input type="text" name="mrn" value={formData.mrn} onChange={handleChange} className="input" />
            </div>
            <div>
              <label className="block font-medium">Bed ID*</label>
              <input type="text" name="bedId" value={formData.bedId} onChange={handleChange} className="input" />
            </div>
            <div className="md:col-span-2">
              <label className="block font-medium">Medical Info</label>
              <textarea name="medical_info" value={formData.medical_info} onChange={handleChange} className="input" />
            </div>
            <div className="md:col-span-2">
              <label className="block font-medium">Assign Staff</label>
              <Select
                isMulti
                styles={reactSelectStyles}
                options={staffs.map(s => ({ value: s.id, label: s.name }))}
                value={staffs.filter(s => formData.assignedStaffIds.includes(String(s.id))).map(s => ({
                  value: s.id,
                  label: s.name
                }))}
                onChange={(selectedOptions) => {
                  setFormData((prev: any) => ({
                    ...prev,
                    assignedStaffIds: selectedOptions.map(opt => String(opt.value)),
                  }));
                }}
              />
            </div>

            {/* 🧠 Algorithm Selection */}
            <div className="md:col-span-2">
              <AlgorithmSelection formData={formData} setFormData={setFormData} />
            </div>
          </div>

          <button className="btn mt-6" onClick={handleSubmit}>Save Changes</button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default EditPatientPage;
