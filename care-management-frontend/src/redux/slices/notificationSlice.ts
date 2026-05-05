// src/redux/slices/notificationSlice.ts
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

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const fetchNotifications = createAsyncThunk<
  Notification[],
  void,
  { rejectValue: string }
>('notifications/fetchNotifications', async (_, { rejectWithValue }) => {
  try {
    const res = await axios.get(`${BASE_URL}/notifications`, { withCredentials: true });
    return res.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || 'Failed to fetch notifications');
  }
});

export const markAllRead = createAsyncThunk<
  boolean,
  void,
  { rejectValue: string }
>('notifications/markAllRead', async (_, { rejectWithValue }) => {
  try {
    await axios.patch(`${BASE_URL}/notifications/mark-all-read`, {}, { withCredentials: true });
    return true;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || 'Failed to mark notifications read');
  }
});

export const markOneRead = createAsyncThunk<
  number,
  number,
  { rejectValue: string }
// FIX: was missing entirely — markNotificationRead exists on backend but had no thunk
>('notifications/markOneRead', async (id, { rejectWithValue }) => {
  try {
    await axios.patch(`${BASE_URL}/notifications/${id}/read`, {}, { withCredentials: true });
    return id;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || 'Failed to mark notification read');
  }
});

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

export const deleteNotificationThunk = createAsyncThunk<
  number,
  number,
  { rejectValue: string }
// FIX: was missing rejectValue type — errors were silently swallowed
>('notifications/delete', async (id, { rejectWithValue }) => {
  try {
    await axios.delete(`${BASE_URL}/notifications/${id}`, { withCredentials: true });
    return id;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || 'Failed to delete notification');
  }
});

// ─── Slice ────────────────────────────────────────────────────────────────────

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // Used by socket.io to push real-time notifications in
    addNotification: (state, action: { payload: Notification }) => {
      state.items.unshift(action.payload);
    },
    // FIX: clearNotifications now returns initialState for consistency
    // with all other slices and so loading/error are also reset
    clearNotifications: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // fetchNotifications
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
        state.error = action.payload ?? 'Failed to fetch notifications';
      })

      // markAllRead
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
        state.error = action.payload ?? 'Failed to mark all read';
      })

      // markOneRead — FIX: was missing, added to match backend
      .addCase(markOneRead.fulfilled, (state, action) => {
        const n = state.items.find((n) => n.id === action.payload);
        if (n) n.read = true;
      })
      .addCase(markOneRead.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to mark notification read';
      })

      // clearAllNotificationsThunk
      .addCase(clearAllNotificationsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(clearAllNotificationsThunk.fulfilled, (state) => {
        state.loading = false;
        state.items = [];
      })
      .addCase(clearAllNotificationsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to clear notifications';
      })

      // deleteNotificationThunk
      .addCase(deleteNotificationThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteNotificationThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.filter((n) => n.id !== action.payload);
      })
      .addCase(deleteNotificationThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to delete notification';
      });
  },
});

export const { addNotification, clearNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;