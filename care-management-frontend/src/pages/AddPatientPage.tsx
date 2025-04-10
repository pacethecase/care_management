import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { addPatient } from '../redux/slices/patientSlice';
import { fetchStaffs } from '../redux/slices/userSlice';
import { RootState } from '../redux/store';
import AlgorithmSelection from "../components/AlgorithmSelection";

const AddPatientPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const staffs = useSelector((state: RootState) => state.user.staffs);

  const [formData, setFormData] = useState({
    name: '',
    birth_date: '',
    age: '',
    bedId: '',
    medical_info: '',
    assignedStaffId: '',
    is_behavioral: false,
    is_restrained: false,
    is_geriatric_psych_available: false,
    is_behavioral_team: false,
    is_ltc: false,
    is_guardianship: false,
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async () => {
    try {
      console.log('Patient Data to be Sent:', formData);
   
      await dispatch(addPatient(formData)).unwrap();



      setFormData({
        name: '',
        birth_date: '',
        age: '',
        bedId: '',
        medical_info: '',
        assignedStaffId: '',
        is_behavioral: false,
        is_restrained: false,
        is_geriatric_psych_available: false,
        is_behavioral_team: false,
        is_ltc: false,
        is_guardianship: false,
      });

      navigate('/patients');
    } catch (err) {
      console.error('Submit failed:', err);
    }
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <h3 className="text-3xl font-semibold text-hospital-blue mb-6">Add New Patient</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-700">
        <div>
          <label className="block font-medium">Patient Name*</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full p-2 border rounded"
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
            className="w-full p-2 border rounded"
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
            className="w-full p-2 border rounded bg-gray-100 cursor-not-allowed"
            placeholder="Auto-calculated from birth date"
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
            className="w-full p-2 border rounded"
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
            className="w-full p-2 border rounded"
            placeholder="Enter medical details"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block font-medium">Assign Staff</label>
          <select
            name="assignedStaffId"
            value={formData.assignedStaffId}
            onChange={handleChange}
            className="w-full p-2 border rounded"
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

        <AlgorithmSelection formData={formData} setFormData={setFormData} />
      </div>

      <button className="mt-6 btn" onClick={handleSubmit}>
        Add Patient
      </button>
    </div>
  );
};

export default AddPatientPage;
