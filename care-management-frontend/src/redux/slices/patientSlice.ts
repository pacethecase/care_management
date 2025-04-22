import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import type { Patient } from '../types'; // reuse your shared Patient type


const BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface PatientState {
  patients: Patient[];
  dischargedPatients: Patient[];
  searchResults: Patient[];
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

export const fetchPatients = createAsyncThunk(
  'patients/fetchPatients',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${BASE_URL}/patients`, { withCredentials: true });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to fetch patients');
    }
  }
);

export const addPatient = createAsyncThunk(
  'patients/addPatient',
  async (patientData: any, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${BASE_URL}/patients`, patientData, {
        withCredentials: true,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to add patient');
    }
  }
);

export const fetchPatientById = createAsyncThunk(
  'patients/fetchById',
  async (patientId: number, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/patients/${patientId}`, {
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || 'Failed to fetch patient');
    }
  }
);

export const dischargePatient = createAsyncThunk(
  'patients/dischargePatient',
  async ({ patientId, dischargeNote }: { patientId: number; dischargeNote: string }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${BASE_URL}/patients/${patientId}/discharge`, { dischargeNote }, {
        withCredentials: true,
      });
      return { patientId, message: response.data.message };
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to discharge patient');
    }
  }
);

export const fetchDischargedPatients = createAsyncThunk(
  'patients/fetchDischargedPatients',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/patients/discharged`, {
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || 'Failed to fetch discharged patients');
    }
  }
);

export const updatePatient = createAsyncThunk(
  'patients/updatePatient',
  async ({ id, data }: { id: number | string; data: any }, { rejectWithValue }) => {
    try {
      const res = await axios.patch(`${BASE_URL}/patients/${id}/update`, data, {
        withCredentials: true,
      });
      return res.data.patient;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || 'Failed to update patient');
    }
  }
);

export const searchPatients = createAsyncThunk(
  'patients/search',
  async (query: string, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/patients/search?q=${encodeURIComponent(query)}`, {
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || 'Search failed');
    }
  }
);

const patientsSlice = createSlice({
  name: 'patients',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
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
      .addCase(addPatient.fulfilled, (state, action) => {
        state.patients.push(action.payload.patient);
        state.loading = false;
      })
      .addCase(fetchPatientById.fulfilled, (state, action) => {
        state.selectedPatient = action.payload;
      })
      .addCase(dischargePatient.fulfilled, (state, action) => {
        state.patients = state.patients.map((patient) =>
          patient.id === action.payload.patientId
            ? {
                ...patient,
                status: 'Discharged',
                discharge_note: 'Added',
                discharge_date: new Date().toISOString(),
              }
            : patient
        );
        state.loading = false;
      })
      .addCase(fetchDischargedPatients.fulfilled, (state, action) => {
        state.dischargedPatients = action.payload;
        state.loading = false;
      })
      .addCase(updatePatient.fulfilled, (state, action) => {
        const index = state.patients.findIndex((p) => p.id === action.payload.id);
        if (index !== -1) state.patients[index] = action.payload;
        state.loading = false;
      })
      .addCase(searchPatients.fulfilled, (state, action) => {
        state.searchResults = action.payload;
        state.loading = false;
      });
  },
});

export default patientsSlice.reducer;
