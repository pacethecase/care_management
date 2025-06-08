import { createSlice, createAsyncThunk, createAction } from "@reduxjs/toolkit";
import axios from "axios";
import type { Hospital } from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface HospitalState {
  hospitals: Hospital[];
  error: string | null;
}

const initialState: HospitalState = {
  hospitals: [],
  error: null,
};

// ✅ Thunks
export const loadHospitals = createAsyncThunk(
  "hospital/loadHospitals",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/hospitals`, {
        withCredentials: true,
      });
      return res.data as Hospital[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to load hospitals");
    }
  }
);

// ✅ Clear action
export const clearHospitals = createAction("hospital/clearHospitals");

// ✅ Slice
const hospitalSlice = createSlice({
  name: "hospital",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadHospitals.fulfilled, (state, action) => {
        state.hospitals = action.payload;
      })
      .addCase(loadHospitals.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      .addCase(clearHospitals, () => initialState);
  },
});

export default hospitalSlice.reducer;
