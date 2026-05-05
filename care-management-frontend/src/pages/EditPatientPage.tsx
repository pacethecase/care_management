// src/pages/EditPatientPage.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams, Link } from "react-router-dom";
import { fetchPatientById, updatePatient } from "../redux/slices/patientSlice";
import { fetchStaffs } from "../redux/slices/userSlice";
import { RootState, AppDispatch } from "../redux/store";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BlueLoader from "../components/BlueLoader";
import Select from "react-select";
import AlgorithmSelection from "../components/AlgorithmSelection";
import { reactSelectStyles } from "../reactSelectStyles";
import { toast } from "react-toastify";
import { useHospitalTimezone } from "../hooks/timezone";
import { DateTime } from "luxon";

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
  // FIX: selected_algorithms sent explicitly so backend can diff old vs new
  selected_algorithms: string[];
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

const EditPatientPage = () => {
  const dispatch   = useDispatch<AppDispatch>();
  const navigate   = useNavigate();
  const { patientId } = useParams<{ patientId: string }>();

  const staffs  = useSelector((s: RootState) => s.user.staffs);
  const patient = useSelector((s: RootState) => s.patients.selectedPatient);
  const { user } = useSelector((s: RootState) => s.user);
  const { timezone } = useHospitalTimezone();

  const [isSubmitting, setIsSubmitting] = useState(false);
  // FIX: age computed from birth_date — not stored in form state
  const [displayAge, setDisplayAge] = useState<number | null>(null);

  const [formData, setFormData] = useState<FormData>({
    first_name: "",
    last_name: "",
    birth_date: "",
    admitted_date: "",
    roomNo: "",
    mrn: "",
    medical_info: "",
    assignedStaffIds: [],
    selected_algorithms: [],
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
    if (patientId) {
      dispatch(fetchPatientById(Number(patientId)));
      dispatch(fetchStaffs({}));
    }
  }, [dispatch, patientId]);

  // Populate form when patient loads
  useEffect(() => {
    if (!patient) return;

    const assignedStaffIds: StaffAccess[] =
      patient.assigned_staff?.map((s: any) => ({
        id: String(s.id),
        access_level: s.access_level || "view",
      })) || [];

    // FIX: use active_algorithms from patient_algorithms table (not selected_algorithms)
    const activeAlgorithms = patient.active_algorithms || [];

    // FIX: admitted_date from DB is UTC ISO — convert to local for datetime-local input
    // datetime-local input needs "YYYY-MM-DDTHH:mm" in local time
    const admittedLocal = patient.admitted_date
      ? DateTime.fromISO(patient.admitted_date, { zone: "utc" })
          .setZone(timezone)
          .toFormat("yyyy-MM-dd'T'HH:mm")
      : "";

    setFormData({
      first_name:    patient.first_name || "",
      last_name:     patient.last_name  || "",
      birth_date:    patient.birth_date || "",
      admitted_date: admittedLocal,
      roomNo:        patient.room_no    || "",
      mrn:           patient.mrn        || "",
      medical_info:  patient.medical_info || "",
      assignedStaffIds,
      selected_algorithms: activeAlgorithms,
      is_behavioral:              patient.is_behavioral              || false,
      is_restrained:              patient.is_restrained              || false,
      is_geriatric_psych_available: patient.is_geriatric_psych_available || false,
      is_behavioral_team:         patient.is_behavioral_team         || false,
      is_ltc:                     patient.is_ltc                     || false,
      is_ltc_medical:             patient.is_ltc_medical             || false,
      is_ltc_financial:           patient.is_ltc_financial           || false,
      is_guardianship:            patient.is_guardianship            || false,
      is_guardianship_financial:  patient.is_guardianship_financial  || false,
      is_guardianship_person:     patient.is_guardianship_person     || false,
      is_guardianship_emergency:  patient.is_guardianship_emergency  || false,
    });
  }, [patient, timezone]);

  // Compute display age from birth_date (UI only)
  useEffect(() => {
    if (!formData.birth_date) { setDisplayAge(null); return; }
    const [year, month, day] = formData.birth_date.split("-").map(Number);
    const today = new Date();
    let age = today.getFullYear() - year;
    const passed = today.getMonth() + 1 > month ||
      (today.getMonth() + 1 === month && today.getDate() >= day);
    if (!passed) age--;
    setDisplayAge(age >= 0 ? age : 0);
  }, [formData.birth_date]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const validateForm = () => {
    if (!formData.first_name || !formData.last_name || !formData.birth_date ||
        !formData.roomNo || !formData.mrn) {
      toast.warn("Please fill in all required fields.");
      return false;
    }
    if (!formData.assignedStaffIds.length) {
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
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);

      // FIX: build selected_algorithms from boolean flags — single source of truth
      // This is what the backend uses to diff old vs new algorithms
      const selected_algorithms: string[] = [];
      if (formData.is_behavioral)  selected_algorithms.push("Behavioral");
      if (formData.is_guardianship) selected_algorithms.push("Guardianship");
      if (formData.is_ltc)          selected_algorithms.push("LTC");

      // FIX: convert admitted_date from local timezone back to UTC for backend
      const admittedDateUTC = formData.admitted_date
        ? DateTime.fromISO(formData.admitted_date, { zone: timezone }).toUTC().toISO()
        : undefined;

      // Prompt for reason if staff changed (only for non-admin)
      const previousStaffIds = patient?.assigned_staff?.map((s) => String(s.id)).sort() || [];
      const currentStaffIds  = formData.assignedStaffIds.map((s) => s.id).sort();
      const staffChanged     = previousStaffIds.join(",") !== currentStaffIds.join(",");

      let reason: string | undefined;
      if (staffChanged && user?.role === "staff") {
        const input = window.prompt("Please provide a reason for changing assigned staff:");
        if (!input?.trim()) {
          toast.error("Reason is required when changing staff assignments.");
          setIsSubmitting(false);
          return;
        }
        reason = input.trim();
      }

      await dispatch(
        updatePatient({
          id: Number(patientId),
          version: patient!.version,
          data: {
            ...formData,
            admitted_date:       admittedDateUTC,
            selected_algorithms,
            // FIX: age not sent — computed server-side
            updated_at:          patient?.updated_at,
            ...(reason ? { reason } : {}),
            assignedStaffIds: formData.assignedStaffIds.map((s) => ({
              staff_id:     s.id,
              access_level: s.access_level,
            })),
          },
        })
      ).unwrap();

      toast.success("Patient updated successfully!");
      navigate("/patients");

    } catch (err: any) {
      const message = typeof err === "string" ? err : err?.error || "Failed to update patient.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const staffOptions = useMemo(
    () => staffs.map((s) => ({ value: s.id, label: s.name })),
    [staffs]
  );

  if (!patient) return <BlueLoader />;

  return (
    <div className="flex flex-col min-h-screen text-white">
      <Navbar />
      <main className="flex-grow container mx-auto px-6 py-10">

        <div className="flex justify-between items-center text-[var(--prussian-blue)] mb-6">
          <h3 className="text-3xl font-semibold">Edit Patient</h3>
          <Link to="/patients" className="hover:underline font-medium text-sm">
            ← Back to Patients
          </Link>
        </div>

        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div>
              <label className="block font-medium">First Name*</label>
              <input type="text" name="first_name" value={formData.first_name}
                onChange={handleChange}
                className="bg-white text-black border rounded py-2 px-3 w-full" />
            </div>

            <div>
              <label className="block font-medium">Last Name*</label>
              <input type="text" name="last_name" value={formData.last_name}
                onChange={handleChange}
                className="bg-white text-black border rounded py-2 px-3 w-full" />
            </div>

            <div>
              <label className="block font-medium">Birth Date*</label>
              <input type="date" name="birth_date" value={formData.birth_date}
                onChange={handleChange}
                className="bg-white text-black border rounded py-2 px-3 w-full" />
            </div>

            {/* FIX: age display only — not in form state, not sent to backend */}
            <div>
              <label className="block font-medium">Age (calculated)</label>
              <input type="number" value={displayAge ?? ""} readOnly
                className="bg-gray-100 text-black border rounded py-2 px-3 w-full cursor-not-allowed"
                placeholder="Auto-calculated" />
            </div>

            <div>
              <label className="block font-medium">Admitted Date</label>
              <input type="datetime-local" name="admitted_date"
                value={formData.admitted_date}
                onChange={handleChange}
                className="bg-white text-black border rounded py-2 px-3 w-full" />
              <p className="text-xs text-gray-400 mt-1">
                Time is in hospital timezone ({timezone})
              </p>
            </div>

            <div>
              <label className="block font-medium">MRN*</label>
              <input type="text" name="mrn" value={formData.mrn}
                onChange={handleChange}
                className="bg-white text-black border rounded py-2 px-3 w-full" />
            </div>

            <div>
              <label className="block font-medium">Room #*</label>
              <input type="text" name="roomNo" value={formData.roomNo}
                onChange={handleChange}
                className="bg-white text-black border rounded py-2 px-3 w-full" />
            </div>

            <div className="md:col-span-2">
              <label className="block font-medium">Medical Info</label>
              <textarea name="medical_info" value={formData.medical_info}
                onChange={handleChange}
                className="bg-white text-black border rounded py-2 px-3 w-full" />
            </div>

            {/* Staff assignment */}
            <div className="md:col-span-2 text-black">
              <label className="block text-white font-medium mb-2">Assign Staff</label>
              <Select
                styles={reactSelectStyles}
                options={staffOptions.filter(
                  (opt) => !formData.assignedStaffIds.some((st) => st.id === String(opt.value))
                )}
                placeholder="Add staff..."
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

              {formData.assignedStaffIds.map((staff, index) => {
                const staffName = staffs.find((s) => String(s.id) === staff.id)?.name || "Unknown";
                return (
                  <div key={staff.id}
                    className="flex justify-between items-center bg-white rounded-xl p-3 mt-3 border border-gray-200">
                    <div>
                      <div className="font-semibold text-gray-900">{staffName}</div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        staff.access_level === "edit"
                          ? "bg-green-100 text-green-700 border border-green-300"
                          : "bg-blue-100 text-blue-700 border border-blue-300"
                      }`}>
                        {staff.access_level === "edit" ? "Edit Access" : "View Only"}
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <select className="border rounded px-2 py-1 text-sm"
                        value={staff.access_level}
                        onChange={(e) => {
                          const newLevel = e.target.value as "view" | "edit";
                          setFormData((prev) => ({
                            ...prev,
                            assignedStaffIds: prev.assignedStaffIds.map((st, i) =>
                              i === index ? { ...st, access_level: newLevel } : st
                            ),
                          }));
                        }}>
                        <option value="view">View Only</option>
                        <option value="edit">Edit</option>
                      </select>
                      <button className="text-red-500 font-bold text-lg"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            assignedStaffIds: prev.assignedStaffIds.filter((_, i) => i !== index),
                          }))
                        }>
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="md:col-span-2">
              <AlgorithmSelection formData={formData} setFormData={setFormData} />
            </div>

          </div>

          <button className="btn mt-6" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default EditPatientPage;