// src/redux/slices/taskSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const BASE_URL = "http://localhost:5001";

// ✅ Thunks
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
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/tasks/priority`, {
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
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/tasks/missed`, {
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
  async (taskId: number, { rejectWithValue }) => {
    try {
      await axios.post(
        `${BASE_URL}/tasks/${taskId}/complete`,
        {},
        { withCredentials: true }
      );
      return taskId;
    } catch (err: any) {
      return rejectWithValue("Failed to complete task");
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

export const addMissedReason = createAsyncThunk(
  "tasks/addMissedReason",
  async (
    { taskId, reason }: { taskId: number; reason: string },
    { rejectWithValue }
  ) => {
    try {
      await axios.put(
        `${BASE_URL}/tasks/${taskId}/missed/reason`,
        { missed_reason: reason },
        { withCredentials: true }
      );
      return taskId;
    } catch (err: any) {
      return rejectWithValue("Failed to add missed reason");
    }
  }
);

// ✅ Slice
const taskSlice = createSlice({
  name: "tasks",
  initialState: {
    patientTasks: [],
    priorityTasks: [],
    missedTasks: [],
    loading: false,
    error: null,
  },
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
        state.error = action.payload as string;
      })
      .addCase(loadPriorityTasks.fulfilled, (state, action) => {
        state.priorityTasks = action.payload;
      })
      .addCase(loadMissedTasks.fulfilled, (state, action) => {
        state.missedTasks = action.payload;
      });
  },
});

export default taskSlice.reducer;
