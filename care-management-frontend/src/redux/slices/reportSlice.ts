// src/redux/slices/reportSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";


const BASE_URL = import.meta.env.VITE_API_BASE_URL;
interface ReportState {
  dailyReport: any[];
  priorityReport: any[];
  transitionReport: any | null;
  historicalReport: any | null;
  projectedTimelineReport: any | null;
  loading: boolean;
  error: string | null;
}

const initialState: ReportState = {
  dailyReport: [],
  priorityReport: [],
  transitionReport: null,
  historicalReport: null,
  projectedTimelineReport: null,
  loading: false,
  error: null,
};

export const fetchDailyReport = createAsyncThunk<any[], string, { rejectValue: string }>(
  "reports/fetchDailyReport",
  async (date, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${BASE_URL}/reports/daily-report?date=${date}`, {
        withCredentials: true,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Failed to fetch daily report");
    }
  }
);

export const fetchPriorityReport = createAsyncThunk<any[], string, { rejectValue: string }>(
  "reports/fetchPriorityReport",
  async (date, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${BASE_URL}/reports/daily-priority-report?date=${date}`, {
        withCredentials: true,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Failed to fetch priority report");
    }
  }
);

export const fetchTransitionReport = createAsyncThunk<any, number, { rejectValue: string }>(
  "reports/fetchTransitionReport",
  async (patientId, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${BASE_URL}/reports/patients/${patientId}/transition-report`, {
        withCredentials: true,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Failed to fetch transition report");
    }
  }
);

export const fetchHistoricalTimelineReport = createAsyncThunk<any, number, { rejectValue: string }>(
  "reports/fetchHistoricalTimelineReport",
  async (patientId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${BASE_URL}/reports/patients/${patientId}/historical-timeline-report`
        , {
          withCredentials: true,
        });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Failed to fetch timeline report");
    }
  }
);

export const fetchProjectedTimelineReport = createAsyncThunk<any, number, { rejectValue: string }>(
  "reports/fetchProjectedTimelineReport",
  async (patientId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
       `${BASE_URL}/reports/patients/${patientId}/projected-timeline-report`
       , {
        withCredentials: true,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Failed to fetch projected timeline report");
    }
  }
);

const reportSlice = createSlice({
  name: "reports",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDailyReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDailyReport.fulfilled, (state, action: PayloadAction<any[]>) => {
        state.loading = false;
        state.dailyReport = action.payload;
      })
      .addCase(fetchDailyReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchPriorityReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPriorityReport.fulfilled, (state, action: PayloadAction<any[]>) => {
        state.loading = false;
        state.priorityReport = action.payload;
      })
      .addCase(fetchPriorityReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchTransitionReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransitionReport.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.transitionReport = action.payload;
      })
      .addCase(fetchTransitionReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchHistoricalTimelineReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchHistoricalTimelineReport.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.historicalReport = action.payload;
      })
      .addCase(fetchHistoricalTimelineReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchProjectedTimelineReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjectedTimelineReport.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.projectedTimelineReport = action.payload;
      })
      .addCase(fetchProjectedTimelineReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default reportSlice.reducer;
