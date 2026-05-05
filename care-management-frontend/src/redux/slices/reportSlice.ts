// src/redux/slices/reportSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpportunityLOSData {
  behavioral:   any;
  guardianship: any;
  ltc:          any;
  nationalAverage: number;
}

export interface StaffPerformanceSummary {
  patient_name?:         string;
  staff_name?:           string;
  task_name?:            string;
  total_tasks:           number;
  missed_count:          number;
  delayed_count:         number;
  pending_count?:        number;
  overridden_count?:     number;
  completed_on_time?:    number;
}

interface StaffPerformanceData {
  type:              string | null;
  data:              StaffPerformanceSummary[] | StaffPerformanceSummary;
  topLaggingStaff?:  { staff_name: string; missed_count: string; delayed_count: string }[];
  topMissedTasks?:   { task_name: string; missed_count: string; responsible_staff: string[] }[];
  drilldown?:        any[];
}

interface ReportState {
  dailyReport:             any[];
  priorityReport:          any[];
  transitionalReport:      any | null;
  historicalReport:        any | null;
  projectedTimelineReport: any | null;
  loading:                 boolean;
  error:                   string | null;
  los: {
    data:    any | null;
    loading: boolean;
    error:   string | null;
  };
  opportunityLOS: {
    loading: boolean;
    data:    OpportunityLOSData | null;
    error:   string | null;
  };
  staffPerformanceReport: {
    data:            StaffPerformanceSummary[] | StaffPerformanceSummary | null;
    loading:         boolean;
    error:           string | null;
    type:            string | null;
    drilldown?:      any[];
    topLaggingStaff?: any[];
    topMissedTasks?:  any[];
  };
}

const initialState: ReportState = {
  dailyReport:             [],
  priorityReport:          [],
  transitionalReport:      null,
  historicalReport:        null,
  projectedTimelineReport: null,
  loading:                 false,
  error:                   null,
  los: { data: null, loading: false, error: null },
  opportunityLOS: { loading: false, data: null, error: null },
  staffPerformanceReport: {
    data: [], loading: false, error: null, type: null, drilldown: [],
    topLaggingStaff: [], topMissedTasks: [],
  },
};

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const fetchDailyReport = createAsyncThunk<
  any[],
  { date: string; adminId?: number; hospitalId?: number },
  { rejectValue: string }
>("reports/fetchDailyReport", async ({ date, adminId, hospitalId }, { rejectWithValue }) => {
  try {
    const q = new URLSearchParams({ date });
    if (adminId)    q.append("adminId",    String(adminId));
    if (hospitalId) q.append("hospitalId", String(hospitalId));
    const res = await axios.get(`${BASE_URL}/reports/daily-report?${q}`, { withCredentials: true });
    return res.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to fetch daily report");
  }
});

export const fetchPriorityReport = createAsyncThunk<
  any[],
  { date: string; adminId?: number; hospitalId?: number },
  { rejectValue: string }
>("reports/fetchPriorityReport", async ({ date, adminId, hospitalId }, { rejectWithValue }) => {
  try {
    const q = new URLSearchParams({ date });
    if (adminId)    q.append("adminId",    String(adminId));
    if (hospitalId) q.append("hospitalId", String(hospitalId));
    const res = await axios.get(`${BASE_URL}/reports/daily-priority-report?${q}`, { withCredentials: true });
    return res.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to fetch priority report");
  }
});

export const fetchTransitionalReport = createAsyncThunk<
  any,
  { patientId: number; start_date?: string; end_date?: string },
  { rejectValue: string }
>("reports/fetchTransitionalReport", async ({ patientId, start_date, end_date }, { rejectWithValue }) => {
  try {
    const res = await axios.get(`${BASE_URL}/reports/patients/${patientId}/transitional-report`, {
      params: { start_date, end_date }, withCredentials: true,
    });
    return res.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to fetch transitional report");
  }
});

export const fetchHistoricalTimelineReport = createAsyncThunk<
  any,
  { patientId: number; start_date?: string; end_date?: string },
  { rejectValue: string }
>("reports/fetchHistoricalTimelineReport", async ({ patientId, start_date, end_date }, { rejectWithValue }) => {
  try {
    const res = await axios.get(`${BASE_URL}/reports/patients/${patientId}/historical-timeline-report`, {
      params: { start_date, end_date }, withCredentials: true,
    });
    return res.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to fetch historical report");
  }
});

