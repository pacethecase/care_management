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
  async (patientId: number | null, { rejectWithValue }) => {
    try {
      const url = patientId
        ? `${BASE_URL}/tasks/priority?patientId=${patientId}` // Include patientId in query if available
        : `${BASE_URL}/tasks/priority`; // No patientId, get all tasks

      const res = await axios.get(url, {
        withCredentials: true,
      });
      console.log(res.data);
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
        ? `${BASE_URL}/tasks/missed?patientId=${patientId}` // Include patientId in query if available
        : `${BASE_URL}/tasks/missed`; // No patientId, get all tasks

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
    async ({ taskId, court_date }: { taskId: number; court_date?: string }, { rejectWithValue }) => {
      try {
        await axios.post(
          `${BASE_URL}/tasks/${taskId}/complete`,
          court_date ? { court_date } : {},
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



export const followUpTask = createAsyncThunk(
  "tasks/followUpTask",
  async (
    { taskId, followUpReason }: { taskId: number; followUpReason: string },
    { rejectWithValue }
  ) => {
    try {
      // Send the follow-up reason along with the taskId in the request body
      await axios.post(
        `${BASE_URL}/tasks/${taskId}/follow-up`,
        { followUpReason }, // Send the follow-up reason here
        { withCredentials: true }
      );
      return taskId; // Return taskId on success
    } catch (err: any) {
      return rejectWithValue("Failed to follow up"); // Handle errors
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
    taskError: null, 
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
        state.patientTasks = []; 
        state.taskError = typeof action.payload === 'string'
          ? action.payload
          : action.payload?.error || 'Failed to fetch tasks';
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
      });
  },
});

export default taskSlice.reducer;
