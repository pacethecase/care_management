// redux/slices/userSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import type { UserInfo, UserRole } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface UserState {
  user: UserInfo | null;
  staffs: UserInfo[];
  allUsers: UserInfo[];
  admins: { id: number; name: string }[];
  loading: boolean;
  adminLoading: boolean;
  error: string | null;
  authLoaded: boolean;
  message?: string;
  starRatings: Record<number, { stars: number; completionRate: number }>;
}

const initialState: UserState = {
  user: null,
  staffs: [],
  admins: [],
  allUsers: [],
  loading: false,
  adminLoading: false,
  error: null,
  authLoaded: false,
  starRatings: {},
};

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const signupUser = createAsyncThunk(
  'user/signupUser',
  async (
    data: {
      name: string;
      email: string;
      password: string;
      role: UserRole;           // FIX: send role, not 3 booleans
      organization_id?: number;
      hospital_id?: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await axios.post(`${BASE_URL}/auth/signup`, data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Signup failed');
    }
  }
);

export const loginUser = createAsyncThunk(
  'user/loginUser',
  async (data: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, data, {
        withCredentials: true,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Login failed');
    }
  }
);

export const fetchCurrentUser = createAsyncThunk(
  'user/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${BASE_URL}/auth/me`, {
        withCredentials: true,
      });
      return response.data.user as UserInfo;
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 404) {
        return null;
      }
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch user');
    }
  }
);

export const fetchStaffs = createAsyncThunk<any, { hospitalId?: string } | void>(
  'user/fetchStaffs',
  async (arg, { rejectWithValue }) => {
    const { hospitalId } = arg || {};
    try {
      const response = await axios.get(`${BASE_URL}/users/staffs`, {
        params: hospitalId ? { hospitalId } : {},
        withCredentials: true,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch staffs');
    }
  }
);

export const fetchAdmins = createAsyncThunk<any, { hospitalId?: string } | void>(
  'users/fetchAdmins',
  async (arg, { rejectWithValue }) => {
    const { hospitalId } = arg || {};
    try {
      const res = await axios.get(`${BASE_URL}/users/admins`, {
        params: hospitalId ? { hospitalId } : {},
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to fetch admins');
    }
  }
);

export const fetchAllUsers = createAsyncThunk<any, { hospitalId?: string } | void>(
  'admin/fetchAllUsers',
  async (arg, { rejectWithValue }) => {
    const { hospitalId } = arg || {};
    try {
      const res = await axios.get(`${BASE_URL}/users/all`, {
        params: hospitalId ? { hospitalId } : {},
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load all users');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'user/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      await axios.post(`${BASE_URL}/auth/logout`, {}, { withCredentials: true });
      return true;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Logout failed');
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'user/updateUserProfile',
  async (
    { id, name, password }: { id: number; name: string; password?: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await axios.put(
        `${BASE_URL}/users/${id}`,
        { name, password },
        { withCredentials: true }
      );
      return response.data.user as UserInfo;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update profile');
    }
  }
);

export const sendResetLink = createAsyncThunk(
  'auth/sendResetLink',
  async (email: string, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${BASE_URL}/auth/forgot-password`, { email });
      return res.data.message as string;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to send reset link');
    }
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async (
    { token, email, newPassword }: { token: string; email: string; newPassword: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await axios.post(`${BASE_URL}/auth/reset-password`, {
        token,
        email,
        newPassword,
      });
      return res.data.message as string;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to reset password');
    }
  }
);

export const fetchStarRating = createAsyncThunk(
  'user/fetchStarRating',
  async (staffId: number, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/users/${staffId}/star-rating`, {
        withCredentials: true,
      });
      return { staffId, ...res.data };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to fetch star rating');
    }
  }
);

// ─── Role helpers (use these everywhere instead of checking booleans) ─────────
// Import and use these in your components/middleware instead of user.is_admin etc.
export const isAdmin = (user: UserInfo | null) => user?.role === 'admin';
export const isSuperAdmin = (user: UserInfo | null) => user?.role === 'super_admin';
export const isStaff = (user: UserInfo | null) => user?.role === 'staff';
export const isAdminOrAbove = (user: UserInfo | null) =>
  user?.role === 'admin' || user?.role === 'super_admin';

// ─── Slice ────────────────────────────────────────────────────────────────────
const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearUser: (state) => {
      state.user = null;
      state.staffs = [];
      state.allUsers = [];
      state.admins = [];
      state.error = null;
      state.loading = false;
      state.message = undefined;
      state.starRatings = {};
    },
    clearError: (state) => {
      state.error = null;
    },
    clearMessage: (state) => {
      state.message = undefined;
    },
  },
  extraReducers: (builder) => {
    builder
      // ── signup ──
      .addCase(signupUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signupUser.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
      })
      .addCase(signupUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // ── login ──
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.loading = false;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // ── fetchCurrentUser ──
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload || null;
        state.authLoaded = true;
        state.loading = false;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.user = null;
        state.authLoaded = true;
        state.loading = false;
        state.error = action.payload as string;
      })

      // ── fetchStaffs ──
      .addCase(fetchStaffs.fulfilled, (state, action) => {
        state.staffs = action.payload;
      })
      .addCase(fetchStaffs.rejected, (state, action) => {
        state.staffs = [];
        state.error = action.payload as string;
      })

      // ── fetchAdmins ──
      .addCase(fetchAdmins.pending, (state) => {
        state.adminLoading = true;
        state.error = null;
      })
      .addCase(fetchAdmins.fulfilled, (state, action) => {
        state.admins = action.payload;
        state.adminLoading = false;
      })
      .addCase(fetchAdmins.rejected, (state, action) => {
        state.admins = [];
        state.adminLoading = false;
        state.error = action.payload as string;
      })

      // ── fetchAllUsers ──
      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        state.allUsers = action.payload;
      })
      .addCase(fetchAllUsers.rejected, (state, action) => {
        state.error = action.payload as string;
      })

      // ── logout ──
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.authLoaded = true;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.error = action.payload as string;
      })

      // ── reset password flow ──
      .addCase(sendResetLink.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendResetLink.fulfilled, (state, action) => {
        state.loading = false;
        state.message = action.payload;
      })
      .addCase(sendResetLink.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(resetPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state, action) => {
        state.loading = false;
        state.message = action.payload;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // ── updateUserProfile ──
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.user = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // ── starRatings ──
      .addCase(fetchStarRating.fulfilled, (state, action) => {
        const { staffId, stars, completionRate } = action.payload;
        state.starRatings[staffId] = { stars, completionRate };
      });
  },
});

export const { clearUser, clearError, clearMessage } = userSlice.actions;
export default userSlice.reducer;