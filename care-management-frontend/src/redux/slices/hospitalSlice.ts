import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import type { Hospital } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface HospitalState {
  hospitals: Hospital[];
  loading: boolean;
  error: string | null;
}

const initialState: HospitalState = {
  hospitals: [],
  loading: false,
  error: null,
};

// ✅ Thunk: Fetch all hospitals
export const loadHospitals = createAsyncThunk<
  Hospital[],     // Return type
  void,           // No input
  { rejectValue: string }
>(
  'hospitals/loadHospitals',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/hospitals/`, {
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue('Failed to load hospitals');
    }
  }
);

const hospitalSlice = createSlice({
  name: 'hospitals',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadHospitals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadHospitals.fulfilled, (state, action) => {
        state.loading = false;
        state.hospitals = action.payload;
      })
      .addCase(loadHospitals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error loading hospitals';
      });
  },
});

export default hospitalSlice.reducer;
