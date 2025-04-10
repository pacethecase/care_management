import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

// Define the initial state for patients
interface Patient {
  id: number;
  name: string;
  birth_date: string;
  age: number;
  bed_id: string;
  medical_info: string;
  status: string;
  assigned_staff_id: number | null;
  is_behavioral: boolean;
  is_restrained: boolean;
  is_geriatric_psych_available: boolean;
  is_behavioral_team: boolean;
  is_ltc: boolean;
  is_guardianship: boolean;
  created_at: string;
}

interface PatientState {
  patients: Patient[];
  selectedPatient: Patient | null;
  loading: boolean;
  error: string | null;
}

const initialState: PatientState = {
  patients: [],
  selectedPatient: null, 
  loading: false,
  error: null,
};


// Fetch patients API request
export const fetchPatients = createAsyncThunk(
  'patients/fetchPatients',
  async (token: string, { rejectWithValue }) => {
    try {
        const response = await axios.get('http://localhost:5001/patients', {
            withCredentials: true, // ✅ Use the cookie
          });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to fetch patients');
    }
  }
);

// Add patient API request
export const addPatient = createAsyncThunk(
  'patients/addPatient',
  async (patientData: any, { rejectWithValue }) => {
    try {
        const response = await axios.post(
            'http://localhost:5001/patients',
            patientData,
            {
              withCredentials: true, // ✅ Required to include the cookie for auth
            }
          );
      
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to add patient');
    }
  }
);

export const fetchPatientById = createAsyncThunk(
  'patients/fetchById',
  async (patientId: number, { rejectWithValue }) => {
    try {
      const res = await axios.get(`http://localhost:5001/patients/${patientId}`, {
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || 'Failed to fetch patient');
    }
  }
);

const patientsSlice = createSlice({
  name: 'patients',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch all patients
      .addCase(fetchPatients.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPatients.fulfilled, (state, action) => {
        state.loading = false;
        state.patients = action.payload;
      })
      .addCase(fetchPatients.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Add a patient
      .addCase(addPatient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addPatient.fulfilled, (state, action) => {
        state.loading = false;
        state.patients.push(action.payload.patient);
      })
      .addCase(addPatient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch by ID
      .addCase(fetchPatientById.fulfilled, (state, action) => {
        state.selectedPatient = action.payload;
      })
      .addCase(fetchPatientById.rejected, (state, action) => {
        state.selectedPatient = null;
        state.error = action.payload as string;
      });
  },
});


export default patientsSlice.reducer;