export const fetchProjectedTimelineReport = createAsyncThunk<any, number, { rejectValue: string }>(
  "reports/fetchProjectedTimelineReport",
  async (patientId, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/reports/patients/${patientId}/projected-timeline-report`, { withCredentials: true });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch projected timeline report");
    }
  }
);

export const fetchLengthOfStayReport = createAsyncThunk(
  "reports/fetchLengthOfStayReport",
  async (
    { includeDischarged = false, startDate, endDate, algorithm, hospitalId }:
    { includeDischarged?: boolean; startDate?: string; endDate?: string; algorithm?: string; hospitalId?: string } = {},
    { rejectWithValue }
  ) => {
    try {
      const q = new URLSearchParams();
      if (includeDischarged) q.append("includeDischarged", "true");
      if (startDate)  q.append("startDate",  startDate);
      if (endDate)    q.append("endDate",    endDate);
      if (algorithm)  q.append("algorithm",  algorithm);
      if (hospitalId) q.append("hospitalId", hospitalId);
      const res = await axios.get(`${BASE_URL}/reports/length-of-stay?${q}`, { withCredentials: true });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to load LOS report");
    }
  }
);

export const fetchOpportunityDaysReport = createAsyncThunk(
  "reports/fetchOpportunityDaysReport",
  async (
    { includeDischarged = false, startDate, endDate, algorithm, hospitalId }:
    { includeDischarged?: boolean; startDate?: string; endDate?: string; algorithm?: string; hospitalId?: string } = {},
    { rejectWithValue }
  ) => {
    try {
      const q = new URLSearchParams();
      if (includeDischarged) q.append("includeDischarged", "true");
      if (startDate)  q.append("startDate",  startDate);
      if (endDate)    q.append("endDate",    endDate);
      if (algorithm)  q.append("algorithm",  algorithm);
      if (hospitalId) q.append("hospitalId", hospitalId);
      const res = await axios.get(`${BASE_URL}/reports/opportunity-days?${q}`, { withCredentials: true });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to load Opportunity Days report");
    }
  }
);

export const fetchStaffPerformanceReport = createAsyncThunk<
  StaffPerformanceData,
  { start: string; end: string; algorithm?: string; staffId?: number; hospitalId?: string; includeDischarged?: boolean },
  { rejectValue: string }
>("reports/fetchStaffPerformanceReport", async ({ start, end, algorithm, staffId, hospitalId, includeDischarged }, { rejectWithValue }) => {
  try {
    const q = new URLSearchParams({ start, end });
    if (algorithm)             q.append("algorithm",        algorithm);
    if (staffId !== undefined) q.append("staffId",          staffId.toString());
    if (hospitalId)            q.append("hospitalId",       hospitalId);
    if (includeDischarged !== undefined) q.append("includeDischarged", includeDischarged.toString());
    const res = await axios.get(`${BASE_URL}/reports/staff-performance?${q}`, { withCredentials: true });
    return res.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to fetch staff performance report");
  }
});

// ─── Slice ────────────────────────────────────────────────────────────────────

const reportSlice = createSlice({
  name: "reports",
  initialState,
  reducers: {
    // FIX: clearReports returns full initialState so LOS/opportunity/staff data also clears
    clearReports: () => initialState,
    clearReportError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDailyReport.pending,    (state) => { state.loading = true;  state.error = null; })
      .addCase(fetchDailyReport.fulfilled,  (state, action) => { state.loading = false; state.dailyReport = action.payload; })
      .addCase(fetchDailyReport.rejected,   (state, action) => { state.loading = false; state.error = action.payload ?? "Failed"; })

      .addCase(fetchPriorityReport.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(fetchPriorityReport.fulfilled, (state, action) => { state.loading = false; state.priorityReport = action.payload; })
      .addCase(fetchPriorityReport.rejected,  (state, action) => { state.loading = false; state.error = action.payload ?? "Failed"; })

      .addCase(fetchTransitionalReport.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(fetchTransitionalReport.fulfilled, (state, action) => { state.loading = false; state.transitionalReport = action.payload; })
      .addCase(fetchTransitionalReport.rejected,  (state, action) => { state.loading = false; state.error = action.payload ?? "Failed"; })

      .addCase(fetchHistoricalTimelineReport.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(fetchHistoricalTimelineReport.fulfilled, (state, action) => { state.loading = false; state.historicalReport = action.payload; })
      .addCase(fetchHistoricalTimelineReport.rejected,  (state, action) => { state.loading = false; state.error = action.payload ?? "Failed"; })

      .addCase(fetchProjectedTimelineReport.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(fetchProjectedTimelineReport.fulfilled, (state, action) => { state.loading = false; state.projectedTimelineReport = action.payload; })
      .addCase(fetchProjectedTimelineReport.rejected,  (state, action) => { state.loading = false; state.error = action.payload ?? "Failed"; })

      .addCase(fetchLengthOfStayReport.pending,   (state) => { state.los.loading = true;  state.los.error = null; })
      .addCase(fetchLengthOfStayReport.fulfilled, (state, action) => { state.los.loading = false; state.los.data = action.payload; })
      .addCase(fetchLengthOfStayReport.rejected,  (state, action) => { state.los.loading = false; state.los.error = action.payload as string; })

      .addCase(fetchOpportunityDaysReport.pending,   (state) => { state.opportunityLOS.loading = true;  state.opportunityLOS.error = null; })
      .addCase(fetchOpportunityDaysReport.fulfilled, (state, action) => { state.opportunityLOS.loading = false; state.opportunityLOS.data = action.payload; })
      .addCase(fetchOpportunityDaysReport.rejected,  (state, action) => { state.opportunityLOS.loading = false; state.opportunityLOS.error = action.payload as string; })

      .addCase(fetchStaffPerformanceReport.pending, (state) => {
        state.staffPerformanceReport.loading = true;
        state.staffPerformanceReport.error   = null;
      })
      .addCase(fetchStaffPerformanceReport.fulfilled, (state, action) => {
        state.staffPerformanceReport.loading        = false;
        state.staffPerformanceReport.data           = action.payload.data;
        state.staffPerformanceReport.type           = action.payload.type;
        state.staffPerformanceReport.drilldown      = action.payload.drilldown      ?? [];
        state.staffPerformanceReport.topLaggingStaff = action.payload.topLaggingStaff ?? [];
        state.staffPerformanceReport.topMissedTasks  = action.payload.topMissedTasks  ?? [];
      })
      .addCase(fetchStaffPerformanceReport.rejected, (state, action) => {
        state.staffPerformanceReport.loading = false;
        state.staffPerformanceReport.error   = action.payload ?? "Failed";
      });
  },
});

export const { clearReports, clearReportError } = reportSlice.actions;
export default reportSlice.reducer;