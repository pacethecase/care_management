// src/redux/slices/hospitalSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { Hospital } from "../types";

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

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const loadHospitals = createAsyncThunk<
  Hospital[],
  string | undefined,
  { rejectValue: string }
>("hospital/loadHospitals", async (orgId, { rejectWithValue }) => {
  try {
    const url = orgId
      ? `${BASE_URL}/hospitals?organization_id=${orgId}`
      : `${BASE_URL}/hospitals`;
    const { data } = await axios.get(url, { withCredentials: true });
    return data as Hospital[];
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to load hospitals");
  }
});

export const updateDailyRoomCost = createAsyncThunk<
  { hospitalId: number; daily_room_cost: number },
  { hospitalId: number; daily_room_cost: number },
  { rejectValue: string }
>("hospital/updateDailyRoomCost", async ({ hospitalId, daily_room_cost }, { rejectWithValue }) => {
  try {
    await axios.patch(
      `${BASE_URL}/hospitals/${hospitalId}/rate`,
      { daily_room_cost },
      { withCredentials: true }
    );
    return { hospitalId, daily_room_cost };
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to update room cost");
  }
});

export const updateHospitalTimezone = createAsyncThunk<
  { hospitalId: number; timezone: string },
  { hospitalId: number; timezone: string },
  { rejectValue: string }
>("hospital/updateHospitalTimezone", async ({ hospitalId, timezone }, { rejectWithValue }) => {
  try {
    await axios.patch(
      `${BASE_URL}/hospitals/${hospitalId}/timezone`,
      { timezone },
      { withCredentials: true }
    );
    return { hospitalId, timezone };
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to update timezone");
  }
});

// ─── Slice ────────────────────────────────────────────────────────────────────

const hospitalSlice = createSlice({
  name: "hospital",
  initialState,
  reducers: {
    clearHospitals: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadHospitals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadHospitals.fulfilled, (state, { payload }) => {
        state.hospitals = payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(loadHospitals.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload ?? "Failed to load hospitals";
      })

      // updateDailyRoomCost
      .addCase(updateDailyRoomCost.fulfilled, (state, { payload }) => {
        const h = state.hospitals.find((x) => x.id === payload.hospitalId);
        if (h) h.daily_room_cost = payload.daily_room_cost;
        state.error = null;
      })
      .addCase(updateDailyRoomCost.rejected, (state, { payload }) => {
        state.error = payload ?? "Failed to update room cost";
      })

      // updateHospitalTimezone
      .addCase(updateHospitalTimezone.fulfilled, (state, { payload }) => {
        const h = state.hospitals.find((x) => x.id === payload.hospitalId);
        if (h) h.timezone = payload.timezone;
        state.error = null;
      })
      .addCase(updateHospitalTimezone.rejected, (state, { payload }) => {
        state.error = payload ?? "Failed to update timezone";
      });
  },
});

export const { clearHospitals } = hospitalSlice.actions;
export default hospitalSlice.reducer;