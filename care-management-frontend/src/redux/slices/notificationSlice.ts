import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import type { Notification } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;
interface NotificationState {
  items: Notification[];
  loading: boolean;
  error: string | null;
}

const initialState: NotificationState = {
  items: [],
  loading: false,
  error: null,
};

// Thunks
export const fetchNotifications = createAsyncThunk<
  Notification[],      // Return type
  void,                // Arg type
  { rejectValue: string }
>(
  'notifications/fetchNotifications',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/notifications`, { withCredentials: true });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to fetch notifications');
    }
  }
);

export const clearAllNotificationsThunk = createAsyncThunk<
  boolean,
  void,
  { rejectValue: string }
>('notifications/clearAll', async (_, { rejectWithValue }) => {
  try {
    await axios.delete(`${BASE_URL}/notifications/clear`, { withCredentials: true });
    return true;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || 'Failed to clear notifications');
  }
});

export const markAllRead = createAsyncThunk<
  boolean,
  void,
  { rejectValue: string }
>(
  'notifications/markAllRead',
  async (_, { rejectWithValue }) => {
    try {
      await axios.patch(`${BASE_URL}/notifications/mark-all-read`, {}, { withCredentials: true });
      return true;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to mark notifications read');
    }
  }
);
export const deleteNotificationThunk = createAsyncThunk(
  "notifications/delete",
  async (id: number) => {
    await axios.delete(`${BASE_URL}/notifications/${id}`, {
      withCredentials: true  // ✅ Required for cookies/session to be sent
    });
    return id;
  }
);

// Slice
const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: (state, action: { payload: Notification }) => {
      state.items.unshift(action.payload);
    },
    clearNotifications: (state) => {
      state.items = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === 'string' ? action.payload : 'Failed to fetch notifications';
      })
    
      .addCase(markAllRead.pending, (state) => {
          state.loading = true;
          state.error = null;
        })
          .addCase(markAllRead.fulfilled, (state) => {
         state.loading = false;
        state.items = state.items.map((n) => ({ ...n, read: true }));
      })
        .addCase(markAllRead.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload as string;
        })
      

      .addCase(clearAllNotificationsThunk.fulfilled, (state) => {
        state.items = [];
        state.loading = false;
      })
        .addCase(clearAllNotificationsThunk.pending, (state) => {
          state.loading = true;
          state.error = null;
        })
        .addCase(clearAllNotificationsThunk.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload as string;
        })
       
       .addCase(deleteNotificationThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.filter((n) => n.id !== action.payload);
      }) 
      .addCase(deleteNotificationThunk.pending, (state) => {
          state.loading = true;
          state.error = null;
        })
        .addCase(deleteNotificationThunk.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload as string;
        });
  },
});

export const { addNotification, clearNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;
