import { useState, useEffect, ChangeEvent, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { addPatient } from '../redux/slices/patientSlice';
import { fetchStaffs } from '../redux/slices/userSlice';
import { RootState, AppDispatch } from '../redux/store';
import AlgorithmSelection from "../components/AlgorithmSelection";
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Select from 'react-select';
import { reactSelectStyles } from '../reactSelectStyles';
import dayjs from 'dayjs';

interface FormData {
  first_name: string;
  last_name: string;
  birth_date: string;
  admitted_date:string;
  age: number;
  bedId: string;
  mrn: string;
  medical_info: string;
  assignedStaffIds: string[];
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
  created_at: string; 
 
}

const AddPatientPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const staffs = useSelector((state: RootState) => state.user.staffs);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    first_name: '',
    last_name: '',
    birth_date: '',
    age: 0,
    bedId: '',
    mrn: '',
    medical_info: '',
    admitted_date:'',
    assignedStaffIds: [],
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
    created_at: '', 
  });

  useEffect(() => {
    dispatch(fetchStaffs());
  }, [dispatch]);

  useEffect(() => {
  const now = dayjs().format("YYYY-MM-DDTHH:mm");
  setFormData((prev) => ({
    ...prev,
    created_at: now,
  }));
}, []);


  useEffect(() => {
    if (formData.birth_date) {
      const birthDate = new Date(formData.birth_date);
      if (!isNaN(birthDate.getTime())) {
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

  const validateForm = () => {
    const requiredFields: (keyof FormData)[] = ['first_name', 'last_name', 'birth_date', 'bedId'];
    return requiredFields.every((field) => !!formData[field]);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      setIsSubmitting(true);
      await dispatch(addPatient({ ...formData})).unwrap();
      navigate('/patients');
    } catch (err: any) {
      alert(`Error: ${err?.message || 'Failed to add patient'}`);
      console.error("Submit failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

 const staffOptions = useMemo(() => {
  return staffs
    .filter((s) => s.is_approved) 
    .map((s) => ({ value: s.id, label: s.name }));
}, [staffs]);


  return (
    <div className="flex flex-col min-h-screen text-white">
      <Navbar />
      <main className="flex-grow container mx-auto px-6 py-10">
        <div className="flex justify-between items-center text-[var(--prussian-blue)] mb-6">
          <h3 className="text-3xl font-semibold">Add New Patient</h3>
          <Link to="/patients" className="hover:underline font-medium text-sm">
            ← Back to Patients
          </Link>
        </div>

        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="first_name" className="block font-medium">First Name*</label>
              <input
                id="first_name"
                className="bg-white text-black placeholder-gray-400 border rounded py-2 px-3"
                placeholder="Enter First Name"
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label htmlFor="last_name" className="block font-medium">Last Name*</label>
              <input
                id="last_name"
                className="bg-white text-black placeholder-gray-400 border rounded py-2 px-3"
                placeholder="Enter Last Name"
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label htmlFor="birth_date" className="block font-medium">Birth Date*</label>
              <input
                type="date"
                id="birth_date"
                className="bg-white text-black placeholder-gray-400 border rounded py-2 px-3"
                name="birth_date"
                value={formData.birth_date}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label htmlFor="age" className="block font-medium">Age*</label>
              <input
                type="number"
                id="age"
                className="bg-white text-black cursor-not-allowed placeholder-gray-400 border rounded py-2 px-3"
                name="age"
                value={formData.age}
                readOnly
              />
            </div>
                    
            <div>
              <label htmlFor="admitted_date" className="block font-medium">Admitted Hospital Date</label>
              <input
                type="date"
                id="admitted_date"
                className="bg-white text-black placeholder-gray-400 border rounded py-2 px-3"
                name="admitted_date"
                value={formData.admitted_date}
                onChange={handleChange}
                required
              />
            </div>

            <div>
            <label htmlFor="created_at" className="block font-medium">
              System Date of Entry
            </label>
            <input
              type="text" 
              id="created_at"
              className="bg-white text-black cursor-not-allowed border rounded py-2 px-3"
              name="created_at"
              value={dayjs(formData.created_at).format("MM/DD/YYYY hh:mm A")} // full timestamp
              readOnly
            />
          </div>
          <div>
              <label htmlFor="mrn" className="block font-medium">MRN*</label>
              <input
                type="text"
                id="mrn"
                className="bg-white text-black placeholder-gray-400 border rounded py-2 px-3"
                name="mrn"
                value={formData.mrn}
                onChange={handleChange}
              />
            </div>


            <div>
              <label htmlFor="bedId" className="block font-medium">Bed ID*</label>
              <input
                type="text"
                id="bedId"
                name="bedId"
                className="bg-white text-black placeholder-gray-400 border rounded py-2 px-3"
                value={formData.bedId}
                onChange={handleChange}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="medical_info" className="block font-medium">Medical Information</label>
              <textarea
                id="medical_info"
                className="bg-white text-black placeholder-gray-400 border rounded py-2 px-3"
                name="medical_info"
                value={formData.medical_info}
                onChange={handleChange}
              />
            </div>

            <div className="md:col-span-2 text-black">
              <label className="block text-white font-medium">Assign Staff</label>
              <Select
                isMulti
                styles={reactSelectStyles}
                options={staffOptions}
                value={staffOptions.filter((opt) => formData.assignedStaffIds.includes(String(opt.value)))}
                onChange={(selectedOptions) => {
                  setFormData((prev) => ({
                    ...prev,
                    assignedStaffIds: selectedOptions.map((opt) => String(opt.value)),
                  }));
                }}
              />
            </div>

            <div className="md:col-span-2">
              <AlgorithmSelection formData={formData} setFormData={setFormData} />
            </div>
          </div>

          <button
            className="btn mt-6"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Adding..." : "Add Patient"}
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AddPatientPage;
