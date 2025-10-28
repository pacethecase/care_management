import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { fetchPatientById, updatePatient } from '../redux/slices/patientSlice';
import { fetchStaffs } from '../redux/slices/userSlice';
import { RootState } from '../redux/store';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Select from 'react-select';
import AlgorithmSelection from "../components/AlgorithmSelection";
import { reactSelectStyles } from '../reactSelectStyles';
import type { AppDispatch } from '../redux/store';
import dayjs from 'dayjs';
import { toast } from 'react-toastify';

interface StaffAccess {
  id: string;
  access_level: 'view' | 'edit';
}

const EditPatientPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId: string }>();
  const staffs = useSelector((state: RootState) => state.user.staffs);
  const patient = useSelector((state: RootState) => state.patients.selectedPatient);
  const { user } = useSelector((state: RootState) => state.user);

  const [formData, setFormData] = useState<any>({
    first_name: '',
    last_name: '',
    birth_date: '',
    age: '',
    roomNo: '',
    mrn: '',
    medical_info: '',
    assignedStaffIds: [] as { id: string; access_level: 'view' | 'edit' }[],
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
      if (patientId) {
        dispatch(fetchPatientById(Number(patientId)));
        dispatch(fetchStaffs());
      }
    }, [dispatch, patientId]);

  useEffect(() => {
    if (patient) {
      const birthDate = new Date(patient.birth_date);
      const today = new Date();
      const calculatedAge = Math.floor((today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      const assignedStaffIds: StaffAccess[] =
        patient.assigned_staff?.map((s: any) => ({
          id: String(s.id),
          access_level: s.access_level || 'view',
        })) || [];

      setFormData({
        first_name: patient.first_name || '',
        last_name: patient.last_name || '',
        birth_date: new Date(patient.birth_date).toISOString().split("T")[0],
        age: calculatedAge >= 0 ? calculatedAge.toString() : '',
        roomNo: patient.room_no || '',
        mrn: patient.mrn || '',
        medical_info: patient.medical_info || '',
        assignedStaffIds,
        selected_algorithms: patient.selected_algorithms || [],
        admitted_date: patient.admitted_date || '',
        created_at: patient.created_at || '',

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
      const algorithms: string[] = [];
      if (formData.is_behavioral) algorithms.push("Behavioral");
      if (formData.is_guardianship) algorithms.push("Guardianship");
      if (formData.is_ltc) algorithms.push("LTC");

      // Compare staff assignments
      const previousStaffIds =
        patient?.assigned_staff?.map((s) => String(s.id)) || [];
      const currentStaffIds = formData.assignedStaffIds;
      const staffChanged =
        previousStaffIds.sort().join(",") !== currentStaffIds.sort().join(",");

      let reason: string | undefined;
      if (!user?.is_admin && !user?.is_super_admin && staffChanged) {
        const input = window.prompt(
          "Please provide a reason for changing assigned staff:"
        );
        reason = input ?? undefined;
        if (!reason || reason.trim() === "") {
          toast.error("Reason is required when changing staff assignments.");
          return;
        }
      }

      const updatedForm = {
        ...formData,
        selected_algorithms: algorithms,
        age: Number(formData.age),
        updated_at: patient?.updated_at,
        ...(reason ? { reason } : {}),
        assignedStaffIds: formData.assignedStaffIds.map((s: StaffAccess) => ({
          staff_id: s.id,
          access_level: s.access_level,
        })),
      };

      await dispatch(updatePatient({ id: Number(patientId), data: updatedForm })).unwrap();



      toast.success("✅ Patient updated successfully");
      navigate("/patients");
    } catch (err: any) {
      const errorMsg = err?.data?.error;
      if (errorMsg?.includes("already updated")) {
        toast.error(
          "⚠️ Someone else already updated this patient. Please refresh and try again."
        );
      } else if (errorMsg?.includes("Reason is required")) {
        toast.error("Reason is required for this update.");
      } else {
        toast.error("❌ Failed to update patient.");
      }
      console.error("Update failed:", err);
    }
  };


  if (!patient) return <p className="p-6">Loading patient info...</p>;

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
              <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} className="bg-white text-black placeholder-gray-400 border rounded py-2 px-3" />
            </div>
            <div>
              <label className="block font-medium">Last Name*</label>
              <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="bg-white text-black placeholder-gray-400 border rounded py-2 px-3" />
            </div>
            <div>
              <label className="block font-medium">Birth Date*</label>
              <input type="date" name="birth_date" value={formData.birth_date} onChange={handleChange} className="bg-white text-black placeholder-gray-400 border rounded py-2 px-3" />
            </div>
            <div>
              <label className="block font-medium">Age</label>
              <input type="number" name="age" value={formData.age} readOnly className="bg-white text-black placeholder-gray-400 border rounded py-2 px-3" />
            </div>
             <div>
                          <label  className="block font-medium">Admitted Hospital Date</label>
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
            <label className="block font-medium">System Date of Entry</label>
            <input
              type="datetime-local"
              name="created_at"
              value={
                formData.created_at
                  ? dayjs(formData.created_at).format("YYYY-MM-DDTHH:mm")
                  : ""
              }
              readOnly
              className="input text-black bg-gray-100 cursor-not-allowed"
            />

          </div>
           <div>
              <label className="block font-medium">MRN</label>
              <input type="text" name="mrn" value={formData.mrn} onChange={handleChange} className="bg-white text-black placeholder-gray-400 border rounded py-2 px-3ut" />
            </div>

            <div>
              <label className="block font-medium">Room #*</label>
              <input type="text" name="roomNo" value={formData.roomNo} onChange={handleChange} className="bg-white text-black placeholder-gray-400 border rounded py-2 px-3" />
            </div>
            <div className="md:col-span-2">
              <label className="block font-medium">Medical Info</label>
              <textarea name="medical_info" value={formData.medical_info} onChange={handleChange} className="bg-white text-black placeholder-gray-400 border rounded py-2 px-3" />
            </div>
              <div className="md:col-span-2 text-black">
              <label className="block text-white font-medium mb-2">Assign Staff</label>

              <Select
                styles={reactSelectStyles}
                options={staffs
                  .filter((s) => !formData.assignedStaffIds.some((st: any) => st.id === String(s.id)))
                  .map((s) => ({ value: s.id, label: s.name }))}
                placeholder="Add staff..."
                onChange={(selectedOption) => {
                  if (selectedOption) {
                    setFormData((prev: any) => ({
                      ...prev,
                      assignedStaffIds: [
                        ...prev.assignedStaffIds,
                        { id: String(selectedOption.value), access_level: 'view' },
                      ],
                    }));
                  }
                }}
              />

              {formData.assignedStaffIds.map((staff: StaffAccess, index: number) => {
                const staffName =
                  staffs.find((s) => String(s.id) === staff.id)?.name || 'Unknown';

                return (
                  <div key={staff.id} className="flex justify-between items-center bg-white rounded-xl p-3 mt-3">
                    <div>
                      <div className="font-semibold text-gray-900">{staffName}</div>
                      <div className="text-sm text-gray-500">
                        {staff.access_level === 'edit' ? 'Edit Access' : 'View Only'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <select
                        className="border rounded px-2 py-1"
                        value={staff.access_level}
                        onChange={(e) => {
                          const newLevel = e.target.value as 'view' | 'edit';
                          setFormData((prev: any) => ({
                            ...prev,
                            assignedStaffIds: prev.assignedStaffIds.map((st: any, i: number) =>
                              i === index ? { ...st, access_level: newLevel } : st
                            ),
                          }));
                        }}
                      >
                        <option value="view">View Only</option>
                        <option value="edit">Edit</option>
                      </select>

                      <button
                        className="text-red-500 font-bold"
                        onClick={() =>
                          setFormData((prev: any) => ({
                            ...prev,
                            assignedStaffIds: prev.assignedStaffIds.filter((_: any, i: number) => i !== index),
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
