import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import type { Patient, AlgorithmPatientCount } from "../types";

const BASE_URL = 'http://localhost:5001';

interface AlgorithmState {
  patientCounts: AlgorithmPatientCount[];
  patientsByAlgorithm: Patient[];
  loading: boolean;
  error: string | null;
}

const initialState: AlgorithmState = {
  patientCounts: [],
  patientsByAlgorithm: [],
  loading: false,
  error: null,
};

// ✅ Thunk: Fetch patient counts grouped by algorithm
export const loadPatientCountsByAlgorithm = createAsyncThunk<
  AlgorithmPatientCount[],             // Return type
  void,                                // No input argument
  { rejectValue: string }              // Reject type
>(
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

// ✅ Thunk: Fetch patients filtered by algorithm
export const loadPatientsByAlgorithm = createAsyncThunk<
  Patient[],                           // Return type
  string,                              // Input argument (algorithm)
  { rejectValue: string }              // Reject type
>(
  'algorithms/loadPatientsByAlgorithm',
  async (algorithm, { rejectWithValue }) => {
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

// ✅ Slice
const algorithmSlice = createSlice({
  name: 'algorithms',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadPatientCountsByAlgorithm.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadPatientCountsByAlgorithm.fulfilled, (state, action) => {
        state.loading = false;
        state.patientCounts = action.payload;
      })
      .addCase(loadPatientCountsByAlgorithm.rejected, (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === 'string' ? action.payload : 'Error loading algorithm counts';
      })

      .addCase(loadPatientsByAlgorithm.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadPatientsByAlgorithm.fulfilled, (state, action) => {
        state.loading = false;
        state.patientsByAlgorithm = action.payload;
      })
      .addCase(loadPatientsByAlgorithm.rejected, (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === 'string' ? action.payload : 'Error loading patients';
      });
  },
});

export default algorithmSlice.reducer;
