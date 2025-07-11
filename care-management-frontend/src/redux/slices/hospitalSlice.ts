// src/redux/slices/hospitalSlice.ts
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

export const loadHospitals = createAsyncThunk<
  Hospital[],
  void,
  { rejectValue: string }
>("hospital/loadHospitals", async (_, { rejectWithValue }) => {
  try {
    const { data } = await axios.get(`${BASE_URL}/hospitals`, {
      withCredentials: true,
    });
    return data as Hospital[];
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to load hospitals");
  }
});


export const updateDailyBedCost = createAsyncThunk<
  { hospitalId: number; daily_bed_cost: number },
  { hospitalId: number; daily_bed_cost: number },
  { rejectValue: string }
>("hospital/updateDailyBedCost", async ({ hospitalId, daily_bed_cost }, { rejectWithValue }) => {
  try {
    await axios.patch(
      `${BASE_URL}/hospitals/${hospitalId}/rate`,
      { daily_bed_cost },
      { withCredentials: true }
    );
    return { hospitalId, daily_bed_cost };
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to update bed cost");
  }
});


export const clearHospitals = createAction("hospital/clearHospitals");



const hospitalSlice = createSlice({
  name: "hospital",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // loadHospitals
      .addCase(loadHospitals.fulfilled, (state, { payload }) => {
        state.hospitals = payload;
        state.error = null;
      })
      .addCase(loadHospitals.rejected, (state, { payload }) => {
        state.error = payload as string;
      })

      // updateDailyBedCost
      .addCase(updateDailyBedCost.fulfilled, (state, { payload }) => {
        const h = state.hospitals.find((x) => x.id === payload.hospitalId);
        if (h) h.daily_bed_cost = payload.daily_bed_cost;
        state.error = null;
      })
      .addCase(updateDailyBedCost.rejected, (state, { payload }) => {
        state.error = payload as string;
      })

      // clear
      .addCase(clearHospitals, () => initialState);
  },
});

export default hospitalSlice.reducer;
