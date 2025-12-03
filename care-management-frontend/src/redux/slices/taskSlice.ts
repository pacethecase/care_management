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

  taskNames: string[];          
  taskNamesLoading: boolean;       
  taskNamesError: string | null;
    successMessage: string | null;
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

export const startTask = createAsyncThunk<
  { taskId: number; version: number },
  { taskId: number; version: number },
  { rejectValue: string }
>(
  "tasks/startTask",
  async ({ taskId, version }, { rejectWithValue }) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/tasks/${taskId}/start`,
        { version },
        { withCredentials: true }
      );
      return res.data; 
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to start task");
    }
  }
);


export const completeTask = createAsyncThunk(
  "tasks/completeTask",
  async (
    {
      taskId,
      version,
      court_date,
      reason,
      missed_reason, 
    }: {
      taskId: number;
      version:number;
      court_date?: string;
      reason?: string;
      missed_reason?: string; 
    },
    { rejectWithValue }
  ) => {
    try {
      const payload: any = {version};
      if (court_date) payload.court_date = court_date;
      if (reason) payload.reason = reason;
      if (missed_reason) payload.missed_reason = missed_reason;

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
    { taskId, version, reason }: { taskId: number; version: number; reason: string },
    { rejectWithValue }
  ) => {
    try {
      await axios.post(
        `${BASE_URL}/tasks/${taskId}/missed`,
        { missed_reason: reason, version },
        { withCredentials: true }
      );
      return taskId;
    } catch (err: any) {
      const message =
        err.response?.data?.error || "Failed to start task";
      return rejectWithValue(message);
    }
  }
);

export const followUpTask = createAsyncThunk(
  "tasks/followUpTask",
  async (
    { taskId,  version, followUpReason }: { taskId: number; version: number; followUpReason: string },
    { rejectWithValue }
  ) => {
    try {
      await axios.post(
        `${BASE_URL}/tasks/${taskId}/follow-up`,
        { followUpReason,
          version, 
         },
        { withCredentials: true }
      );
      return taskId;
    } catch (err: any) {
      const message =
        err.response?.data?.error || "Failed to start task";
      return rejectWithValue(message);
    }
  }
);

export const updateTaskNoteMeta = createAsyncThunk<
  any,
  {
    taskId: number;
    version: number;
    data: {
      task_note?: string;
      include_note_in_report?: boolean;
      contact_info?: string;
      force?: boolean;   
    };
  },
  { rejectValue: any }
>(
  'tasks/updateTaskNoteMeta',
  async ({ taskId, version, data }, { rejectWithValue }) => {
    try {
      const res = await axios.patch(
        `${BASE_URL}/tasks/patient_tasks/${taskId}/note`,
        {
          ...data,
          version 
        },
        { withCredentials: true }
      );
      return res.data.task;
    } catch (err: any) {
      if (err.response) {
        return rejectWithValue({
          status: err.response.status,
          ...err.response.data
        });
      }

      return rejectWithValue({ status: 500, message: 'Unknown error' });
    }
  }
);


export const acknowledgeTask = createAsyncThunk(
  "tasks/acknowledgeTask",
  async (
    { taskId,version, reason }: { taskId: number; version:number;reason?: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await axios.patch(
        `${BASE_URL}/tasks/${taskId}/acknowledge`,
        { reason,version },
        { withCredentials: true }
      );
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || "Failed to acknowledge task");
    }
  }
);

export const createManualTask = createAsyncThunk(
  "tasks/createManualTask",
  async (
    {
      patientId,
      taskData,
    }: {
      patientId: number;
      taskData: {
        name: string;
        description: string;
        is_repeating: boolean;
        recurrence_interval?: number | null;
        is_overridable: boolean;
        condition_required?: string;
        category?: string;
        algorithm?: string;
      };
    },
    { rejectWithValue }
  ) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/tasks/patients/${patientId}/manual-task`,
        taskData,
        { withCredentials: true }
      );
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to create manual task");
    }
  }
);


export const fetchAllTaskNames = createAsyncThunk<
  string[], // list of task names
  void,
  { rejectValue: string }
>(
  "reports/fetchAllTaskNames",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${BASE_URL}/tasks/task-names`, {
        withCredentials: true,
      });
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch task names");
    }
  }
);

export const overrideTask = createAsyncThunk<
  { message: string; task: any },
  { patientTaskId: number;version: number; override_date: string; reason: string },
  { rejectValue: string }
>(
  "tasks/overrideTask",
  async ({ patientTaskId,version, override_date, reason }, { rejectWithValue }) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/tasks/${patientTaskId}/override`,
        { override_date,version, reason },
        { withCredentials: true }
      );
      return res.data;
    } catch (err: any) {
      const msg: string =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to override task";
      return rejectWithValue(msg);
    }
  }
);

export const decideOverride = createAsyncThunk<
  { message: string },
  { patientTaskId: number; decision: "Approved" | "Denied" },
  { rejectValue: string }
