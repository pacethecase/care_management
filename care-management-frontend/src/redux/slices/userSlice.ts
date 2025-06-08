import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { UserInfo } from "../types";


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
  has_global_access?:boolean;
}

const initialState: UserState = {
  user: null,
  staffs: [],
  admins: [],
  allUsers: [],
  loading: false,
  adminLoading: false,      // ✅ new field
  error: null,
  authLoaded: false,
};


// Thunks
export const signupUser = createAsyncThunk(
  "user/signupUser",
  async (data: any, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${BASE_URL}/auth/signup`, data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || "Signup failed");
    }
  }
);

export const loginUser = createAsyncThunk(
  "user/loginUser",
  async (data: any, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, data, {
        withCredentials: true,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || "Login failed");
    }
  }
);

export const sendResetLink = createAsyncThunk(
  "auth/sendResetLink",
  async (email: string, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${BASE_URL}/auth/forgot-password`, { email });
      return res.data.message as string;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to send reset link");
    }
  }
);

export const resetPassword = createAsyncThunk(
  "auth/resetPassword",
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
      return rejectWithValue(err.response?.data?.error || "Failed to reset password");
    }
  }
);

export const fetchCurrentUser = createAsyncThunk(
  "user/fetchCurrentUser",
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
      return rejectWithValue(error.response?.data?.error || "Failed to fetch user");
    }
  }
);

export const fetchStaffs = createAsyncThunk(
  "user/fetchStaffs",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${BASE_URL}/users/staffs`, {
        withCredentials: true,
      });
      return response.data as UserInfo[];
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || "Failed to fetch staffs");
    }
  }
);

export const logoutUser = createAsyncThunk(
  "user/logoutUser",
  async (_, { rejectWithValue }) => {
    try {
      await axios.post(`${BASE_URL}/auth/logout`, {}, { withCredentials: true });
      return true;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || "Logout failed");
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  "user/updateUserProfile",
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
      return rejectWithValue(error.response?.data?.error || "Failed to update profile");
    }
  }
);
export const fetchAdmins = createAsyncThunk(
  'users/fetchAdmins',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/users/admins`, { withCredentials: true });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || 'Failed to fetch admins');
    }
  }
);

export const fetchAllUsers = createAsyncThunk(
  "admin/fetchAllUsers",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/users/all`, {
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to load all users");
    }
  }
);


const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    clearUser: (state) => {
      state.user = null;
      state.staffs = [];
      state.error = null;
      state.loading = false;
      state.message = undefined;
       state.allUsers = [];  
        state.message = undefined;
        state.has_global_access = false;

    },
    clearError: (state) => {
        state.error = null;
      },
      clearMessage: (state) => {
        state.message = undefined;
      }
  },
  extraReducers: (builder) => {
    builder
      .addCase(signupUser.fulfilled, (state) => {
        state.error = null;
        state.loading = false;
      })
      .addCase(signupUser.rejected, (state, action) => {
        state.error = action.payload as string;
        state.loading = false;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.error = null;
        state.loading = false;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.error = action.payload as string;
        state.loading = false;
      })
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload || null;
        state.has_global_access = !!action.payload?.has_global_access;
        state.authLoaded = true;
        state.loading = false;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.user = null;
        state.authLoaded = true;
        state.error = action.payload as string;
        state.loading = false; 
      
      })
      .addCase(fetchStaffs.fulfilled, (state, action) => {
        state.staffs = action.payload;
      })
      .addCase(fetchStaffs.rejected, (state, action) => {
        state.staffs = [];
        state.error = action.payload as string;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.authLoaded = true;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      .addCase(sendResetLink.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendResetLink.fulfilled, (state, action) => {
        state.loading = false;
        state.message = action.payload as string;
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
        state.message = action.payload as string;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.user = action.payload;
        state.error = null;
        state.loading = false;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.error = action.payload as string;
        state.loading = false;
      })
    // fetchAdmins
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
  state.error = action.payload as string;
  state.adminLoading = false;
})
.addCase(fetchAllUsers.fulfilled, (state, action) => {
  state.allUsers = action.payload;
})

.addCase(fetchAllUsers.rejected, (state, action) => {
  state.error = action.payload as string;
});

  },
});

export const { clearUser } = userSlice.actions;
export default userSlice.reducer;
