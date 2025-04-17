import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const BASE_URL = 'http://localhost:5001'; // Base URL for your API

// Thunks

// Fetch the counts of patients by algorithm (Behavioral, Guardianship, LTC)
export const loadPatientCountsByAlgorithm = createAsyncThunk(
  'algorithms/loadPatientCountsByAlgorithm',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${BASE_URL}/algorithms/counts`, {
        withCredentials: true,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue('Failed to fetch patient counts by algorithm');
    }
  }
);

// Fetch patients by a specific algorithm (e.g., Behavioral, Guardianship, LTC)
export const loadPatientsByAlgorithm = createAsyncThunk(
  'algorithms/loadPatientsByAlgorithm',
  async (algorithm: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${BASE_URL}/algorithms/${algorithm}`, {
        withCredentials: true,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue('Failed to fetch patients for the algorithm');
    }
  }
);

// Slice

const algorithmSlice = createSlice({
  name: 'algorithms',
  initialState: {
    patientCounts: [],
    patientsByAlgorithm: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadPatientCountsByAlgorithm.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadPatientCountsByAlgorithm.fulfilled, (state, action) => {
        state.loading = false;
        state.patientCounts = action.payload;
      })
      .addCase(loadPatientCountsByAlgorithm.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(loadPatientsByAlgorithm.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadPatientsByAlgorithm.fulfilled, (state, action) => {
        state.loading = false;
        state.patientsByAlgorithm = action.payload;
      })
      .addCase(loadPatientsByAlgorithm.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default algorithmSlice.reducer;
