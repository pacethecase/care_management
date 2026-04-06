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
  import { toast } from "react-toastify";
interface StaffAccess {
  id: string;
  access_level: 'view' | 'edit';
}
interface FormData {
  first_name: string;
  last_name: string;
  birth_date: string;
  admitted_date:string;
  age: number;
  roomNo: string;
  mrn: string;
  medical_info: string;
  assignedStaffIds: StaffAccess[];
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
function calculateAge(dob: string) {
  const [year, month, day] = dob.split("-").map(Number);
  const today = new Date();

  let age = today.getFullYear() - year;

  const hasBirthdayPassed =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);

  if (!hasBirthdayPassed) age--;

  return age;
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
    roomNo: '',
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
 dispatch(fetchStaffs({}));
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
    const calculatedAge = calculateAge(formData.birth_date);

    setFormData((prev) => ({
      ...prev,
      age: calculatedAge >= 0 ? calculatedAge : 0,
      is_geriatric_psych_available:
        calculatedAge > 65 ? prev.is_geriatric_psych_available : false,
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

  const validateForm = () => {
    const requiredFields: (keyof FormData)[] = ['first_name', 'last_name', 'birth_date', 'roomNo'];
    return requiredFields.every((field) => !!formData[field]);
  };


  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.warn("⚠️ Please fill in all required fields.", {
        position: "top-right",
        autoClose: 4000,
      });
      return;
    }

    if (formData.assignedStaffIds.length === 0) {
      toast.error("At least one staff member must be assigned.", {
        position: "top-right",
        autoClose: 5000,
      });
      return;
    }

    const hasEditAccess = formData.assignedStaffIds.some(
      (s) => s.access_level === "edit"
    );
    if (!hasEditAccess) {
      toast.error("At least one assigned staff must have edit access.", {
        position: "top-right",
        autoClose: 5000,
      });
      return;
    }
    if (formData.is_ltc && !formData.is_ltc_medical && !formData.is_ltc_financial) {
      toast.error("LTC selected — please choose at least one: Financial or Medical.");
      return;
    }

    if (formData.is_guardianship && !formData.is_guardianship_financial && !formData.is_guardianship_person) {
      toast.error("Guardianship selected — please choose at least one: Financial or Person.");
      return;
    }

    try {
      setIsSubmitting(true);

      await dispatch(
        addPatient({
          ...formData,
          assignedStaffIds: formData.assignedStaffIds.map((s) => ({
            staff_id: s.id,
            access_level: s.access_level,
          })),
        })
      ).unwrap();

      toast.success("✅ Patient added successfully!", {
        position: "top-right",
        autoClose: 4000,
      });

      navigate("/patients");
    } catch (err: any) {
      console.error("❌ Submit failed:", err);

    if (err?.status === 409 && err?.data?.existingPatient) {
      const existing = err.data.existingPatient;
      const statusText = existing.status
        ? `This patient is currently marked as "${existing.status.toUpperCase()}".`
        : "Status not available.";

      toast.error(
        `🚫 Duplicate patient found: ${existing.first_name} ${existing.last_name} (MRN: ${existing.mrn}). ${statusText}`,
        {
          position: "top-right",
          autoClose: 8000,
        }
      );
    } else {
        toast.error(err?.message || "❌ Failed to add patient.", {
          position: "top-right",
          autoClose: 5000,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };


 const staffOptions = useMemo(() => {
  return staffs
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
                type="datetime-local"
                id="admitted_date"
                className="bg-white text-black placeholder-gray-400 border rounded py-2 px-3"
                name="admitted_date"
                  value={dayjs(formData.admitted_date).format("YYYY-MM-DDTHH:mm")}
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
              <label htmlFor="roomNo" className="block font-medium">Room #*</label>
              <input
                type="text"
                id="roomNo"
                name="roomNo"
                className="bg-white text-black placeholder-gray-400 border rounded py-2 px-3"
                value={formData.roomNo}
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
              <label className="block text-white font-medium mb-2">Assign Staff</label>

              <Select
                key={formData.assignedStaffIds.length} 
                styles={reactSelectStyles}
                options={staffOptions.filter(
                  (opt) => !formData.assignedStaffIds.some((st) => st.id === String(opt.value))
                )}
                placeholder="Select a staff to assign..."
                onChange={(selectedOption) => {
                  if (selectedOption) {
                    setFormData((prev) => ({
                      ...prev,
                      assignedStaffIds: [
                        ...prev.assignedStaffIds,
                        { id: String(selectedOption.value), access_level: 'view' as 'view' | 'edit' },
                      ],
                    }));
                  }
                }}
              />

              {formData.assignedStaffIds.length > 0 && (
                <div className="mt-4 grid gap-3">
                  {formData.assignedStaffIds.map((staff, index) => {
                    const staffName =
                      staffs.find((s) => String(s.id) === staff.id)?.name || 'Unknown';

                    return (
                      <div
                        key={staff.id}
                        className="flex justify-between items-center bg-white rounded-xl p-3 shadow-sm border border-gray-200 transition hover:shadow-md"
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 text-lg">{staffName}</span>
                          <span
                            className={`mt-1 inline-block text-xs font-semibold px-2 py-1 rounded-full ${
                              staff.access_level === 'edit'
                                ? 'bg-green-100 text-green-700 border border-green-300'
                                : 'bg-blue-100 text-blue-700 border border-blue-300'
                            }`}
                          >
                            {staff.access_level === 'edit' ? 'Edit Access' : 'View Only'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            className="border rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            value={staff.access_level}
                            onChange={(e) => {
                              const newAccess = e.target.value as 'view' | 'edit';
                              setFormData((prev) => ({
                                ...prev,
                                assignedStaffIds: prev.assignedStaffIds.map((st, i) =>
                                  i === index ? { ...st, access_level: newAccess } : st
                                ),
                              }));
                            }}
                          >
                            <option value="view">View Only</option>
                            <option value="edit">Edit</option>
                          </select>

                          <button
                            className="text-red-500 hover:text-red-700 text-lg font-bold"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                assignedStaffIds: prev.assignedStaffIds.filter(
                                  (_, i) => i !== index
                                ),
                              }))
                            }
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
