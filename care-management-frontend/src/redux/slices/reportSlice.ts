// src/redux/slices/reportSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";


const BASE_URL = import.meta.env.VITE_API_BASE_URL;
interface OpportunityLOSData {
  behavioral: any;
  guardianship: any;
  ltc: any;
  nationalAverage: number;
}

interface ReportState { 
  dailyReport: any[];
  priorityReport: any[];
  transitionalReport: any | null;
  historicalReport: any | null;
  projectedTimelineReport: any | null;
  loading: boolean;
  error: string | null;
   los: {
    data: any | null;
    loading: boolean;
    error: string | null;
  };
   opportunityLOS: {
    loading: boolean;
    data: OpportunityLOSData | null;
    error: string | null;
  };
}

interface LOSReportParams {
  includeDischarged?: boolean;
}
const initialState: ReportState = {
  dailyReport: [],
  priorityReport: [],
  transitionalReport: null,
  historicalReport: null,
  projectedTimelineReport: null,
  loading: false,
  error: null,
  los: {
    data: null,
    loading: false,
    error: null,
  },
   opportunityLOS: {
    loading: false,
    data: null,
    error: null,
  },
};
export interface ReportParams {
  date: string;
  adminId?: number;
}


export const fetchDailyReport = createAsyncThunk<any[], ReportParams, { rejectValue: string }>(
  "reports/fetchDailyReport",
  async ({ date, adminId }, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams({ date });
      if (adminId) queryParams.append("adminId", String(adminId));

      const response = await axios.get(`${BASE_URL}/reports/daily-report?${queryParams.toString()}`, {
        withCredentials: true,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Failed to fetch daily report");
    }
  }
);

export const fetchPriorityReport = createAsyncThunk<any[], ReportParams, { rejectValue: string }>(
  "reports/fetchPriorityReport",
  async ({ date, adminId }, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams({ date });
      if (adminId) queryParams.append("adminId", String(adminId));

      const response = await axios.get(`${BASE_URL}/reports/daily-priority-report?${queryParams.toString()}`, {
        withCredentials: true,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Failed to fetch priority report");
    }
  }
);

export const fetchTransitionalReport = createAsyncThunk<
  any, // or a proper `TransitionalReport` type
  { patientId: number; start_date?: string; end_date?: string },
  { rejectValue: string }
>(
  "reports/fetchTransitionalReport",
  async ({ patientId, start_date, end_date }, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${BASE_URL}/reports/patients/${patientId}/transitional-report`,
        {
          params: { start_date, end_date },
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Failed to fetch transitional report");
    }
  }
);


export const fetchHistoricalTimelineReport = createAsyncThunk<
  any, // or a proper `HistoricalTimelineReport` type
  { patientId: number; start_date?: string; end_date?: string },
  { rejectValue: string }
>(
  "reports/fetchHistoricalTimelineReport",
  async ({ patientId, start_date, end_date }, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${BASE_URL}/reports/patients/${patientId}/historical-timeline-report`,
        {
          params: { start_date, end_date },
          withCredentials: true,
        }
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Failed to fetch historical report");
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

export const fetchLengthOfStayReport = createAsyncThunk(
  "reports/fetchLengthOfStayReport",
  async (
    { includeDischarged = false }: LOSReportParams = {},
    { rejectWithValue }
  ) => {
    try {
      const query = new URLSearchParams();
      if (includeDischarged) query.append("includeDischarged", "true");

      const res = await axios.get(`${BASE_URL}/reports/length-of-stay?${query.toString()}`, {
        withCredentials: true,
      });

      return res.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load LOS report"
      );
    }
  }
);
export const fetchOpportunityDaysReport = createAsyncThunk(
  "reports/fetchOpportunityDaysReport",
  async (
    { includeDischarged = false }: { includeDischarged?: boolean } = {},
    { rejectWithValue }
  ) => {
    try {
      const query = new URLSearchParams();
      if (includeDischarged) query.append("includeDischarged", "true");

      const res = await axios.get(`${BASE_URL}/reports/opportunity-days?${query.toString()}`, {
        withCredentials: true,
      });

      return res.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to load Opportunity Days report"
      );
    }
  }
);



const reportSlice = createSlice({
  name: "reports",
  initialState,
  reducers: {
    clearReports: (state) => {
    state.dailyReport = [];
    state.priorityReport = [];
    state.transitionalReport = null;
    state.historicalReport = null;
    state.projectedTimelineReport = null;
  },
  clearReportError: (state) => {
    state.error = null;
  },
  },
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
      .addCase(fetchTransitionalReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransitionalReport.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.transitionalReport = action.payload;
      })
      .addCase(fetchTransitionalReport.rejected, (state, action) => {
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
      })
      .addCase(fetchLengthOfStayReport.pending, (state) => {
        state.los.loading = true;
        state.los.error = null;
      })
      .addCase(fetchLengthOfStayReport.fulfilled, (state, action) => {
        state.los.loading = false;
        state.los.data = action.payload;
      })
      .addCase(fetchLengthOfStayReport.rejected, (state, action) => {
        state.los.loading = false;
        state.los.error = action.payload as string;
      })
.addCase(fetchOpportunityDaysReport.pending, (state) => {
  state.opportunityLOS.loading = true;
  state.opportunityLOS.error = null;
})
.addCase(fetchOpportunityDaysReport.fulfilled, (state, action) => {
  state.opportunityLOS.loading = false;
  state.opportunityLOS.data = action.payload;
})
.addCase(fetchOpportunityDaysReport.rejected, (state, action) => {
  state.opportunityLOS.loading = false;
  state.opportunityLOS.error = action.payload as string;
});

  },
});

export const { clearReports } = reportSlice.actions;
export default reportSlice.reducer;
