// src/redux/slices/taskSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { Task } from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface TaskState {
  patientTasks: Task[];
  priorityTasks: Task[];
  missedTasks: Task[];
  loading: boolean;
  error: string | null;
  taskError: string | null;
  successMessage: string | null;
  taskNames: string[];
  taskNamesLoading: boolean;
  taskNamesError: string | null;
}

const initialState: TaskState = {
  patientTasks: [],
  priorityTasks: [],
  missedTasks: [],
  loading: false,
  error: null,
  taskError: null,
  successMessage: null,
  taskNames: [],
  taskNamesLoading: false,
  taskNamesError: null,
};

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const loadPatientTasks = createAsyncThunk(
  "tasks/loadPatientTasks",
  async (patientId: number, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/patients/${patientId}/tasks`, { withCredentials: true });
      return res.data as Task[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to load patient tasks");
    }
  }
);

export const loadPriorityTasks = createAsyncThunk(
  "tasks/loadPriorityTasks",
  async (patientId: number | null, { rejectWithValue }) => {
    try {
      const url = patientId
        ? `${BASE_URL}/tasks/priority?patientId=${patientId}`
        : `${BASE_URL}/tasks/priority`;
      const res = await axios.get(url, { withCredentials: true });
      return res.data as Task[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to load priority tasks");
    }
  }
);

export const loadMissedTasks = createAsyncThunk(
  "tasks/loadMissedTasks",
  async (patientId: number | null, { rejectWithValue }) => {
    try {
      const url = patientId
        ? `${BASE_URL}/tasks/missed?patientId=${patientId}`
        : `${BASE_URL}/tasks/missed`;
      const res = await axios.get(url, { withCredentials: true });
      return res.data as Task[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to load missed tasks");
    }
  }
);

export const startTask = createAsyncThunk<
  { taskId: number; version: number; status: string; started_at: string },
  { taskId: number; version: number },
  { rejectValue: string }
>("tasks/startTask", async ({ taskId, version }, { rejectWithValue }) => {
  try {
    const res = await axios.post(`${BASE_URL}/tasks/${taskId}/start`, { version }, { withCredentials: true });
    return res.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to start task");
  }
});

export const completeTask = createAsyncThunk(
  "tasks/completeTask",
  async (
    { taskId, version, court_date, reason, missed_reason }:
    { taskId: number; version: number; court_date?: string; reason?: string; missed_reason?: string },
    { rejectWithValue }
  ) => {
    try {
      const payload: any = { version };
      if (court_date)    payload.court_date    = court_date;
      if (reason)        payload.reason        = reason;
      if (missed_reason) payload.missed_reason = missed_reason;
      const res = await axios.post(`${BASE_URL}/tasks/${taskId}/complete`, payload, { withCredentials: true });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to complete task");
    }
  }
);

export const markTaskAsMissed = createAsyncThunk(
  "tasks/markTaskAsMissed",
  async (
    { taskId, version, reason }: { taskId: number; version: number; reason: string },
    { rejectWithValue }
  ) => {
    try {
      await axios.post(`${BASE_URL}/tasks/${taskId}/missed`, { missed_reason: reason, version }, { withCredentials: true });
      return taskId;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to mark task as missed");
    }
  }
);

export const followUpTask = createAsyncThunk(
  "tasks/followUpTask",
  async (
    { taskId, version, followUpReason }: { taskId: number; version: number; followUpReason: string },
    { rejectWithValue }
  ) => {
    try {
      await axios.post(`${BASE_URL}/tasks/${taskId}/follow-up`, { followUpReason, version }, { withCredentials: true });
      return taskId;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to follow up task");
    }
  }
);

export const updateTaskNoteMeta = createAsyncThunk<
  any,
  { taskId: number; version: number; data: { task_note?: string; include_note_in_report?: boolean; contact_info?: string } },
  { rejectValue: any }
>("tasks/updateTaskNoteMeta", async ({ taskId, version, data }, { rejectWithValue }) => {
  try {
    const res = await axios.patch(
      `${BASE_URL}/tasks/patient_tasks/${taskId}/note`,
      { ...data, version },
      { withCredentials: true }
    );
    return res.data.task;
  } catch (err: any) {
    return rejectWithValue(err.response ? { status: err.response.status, ...err.response.data } : { status: 500, message: "Unknown error" });
  }
});

export const acknowledgeTask = createAsyncThunk(
  "tasks/acknowledgeTask",
  async (
    { taskId, version, reason }: { taskId: number; version: number; reason?: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await axios.patch(`${BASE_URL}/tasks/${taskId}/acknowledge`, { reason, version }, { withCredentials: true });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to acknowledge task");
    }
  }
);

export const createManualTask = createAsyncThunk(
  "tasks/createManualTask",
  async (
    { patientId, taskData }: {
      patientId: number;
      taskData: {
        name: string; description: string; is_repeating: boolean;
        recurrence_interval?: number | null; is_overridable: boolean;
        condition_required?: string; category?: string; algorithm?: string;
      };
    },
    { rejectWithValue }
  ) => {
    try {
      const res = await axios.post(`${BASE_URL}/tasks/patients/${patientId}/manual-task`, taskData, { withCredentials: true });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to create manual task");
    }
  }
);

export const fetchAllTaskNames = createAsyncThunk<string[], void, { rejectValue: string }>(
  "reports/fetchAllTaskNames",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/tasks/task-names`, { withCredentials: true });
      return res.data as string[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch task names");
    }
  }
);

