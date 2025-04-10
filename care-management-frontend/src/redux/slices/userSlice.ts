import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

interface UserInfo {
  id: number | null;
  name: string;
  email: string;
  is_admin: boolean;
  is_staff: boolean;
  is_verified: boolean;
}

interface UserState {
  user: UserInfo | null;
  staffs: UserInfo[];
  loading: boolean;
  error: string | null;
  authLoaded: boolean;
}

const initialState: UserState = {
  user: null,
  staffs: [],
  loading: false,
  error: null,
  authLoaded: false,
};

// Thunks
export const signupUser = createAsyncThunk(
  "user/signupUser",
  async (data: any, { rejectWithValue }) => {
    try {
      const response = await axios.post("http://localhost:5001/auth/signup", data);
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
      const response = await axios.post("http://localhost:5001/auth/login", data, {
        withCredentials: true,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || "Login failed");
    }
  }
);

export const fetchCurrentUser = createAsyncThunk(
  "user/fetchCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get("http://localhost:5001/auth/me", {
        withCredentials: true,
      });
      return response.data.user;
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 404) {
        return null; 
      }
      return rejectWithValue(error.response?.data || "Failed to fetch user");
    }
  }
);

export const fetchStaffs = createAsyncThunk(
  "user/fetchStaffs",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get("http://localhost:5001/users/staffs", {
        withCredentials: true,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Failed to fetch staffs");
    }
  }
);

export const logoutUser = createAsyncThunk(
  "user/logoutUser",
  async (_, { rejectWithValue }) => {
    try {
      await axios.post("http://localhost:5001/auth/logout", {}, { withCredentials: true });
      return true;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || "Logout failed");
    }
  }
);

// Slice
const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    clearUser: (state) => {
      state.user = null;
      state.staffs = [];
      state.error = null;
      state.loading = false;
    },
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
      });
  },
});

export const { clearUser } = userSlice.actions;
export default userSlice.reducer;
