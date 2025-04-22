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
  is_ltc_medical: boolean;
  is_ltc_financial: boolean;
  is_guardianship: boolean;
  is_guardianship_financial: boolean;
  is_guardianship_person: boolean;
  is_guardianship_emergency: boolean;
  created_at: string;
}

interface PatientState {
  patients: Patient[];
  dischargedPatients: Patient[]; 
  selectedPatient: Patient | null;
  loading: boolean;
  error: string | null;
}

const initialState: PatientState = {
  patients: [],
  dischargedPatients: [],
  searchResults: [],
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
 
export const dischargePatient = createAsyncThunk(
  "patients/dischargePatient",
  async ({ patientId, dischargeNote }: { patientId: number; dischargeNote: string }, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `http://localhost:5001/patients/${patientId}/discharge`,
        { dischargeNote },
        { withCredentials: true }
      );
      return { patientId, message: response.data.message };
    } catch (error: any) {
      console.error("❌ Discharge error:", error?.response?.data || error.message);
      return rejectWithValue(error?.response?.data || { error: "Unknown error occurred" });
    }
  }
);

export const fetchDischargedPatients = createAsyncThunk(
  'patients/fetchDischargedPatients',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get('http://localhost:5001/patients/discharged', {
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || 'Failed to fetch discharged patients');
    }
  }
);

export const updatePatient = createAsyncThunk(
  "patients/updatePatient",
  async (
    { id, data }: { id: number | string; data: any },
    { rejectWithValue }
  ) => {
    try {
      const res = await axios.patch(
        `http://localhost:5001/patients/${id}/update`,
        data,
        { withCredentials: true }
      );
      return res.data.patient;
    } catch (err: any) {
      console.error("❌ Update error:", err?.response?.data || err.message);
      return rejectWithValue(err?.response?.data || { error: "Failed to update patient" });
    }
  }
);
export const searchPatients = createAsyncThunk(
  "patients/search",
  async (query: string, { rejectWithValue }) => {
    try {
      const res = await axios.get(`http://localhost:5001/patients/search?q=${encodeURIComponent(query)}`, {
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || "Search failed");
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
        state.error = typeof action.payload === 'string'
          ? action.payload
          : action.payload?.error || 'Something went wrong';
      })
      
      .addCase(dischargePatient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(dischargePatient.fulfilled, (state, action) => {
        state.loading = false;
        state.patients = state.patients.map((patient) =>
          patient.id === action.payload.patientId
            ? {
                ...patient,
                status: "Discharged",
                discharge_note: "Added", // You could store actual note if needed
                discharge_date: new Date().toISOString()
              }
            : patient
        );
      })      
      .addCase(dischargePatient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchDischargedPatients.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDischargedPatients.fulfilled, (state, action) => {
        state.loading = false;
        state.dischargedPatients = action.payload; // populate the discharged list
      })
      .addCase(fetchDischargedPatients.rejected, (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === 'string'
          ? action.payload
          : action.payload?.error || 'Failed to fetch discharged patients';
      })
      .addCase(updatePatient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updatePatient.fulfilled, (state, action) => {
        state.loading = false;
        const updated = action.payload;
        const index = state.patients.findIndex((p) => p.id === updated.id);
        if (index !== -1) state.patients[index] = updated;
      })
      .addCase(updatePatient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(searchPatients.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchPatients.fulfilled, (state, action) => {
        state.searchResults = action.payload;
        state.loading = false;
      })
      .addCase(searchPatients.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
      

  },
});


export default patientsSlice.reducer;
