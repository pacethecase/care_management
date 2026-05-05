// src/pages/AddPatientPage.tsx
import { useState, useEffect, ChangeEvent, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import { addPatient } from "../redux/slices/patientSlice";
import { fetchStaffs } from "../redux/slices/userSlice";
import { RootState, AppDispatch } from "../redux/store";
import AlgorithmSelection from "../components/AlgorithmSelection";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BlueLoader from "../components/BlueLoader";
import Select from "react-select";
import { reactSelectStyles } from "../reactSelectStyles";
import { toast } from "react-toastify";



interface StaffAccess {
  id: string;
  access_level: "view" | "edit";
}

interface FormData {
  first_name: string;
  last_name: string;
  birth_date: string;
  admitted_date: string;
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
}

const AddPatientPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const staffs       = useSelector((s: RootState) => s.user.staffs);
  

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    first_name: "",
    last_name: "",
    birth_date: "",
    admitted_date: "",
    roomNo: "",
    mrn: "",
    medical_info: "",
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
  });

  // FIX: age is no longer stored — computed server-side from birth_date
  // We still compute it locally just to display it in the form as a hint
  const [displayAge, setDisplayAge] = useState<number | null>(null);

  useEffect(() => {
    dispatch(fetchStaffs({}));
  }, [dispatch]);

  // Compute display age from birth_date for UI hint only
  useEffect(() => {
    if (!formData.birth_date) { setDisplayAge(null); return; }
    const [year, month, day] = formData.birth_date.split("-").map(Number);
    const today = new Date();
    let age = today.getFullYear() - year;
    const hasBirthdayPassed =
      today.getMonth() + 1 > month ||
      (today.getMonth() + 1 === month && today.getDate() >= day);
    if (!hasBirthdayPassed) age--;
    setDisplayAge(age >= 0 ? age : 0);
  }, [formData.birth_date]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const validateForm = () => {
    if (!formData.first_name || !formData.last_name || !formData.birth_date || !formData.roomNo || !formData.mrn) {
      toast.warn("Please fill in all required fields.");
      return false;
    }
    if (!formData.admitted_date) {
      toast.warn("Please enter the admitted date.");
      return false;
    }
    if (formData.assignedStaffIds.length === 0) {
      toast.error("At least one staff member must be assigned.");
      return false;
    }
    if (!formData.assignedStaffIds.some((s) => s.access_level === "edit")) {
      toast.error("At least one assigned staff must have edit access.");
      return false;
    }
    return true;
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

      toast.success("Patient added successfully!");
      navigate("/patients");

    } catch (err: any) {
      console.error("Submit failed:", err);

      if (err?.status === 409 && err?.data?.existingPatient) {
        const ex = err.data.existingPatient;
        toast.error(
          `Duplicate patient: ${ex.first_name} ${ex.last_name} (MRN: ${ex.mrn}). ` +
          (ex.status ? `Status: ${ex.status}.` : ""),
          { autoClose: 8000 }
        );
      } else {
        toast.error(err?.data?.error || err?.message || "Failed to add patient.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const staffOptions = useMemo(
    () => staffs.map((s) => ({ value: s.id, label: s.name })),
    [staffs]
  );

  if (isSubmitting) return <BlueLoader />;

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
              <label className="block font-medium">First Name*</label>
              <input
                className="bg-white text-black border rounded py-2 px-3 w-full"
                type="text" name="first_name" placeholder="Enter First Name"
                value={formData.first_name} onChange={handleChange} required
              />
            </div>

            <div>
              <label className="block font-medium">Last Name*</label>
              <input
                className="bg-white text-black border rounded py-2 px-3 w-full"
                type="text" name="last_name" placeholder="Enter Last Name"
                value={formData.last_name} onChange={handleChange} required
              />
            </div>

            <div>
              <label className="block font-medium">Birth Date*</label>
              <input
                className="bg-white text-black border rounded py-2 px-3 w-full"
                type="date" name="birth_date"
                value={formData.birth_date} onChange={handleChange} required
              />
            </div>

            {/* FIX: age is read-only display only — not sent to backend */}
            <div>
              <label className="block font-medium">Age (calculated)</label>
              <input
                className="bg-gray-100 text-black border rounded py-2 px-3 w-full cursor-not-allowed"
                type="number"
                value={displayAge ?? ""}
                readOnly
                placeholder="Auto-calculated from birth date"
              />
            </div>

            <div>
              <label className="block font-medium">Admitted Date*</label>
              {/* FIX: datetime-local interpreted as hospital timezone — converted to UTC on submit */}
              <input
                className="bg-white text-black border rounded py-2 px-3 w-full"
                type="datetime-local" name="admitted_date"
                value={formData.admitted_date} onChange={handleChange} required
              />

            </div>

            <div>
              <label className="block font-medium">MRN*</label>
              <input
                className="bg-white text-black border rounded py-2 px-3 w-full"
                type="text" name="mrn"
                value={formData.mrn} onChange={handleChange}
              />
            </div>

            <div>
              <label className="block font-medium">Room #*</label>
              <input
                className="bg-white text-black border rounded py-2 px-3 w-full"
                type="text" name="roomNo"
                value={formData.roomNo} onChange={handleChange} required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-medium">Medical Information</label>
              <textarea
                className="bg-white text-black border rounded py-2 px-3 w-full"
                name="medical_info"
                value={formData.medical_info} onChange={handleChange}
              />
            </div>

            {/* Staff assignment */}
            <div className="md:col-span-2 text-black">
              <label className="block text-white font-medium mb-2">Assign Staff</label>
              <Select
                key={formData.assignedStaffIds.length}
                styles={reactSelectStyles}
                options={staffOptions.filter(
                  (opt) => !formData.assignedStaffIds.some((st) => st.id === String(opt.value))
                )}
                placeholder="Select a staff to assign..."
                onChange={(selected) => {
                  if (selected) {
                    setFormData((prev) => ({
                      ...prev,
                      assignedStaffIds: [
                        ...prev.assignedStaffIds,
                        { id: String(selected.value), access_level: "view" },
                      ],
                    }));
                  }
                }}
              />

              {formData.assignedStaffIds.length > 0 && (
                <div className="mt-4 grid gap-3">
                  {formData.assignedStaffIds.map((staff, index) => {
                    const staffName = staffs.find((s) => String(s.id) === staff.id)?.name || "Unknown";
                    return (
                      <div
                        key={staff.id}
                        className="flex justify-between items-center bg-white rounded-xl p-3 shadow-sm border border-gray-200"
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900">{staffName}</span>
                          <span className={`mt-1 text-xs font-semibold px-2 py-1 rounded-full ${
                            staff.access_level === "edit"
                              ? "bg-green-100 text-green-700 border border-green-300"
                              : "bg-blue-100 text-blue-700 border border-blue-300"
                          }`}>
                            {staff.access_level === "edit" ? "Edit Access" : "View Only"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            className="border rounded-lg px-3 py-1.5 text-sm bg-gray-50"
                            value={staff.access_level}
                            onChange={(e) => {
                              const newAccess = e.target.value as "view" | "edit";
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
                            className="text-red-500 hover:text-red-700 font-bold text-lg"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                assignedStaffIds: prev.assignedStaffIds.filter((_, i) => i !== index),
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