export const overrideTask = createAsyncThunk<
  { message: string; task?: any },
  { patientTaskId: number; version: number; override_date: string; reason: string },
  { rejectValue: string }
>("tasks/overrideTask", async ({ patientTaskId, version, override_date, reason }, { rejectWithValue }) => {
  try {
    const res = await axios.post(
      `${BASE_URL}/tasks/${patientTaskId}/override`,
      { override_date, version, reason },
      { withCredentials: true }
    );
    return res.data;
  } catch (err: any) {
    return rejectWithValue(err?.response?.data?.error || err?.message || "Failed to override task");
  }
});

export const decideOverride = createAsyncThunk<
  { message: string },
  { patientTaskId: number; decision: "Approved" | "Denied" },
  { rejectValue: string }
>("tasks/decideOverride", async ({ patientTaskId, decision }, { rejectWithValue }) => {
  try {
    const res = await axios.patch(
      `${BASE_URL}/tasks/${patientTaskId}/overridedecision`,
      { decision },
      { withCredentials: true }
    );
    return res.data;
  } catch (err: any) {
    return rejectWithValue(err?.response?.data?.error || err?.message || "Failed to decide override");
  }
});

// ─── Slice ────────────────────────────────────────────────────────────────────

const taskSlice = createSlice({
  name: "tasks",
  initialState,
  reducers: {
    clearTaskError:   (state) => { state.taskError = null; },
    clearGeneralError: (state) => { state.error = null; },
    clearTaskMessages: (state) => { state.error = null; state.successMessage = null; },
    // FIX: resetTasks returns initialState so everything resets cleanly
    resetTasks: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // loadPatientTasks
      .addCase(loadPatientTasks.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loadPatientTasks.fulfilled, (state, action) => { state.loading = false; state.patientTasks = action.payload; })
      .addCase(loadPatientTasks.rejected, (state, action) => {
        state.loading = false;
        state.patientTasks = [];
        state.taskError = (action.payload as any)?.error || action.payload as string || "Failed to fetch tasks";
      })

      // loadPriorityTasks
      .addCase(loadPriorityTasks.fulfilled, (state, action) => { state.priorityTasks = action.payload; })
      .addCase(loadPriorityTasks.rejected, (state, action) => { state.error = action.payload as string; })

      // loadMissedTasks
      .addCase(loadMissedTasks.fulfilled, (state, action) => { state.missedTasks = action.payload; })
      .addCase(loadMissedTasks.rejected, (state, action) => { state.error = action.payload as string; })

      // startTask
      .addCase(startTask.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(startTask.fulfilled, (state, action) => {
        state.loading = false;
        // FIX: update task status in local state immediately
        const idx = state.patientTasks.findIndex(t => t.patient_task_id === action.payload.taskId);
        if (idx !== -1) {
          state.patientTasks[idx].status     = action.payload.status;
          state.patientTasks[idx].started_at = action.payload.started_at;
          state.patientTasks[idx].version    = action.payload.version;
        }
      })
      .addCase(startTask.rejected, (state, action) => { state.loading = false; state.error = action.payload ?? "Failed to start task"; })

      // completeTask
      .addCase(completeTask.pending, (state) => { state.loading = true; state.error = null; state.taskError = null; })
      .addCase(completeTask.fulfilled, (state) => { state.loading = false; })
      .addCase(completeTask.rejected, (state, action) => { state.loading = false; state.taskError = action.payload as string || "Failed to complete task"; })

      // markTaskAsMissed
      .addCase(markTaskAsMissed.pending, (state) => { state.loading = true; state.taskError = null; })
      .addCase(markTaskAsMissed.fulfilled, (state, action) => {
        state.loading = false;
        const idx = state.patientTasks.findIndex(t => t.patient_task_id === action.payload);
        if (idx !== -1) state.patientTasks[idx].status = "Missed";
      })
      .addCase(markTaskAsMissed.rejected, (state, action) => { state.loading = false; state.taskError = action.payload as string || "Failed to mark task as missed"; })

      // followUpTask
      .addCase(followUpTask.pending, (state) => { state.loading = true; })
      .addCase(followUpTask.fulfilled, (state, action) => {
        state.loading = false;
        const idx = state.patientTasks.findIndex(t => t.patient_task_id === action.payload);
        if (idx !== -1) state.patientTasks[idx].status = "Follow Up";
      })
      .addCase(followUpTask.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; })

      // updateTaskNoteMeta
      .addCase(updateTaskNoteMeta.fulfilled, (state, action) => {
        const updated = action.payload;
        if (!updated) return;
        const idx = state.patientTasks.findIndex(t => t.patient_task_id === updated.id);
        if (idx !== -1) state.patientTasks[idx] = { ...state.patientTasks[idx], ...updated };
      })
      .addCase(updateTaskNoteMeta.rejected, (state, action) => { state.error = action.payload as string; })

      // acknowledgeTask
      .addCase(acknowledgeTask.fulfilled, (state, action) => {
        const updated = action.payload?.task || action.payload;
        if (!updated?.id) return;
        const idx = state.patientTasks.findIndex(t => t.patient_task_id === updated.id);
        if (idx !== -1) state.patientTasks[idx] = { ...state.patientTasks[idx], ...updated };
      })
      .addCase(acknowledgeTask.rejected, (state, action) => { state.taskError = action.payload as string || "Failed to acknowledge task"; })

      // createManualTask
      .addCase(createManualTask.pending, (state) => { state.loading = true; state.taskError = null; })
      .addCase(createManualTask.fulfilled, (state) => { state.loading = false; })
      .addCase(createManualTask.rejected, (state, action) => { state.loading = false; state.taskError = action.payload as string || "Failed to create manual task"; })

      // fetchAllTaskNames
      .addCase(fetchAllTaskNames.pending, (state) => { state.taskNamesLoading = true; state.taskNamesError = null; })
      .addCase(fetchAllTaskNames.fulfilled, (state, action) => { state.taskNamesLoading = false; state.taskNames = action.payload; })
      .addCase(fetchAllTaskNames.rejected, (state, action) => { state.taskNamesLoading = false; state.taskNamesError = action.payload ?? "Unknown error"; })

      // overrideTask
      .addCase(overrideTask.pending, (state) => { state.loading = true; state.taskError = null; })
      .addCase(overrideTask.fulfilled, (state, action) => {
        state.loading = false;
        const updated = action.payload.task;
        if (!updated) return;
        const idx = state.patientTasks.findIndex(t => t.patient_task_id === updated.id);
        if (idx !== -1) {
          state.patientTasks[idx] = {
            ...state.patientTasks[idx],
            due_date:               updated.due_date,
            override_count:         updated.override_count,
            override_count_max:     updated.override_count_max,
            admin_override_approval: updated.admin_override_approval,
          };
        }
      })
      .addCase(overrideTask.rejected, (state, action) => { state.loading = false; state.taskError = action.payload ?? "Failed to override task"; })

      // decideOverride
      .addCase(decideOverride.pending, (state) => { state.loading = true; state.error = null; state.successMessage = null; })
      .addCase(decideOverride.fulfilled, (state, action) => { state.loading = false; state.successMessage = action.payload.message; })
      .addCase(decideOverride.rejected, (state, action) => { state.loading = false; state.error = action.payload ?? "Failed to process override decision"; });
  },
});

export const { clearTaskError, clearGeneralError, clearTaskMessages, resetTasks } = taskSlice.actions;
export default taskSlice.reducer;