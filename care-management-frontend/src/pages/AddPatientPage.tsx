import { useState, useEffect, ChangeEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { addPatient } from '../redux/slices/patientSlice';
import { fetchStaffs } from '../redux/slices/userSlice';
import { RootState, AppDispatch } from '../redux/store';
import AlgorithmSelection from "../components/AlgorithmSelection";
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

interface FormData {
  name: string;
  birth_date: string;
  age: number;
  bedId: string;
  mrn: string;
  medical_info: string;
  assignedStaffId: string;
  is_behavioral: boolean;
  is_restrained: boolean;
  is_geriatric_psych_available: boolean;
  is_behavioral_team: boolean;
  is_ltc: boolean;
  is_ltc_medical: boolean;
  is_ltc_financial: boolean;
  is_guardianship: boolean;
  is_guardianship_financial: boolean;
  is_guardianship_person: boolean;
  is_guardianship_emergency: boolean;
}

const AddPatientPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const staffs = useSelector((state: RootState) => state.user.staffs);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    birth_date: '',
    age: 0,
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
        age: calculatedAge >= 0 ? calculatedAge : 0,
        is_geriatric_psych_available: calculatedAge > 65 ? prev.is_geriatric_psych_available : false,
      }));
    }
  }, [formData.birth_date]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';

    setFormData((prev) => ({
      ...prev,
      [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async () => {
    try {
      const admittedDate = new Date().toISOString(); 
      dispatch(addPatient({ ...formData, admitted_date: admittedDate }));

      navigate('/patients');
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Failed to add patient'}`);
      console.error("Submit failed:", err);
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
