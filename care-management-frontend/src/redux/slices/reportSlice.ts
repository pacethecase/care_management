import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const initialState = {
  dailyReport: [],
  priorityReport: [],
  transitionReport: null,
  historicalReport: null,
  loading: false,
  error: null,
};

// Fetch Daily Report by date
export const fetchDailyReport = createAsyncThunk(
  'reports/fetchDailyReport',
  async (date, { rejectWithValue }) => {
    try {
      const response = await axios.get(`http://localhost:5001/reports/daily-report?date=${date}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to fetch daily report');
    }
  }
);

// Fetch Priority Report by date
export const fetchPriorityReport = createAsyncThunk(
  'reports/fetchPriorityReport',
  async (date, { rejectWithValue }) => {
    try {
      const response = await axios.get(`http://localhost:5001/reports/daily-priority-report?date=${date}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to fetch priority report');
    }
  }
);
export const fetchTransitionReport = createAsyncThunk(
  'reports/fetchTransitionReport',
  async (patientId, { rejectWithValue }) => {
    try {
      const response = await axios.get(`http://localhost:5001/reports/patients/${patientId}/transition-report`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to fetch transition report');
    }
  }
);
export const fetchHistoricalTimelineReport = createAsyncThunk(
  "reports/fetchHistoricalTimelineReport",
  async (patientId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `http://localhost:5001/reports/patients/${patientId}/historical-timeline-report`
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to fetch timeline report");
    }
  }
);


const reportSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDailyReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDailyReport.fulfilled, (state, action) => {
        state.loading = false;
        state.dailyReport = action.payload;
      })
      .addCase(fetchDailyReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchPriorityReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPriorityReport.fulfilled, (state, action) => {
        state.loading = false;
        state.priorityReport = action.payload;
      })
      .addCase(fetchPriorityReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchTransitionReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransitionReport.fulfilled, (state, action) => {
        state.loading = false;
        state.transitionReport = action.payload;
      })
      .addCase(fetchTransitionReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchHistoricalTimelineReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchHistoricalTimelineReport.fulfilled, (state, action) => {
        state.loading = false;
        state.historicalReport = action.payload;
      })
      .addCase(fetchHistoricalTimelineReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default reportSlice.reducer;