>(
  "tasks/decideOverride",
  async ({ patientTaskId, decision }, { rejectWithValue }) => {
    try {
      const res = await axios.patch(
        `${BASE_URL}/tasks/${patientTaskId}/overridedecision`, 
        { decision },
        { withCredentials: true }
      );
      return res.data;
    } catch (err: any) {
      const msg: string =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to decide override";
      return rejectWithValue(msg);
    }
  }
);


const taskSlice = createSlice({
  name: "tasks",
  initialState,
 
    reducers: {
        clearTaskError: (state) => {
          state.taskError = null;
        },
        clearGeneralError: (state) => {
          state.error = null;
        },
        resetTasks: (state) => {
          state.patientTasks = [];
          state.priorityTasks = [];
          state.missedTasks = [];
          state.error = null;
          state.taskError = null;
        },
         clearTaskMessages(state) {
           state.error = null;
          state.successMessage = null;
        },


  },
  extraReducers: (builder) => {
    builder
    .addCase(startTask.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(startTask.fulfilled, (state) => {
      state.loading = false;
    })
      .addCase(startTask.rejected, (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string"
          ? action.payload
          : "Failed to start task";
      })
      .addCase(completeTask.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.taskError = null;
    })
    .addCase(completeTask.fulfilled, (state) => {
      state.loading = false;
    })
    .addCase(completeTask.rejected, (state, action) => {
      state.loading = false;
      state.taskError =
        typeof action.payload === 'string'
          ? action.payload
          : 'Failed to complete task';
    })
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
      .addCase(followUpTask.fulfilled, (state, action) => {
        state.loading = false;
        const taskId = action.payload;
        const idx = state.patientTasks.findIndex(t => t.patient_task_id === taskId);
        if (idx !== -1) {
          state.patientTasks[idx].status = "Follow Up";
          state.patientTasks[idx].due_date = new Date().toISOString(); // or update with backend's `nextDue` if available
        }
      })

      .addCase(followUpTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
     .addCase(updateTaskNoteMeta.fulfilled, (state, action) => {
  const updatedTask = action.payload;
  const idx = state.patientTasks.findIndex(t => t.patient_task_id === updatedTask.id);
  if (idx !== -1) {
    state.patientTasks[idx] = {
      ...state.patientTasks[idx],
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
  (t) => t.patient_task_id === updatedTask.id
);


  if (index !== -1) {
    state.patientTasks[index] = {
      ...state.patientTasks[index],
      ...updatedTask,
    };
  }
})
.addCase(markTaskAsMissed.pending, (state) => {
  state.loading = true;
  state.taskError = null;
})
.addCase(markTaskAsMissed.fulfilled, (state, action) => {
  state.loading = false;
  const taskId = action.payload;
  const idx = state.patientTasks.findIndex(t => t.patient_task_id === taskId);
  if (idx !== -1) {
    state.patientTasks[idx].status = "Missed";
  }
})
.addCase(markTaskAsMissed.rejected, (state, action) => {
  state.loading = false;
  state.taskError = typeof action.payload === 'string'
    ? action.payload
    : 'Failed to mark task as missed';
})
.addCase(createManualTask.pending, (state) => {
  state.loading = true;
  state.taskError = null;
})
.addCase(createManualTask.fulfilled, (state, _action) => {
  state.loading = false;
  // Optional: You can toast here or refresh task list in your component after dispatch
})
.addCase(createManualTask.rejected, (state, action) => {
  state.loading = false;
  state.taskError =
    typeof action.payload === 'string'
      ? action.payload
      : 'Failed to create manual task';
})


.addCase(acknowledgeTask.rejected, (state, action) => {
  state.taskError = typeof action.payload === "string"
    ? action.payload
    : "Failed to acknowledge task";
})
.addCase(fetchAllTaskNames.pending, (state) => {
    state.taskNamesLoading = true;
    state.taskNamesError = null;
  })
  .addCase(fetchAllTaskNames.fulfilled, (state, action) => {
    state.taskNamesLoading = false;
    state.taskNames = action.payload;
  })
  .addCase(fetchAllTaskNames.rejected, (state, action) => {
    state.taskNamesLoading = false;
    state.taskNamesError = action.payload || "Unknown error";
  })
// in the same slice file
.addCase(overrideTask.pending, (state) => {
  state.loading = true;
  state.taskError = null;
})
.addCase(overrideTask.fulfilled, (state, action) => {
  state.loading = false;

  const updatedTask = action.payload.task;
  if (!updatedTask) {
    return;
  }

  const idx = state.patientTasks.findIndex(
    (t) => t.patient_task_id === updatedTask.id
  );
  if (idx !== -1) {
    state.patientTasks[idx] = {
      ...state.patientTasks[idx],
      patient_task_id: updatedTask.id,
      due_date: updatedTask.due_date,
      override_count: updatedTask.override_count,
      override_count_max: updatedTask.override_count_max,
      admin_override_approval: updatedTask.admin_override_approval,
      status_history: updatedTask.status_history,
    };
  }
})

.addCase(overrideTask.rejected, (state, action) => {
  state.loading = false;
  state.taskError = action.payload || "Failed to override task";
})
 .addCase(decideOverride.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(decideOverride.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = action.payload.message; 
      })
      .addCase(decideOverride.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to process override decision";
      });

  },
});

export default taskSlice.reducer;
