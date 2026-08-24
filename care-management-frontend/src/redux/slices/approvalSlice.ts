// src/redux/slices/approvalSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export interface ApprovalRequest {
  id: number;
  name: string;
  description: string | null;
  estimated_amount: number; 
  status: "Pending" | "Approved" | "Denied";
  requested_at: string;
  decided_at: string | null;
  decision_note: string | null;
  patient_id: number;
  patient_name: string;
  patient_mrn?: string | null;
  patient_age?: number | null;
  hospital_id: number;
  hospital_name: string;
  requested_by: number | null;
  requested_by_name: string | null;
  decided_by: number | null;
  decided_by_name: string | null;
}

export interface ApprovalsReport {
  totals: {
    totalRequests: number;
    pendingCount: number;
    approvedCount: number;
    deniedCount: number;
    totalEstimatedAmount: number;
    approvedAmount: number;
    avgTurnaroundHours: number;
  };
  byHospital: {
    hospitalId: number;
    hospitalName: string;
    totalRequests: number;
    pendingCount: number;
    approvedCount: number;
    deniedCount: number;
    totalEstimatedAmount: number;
    approvedAmount: number;
  }[];
}

interface ApprovalState {
  list: ApprovalRequest[];
  report: ApprovalsReport | null;
  deciders: ApprovalDecider[];  
  decidersLoading: boolean;   
  loading: boolean;
  error: string | null;
  approvalError: string | null;
  successMessage: string | null;
}
export interface ApprovalDecider {
  id: number;
  name: string;
}

const initialState: ApprovalState = {
  list: [],
  report: null,
  loading: false,
  deciders: [],        
  decidersLoading: false,
  error: null,
  approvalError: null,
  successMessage: null,
};

// ─── Thunks ───────────────────────────────────────────────────────────────────
// NOTE: backend mounts approvalRoutes at "/approval" (see server.js:
// app.use("/approval", approvalRoutes)), so every call here is prefixed
// with /approval to match.

export const createApprovalRequest = createAsyncThunk(
  "approvals/createApprovalRequest",
  async (
    { patientId, name, description, estimated_amount, patient_task_id }:
    { patientId: number; name: string; description?: string; estimated_amount: number; patient_task_id?: number },
    { rejectWithValue }
  ) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/approval/patients/${patientId}/approval-requests`,
        { name, description, estimated_amount, patient_task_id },
        { withCredentials: true }
      );
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to submit approval request");
    }
  }
);

export const loadApprovals = createAsyncThunk(
  "approvals/loadApprovals",
  async (
    params: { hospitalId?: string | number; status?: string; includeDischarged?: boolean; decidedBy?: string | number } | undefined,
    { rejectWithValue }
  ) => {
    try {
      const res = await axios.get(`${BASE_URL}/approval/approval-requests`, {
        params,
        withCredentials: true,
      });
      return res.data as ApprovalRequest[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to load approvals");
    }
  }
);

export const loadApprovalsReport = createAsyncThunk(
  "approvals/loadApprovalsReport",
  async (
    params: { hospitalId?: string | number; start?: string; end?: string; includeDischarged?: boolean; decidedBy?: string | number } | undefined,
    { rejectWithValue }
  ) => {
    try {
      const res = await axios.get(`${BASE_URL}/approval/approval-requests/report`, {
        params,
        withCredentials: true,
      });
      return res.data as ApprovalsReport;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to load approvals report");
    }
  }
);

export const decideApproval = createAsyncThunk(
  "approvals/decideApproval",
  async (
    { id, decision, decision_note }: { id: number; decision: "Approved" | "Denied"; decision_note?: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await axios.patch(
        `${BASE_URL}/approval/approval-requests/${id}/decision`,
        { decision, decision_note },
        { withCredentials: true }
      );
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to decide approval");
    }
  }
);

export const loadApprovalDeciders = createAsyncThunk(
  "approvals/loadApprovalDeciders",
  async (
    params: { hospitalId?: string | number } | undefined,
    { rejectWithValue }
  ) => {
    try {
      const res = await axios.get(`${BASE_URL}/approval/approvals/deciders`, {
        params,
        withCredentials: true,
      });
      return res.data as ApprovalDecider[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to load deciders");
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const approvalSlice = createSlice({
  name: "approvals",
  initialState,
  reducers: {
    clearApprovalError: (state) => { state.approvalError = null; },
    clearApprovalMessages: (state) => { state.error = null; state.successMessage = null; },
    resetApprovals: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // createApprovalRequest
      .addCase(createApprovalRequest.pending, (state) => { state.loading = true; state.approvalError = null; })
      .addCase(createApprovalRequest.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = action.payload?.message || "Approval request submitted";
      })
      .addCase(createApprovalRequest.rejected, (state, action) => {
        state.loading = false;
        state.approvalError = action.payload as string || "Failed to submit approval request";
      })

      // loadApprovals
      .addCase(loadApprovals.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loadApprovals.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
      .addCase(loadApprovals.rejected, (state, action) => {
        state.loading = false;
        state.list = [];
        state.error = action.payload as string || "Failed to load approvals";
      })

      // decideApproval
      .addCase(decideApproval.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(decideApproval.fulfilled, (state, action) => {
        state.loading = false;
        const updated = action.payload?.request;
        if (!updated) return;
        const idx = state.list.findIndex(r => r.id === updated.id);
        if (idx !== -1) state.list[idx] = { ...state.list[idx], ...updated };
      })
      .addCase(decideApproval.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || "Failed to decide approval";
      })

      // loadApprovalsReport
      .addCase(loadApprovalsReport.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loadApprovalsReport.fulfilled, (state, action) => { state.loading = false; state.report = action.payload; })
      .addCase(loadApprovalsReport.rejected, (state, action) => {
        state.loading = false;
        state.report = null;
        state.error = action.payload as string || "Failed to load approvals report";
      })
            // loadApprovalDeciders
      .addCase(loadApprovalDeciders.pending, (state) => { state.decidersLoading = true; })
      .addCase(loadApprovalDeciders.fulfilled, (state, action) => {
        state.decidersLoading = false;
        state.deciders = action.payload;
      })
      .addCase(loadApprovalDeciders.rejected, (state) => {
        state.decidersLoading = false;
        state.deciders = [];
      });
  },
});

export const { clearApprovalError, clearApprovalMessages, resetApprovals } = approvalSlice.actions;
export default approvalSlice.reducer;