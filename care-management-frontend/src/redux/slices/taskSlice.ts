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
}

const initialState: TaskState = {
  patientTasks: [],
  priorityTasks: [],
  missedTasks: [],
  loading: false,
  error: null,
  taskError: null,
};

export const loadPatientTasks = createAsyncThunk(
  "tasks/loadPatientTasks",
  async (patientId: number, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/patients/${patientId}/tasks`, {
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || "Failed to load patient tasks");
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

      const res = await axios.get(url, {
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || "Failed to load priority tasks");
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

      const res = await axios.get(url, {
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || "Failed to load missed tasks");
    }
  }
);

export const startTask = createAsyncThunk(
  "tasks/startTask",
  async (taskId: number, { rejectWithValue }) => {
    try {
      await axios.post(
        `${BASE_URL}/tasks/${taskId}/start`,
        {},
        { withCredentials: true }
      );
      return taskId;
    } catch (err: any) {
      return rejectWithValue("Failed to start task");
    }
  }
);


export const completeTask = createAsyncThunk(
  "tasks/completeTask",
  async (
    {
      taskId,
      court_date,
      override_date,
    }: {
      taskId: number;
      court_date?: string;
      override_date?: string | null;
    },
    { rejectWithValue }
  ) => {
    try {
      const payload: any = {};
      if (court_date) payload.court_date = court_date;
      if (override_date) payload.override_date = override_date;

      const res = await axios.post(
        `${BASE_URL}/tasks/${taskId}/complete`,
        payload,
        { withCredentials: true }
      );
      return res.data;
    } catch (err: any) {
      const message = err.response?.data?.error || "Failed to complete task";
      return rejectWithValue(message);
    }
  }
);


export const markTaskAsMissed = createAsyncThunk(
  "tasks/markTaskAsMissed",
  async (
    { taskId, reason }: { taskId: number; reason: string },
    { rejectWithValue }
  ) => {
    try {
      await axios.post(
        `${BASE_URL}/tasks/${taskId}/missed`,
        { missed_reason: reason },
        { withCredentials: true }
      );
      return taskId;
    } catch (err: any) {
      return rejectWithValue("Failed to mark task as missed");
    }
  }
);

export const followUpTask = createAsyncThunk(
  "tasks/followUpTask",
  async (
    { taskId, followUpReason }: { taskId: number; followUpReason: string },
    { rejectWithValue }
  ) => {
    try {
      await axios.post(
        `${BASE_URL}/tasks/${taskId}/follow-up`,
        { followUpReason },
        { withCredentials: true }
      );
      return taskId;
    } catch (err: any) {
      return rejectWithValue("Failed to follow up");
    }
  }
);
export const updateTaskNoteMeta = createAsyncThunk<
  any,
  { taskId: number; data: {
    task_note?: string;
    include_note_in_report?: boolean;
    contact_info?: string;
  }},
  { rejectValue: string }
>(
  'tasks/updateTaskNoteMeta',
  async ({ taskId, data }, { rejectWithValue }) => {
    try {
      const res = await axios.patch(
        `${BASE_URL}/tasks/patient_tasks/${taskId}/note`,
        data,
        { withCredentials: true }
      );
      return res.data.task;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to update task note');
    }
  }
);

export const acknowledgeTask = createAsyncThunk(
  "tasks/acknowledgeTask",
  async (taskId: number, { rejectWithValue }) => {
    try {
      const res = await axios.patch(
        `${BASE_URL}/tasks/${taskId}/acknowledge`,
        {},
        { withCredentials: true }
      );
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || "Failed to acknowledge task");
    }
  }
);


const taskSlice = createSlice({
  name: "tasks",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadPatientTasks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadPatientTasks.fulfilled, (state, action) => {
        state.loading = false;
        state.patientTasks = action.payload;
      })
      .addCase(loadPatientTasks.rejected, (state, action) => {
        state.loading = false;
        state.patientTasks = [];
        state.taskError = typeof action.payload === 'string'
          ? action.payload
          : (action.payload as any)?.error|| 'Failed to fetch tasks';
      })
      .addCase(loadPriorityTasks.fulfilled, (state, action) => {
        state.priorityTasks = action.payload;
      })
      .addCase(loadMissedTasks.fulfilled, (state, action) => {
        state.missedTasks = action.payload;
      })
      .addCase(followUpTask.pending, (state) => {
        state.loading = true;
      })
      .addCase(followUpTask.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(followUpTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateTaskNoteMeta.fulfilled, (state, action) => {
        const updatedTask = action.payload;
        const index = state.patientTasks.findIndex((t) => t.task_id === updatedTask.id);
        if (index !== -1) {
          state.patientTasks[index] = {
            ...state.patientTasks[index],
            ...updatedTask,
          };
        }
      })
      .addCase(updateTaskNoteMeta.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      .addCase(acknowledgeTask.fulfilled, (state, action) => {
  const updatedTask = action.payload.task || action.payload;

  const index = state.patientTasks.findIndex(
    (t) => t.task_id === updatedTask.task_id
  );

  if (index !== -1) {
    state.patientTasks[index] = {
      ...state.patientTasks[index],
      ...updatedTask,
    };
  }
})
.addCase(acknowledgeTask.rejected, (state, action) => {
  state.taskError = typeof action.payload === "string"
    ? action.payload
    : "Failed to acknowledge task";
});

  },
});

export default taskSlice.reducer;
