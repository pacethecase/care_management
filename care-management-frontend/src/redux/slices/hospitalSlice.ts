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

export const loadHospitals = createAsyncThunk<
  Hospital[],
  void,
  { rejectValue: string }
>(
  'hospitals/loadHospitals',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/hospitals`, {
        withCredentials: true,
      });
      if (!Array.isArray(res.data)) {
        return rejectWithValue('Unexpected response format');
      }
      return res.data;
    } catch (err: any) {
      const message =
        err.response?.data?.error || err.message || 'Failed to load hospitals';
      return rejectWithValue(message);
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
        state.hospitals = [];
        state.error = action.payload ?? 'Unknown error loading hospitals';
      });
  },
});

export default hospitalSlice.reducer;
