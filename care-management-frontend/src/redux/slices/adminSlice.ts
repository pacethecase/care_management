import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { UnapprovedUser } from "../types";
import { fetchAllUsers } from "./userSlice";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface AdminState {
  unapprovedUsers: UnapprovedUser[];
  allUsers: UnapprovedUser[];
  hospitalMessage?: string;
  message?: string;
  loading: boolean;
  error: string | null;
}

const initialState: AdminState = {
  unapprovedUsers: [],
  allUsers: [],
  hospitalMessage: undefined,
  message: undefined,
  loading: false,
  error: null,
};

// ✅ Thunks
export const fetchUnapprovedUsers = createAsyncThunk(
  "admin/fetchUnapprovedUsers",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/admin/users/unapproved`, {
        withCredentials: true,
      });
      return res.data as UnapprovedUser[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch users");
    }
  }
);

export const approveUser = createAsyncThunk(
  "admin/approveUser",
  async (userId: number, { rejectWithValue }) => {
    try {
      await axios.patch(`${BASE_URL}/admin/users/approve/${userId}`, null, {
        withCredentials: true,
      });
      return userId;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to approve user");
    }
  }
);

export const rejectUser = createAsyncThunk(
  "admin/rejectUser",
  async (id: number, { rejectWithValue }) => {
    try {
      const res = await axios.put(
        `${BASE_URL}/admin/reject-user/${id}`,
        {},
        { withCredentials: true }
      );
      return { id, message: res.data.message };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to revoke access");
    }
  }
);

export const addHospital = createAsyncThunk(
  "admin/addHospital",
  async (data: { name: string }, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${BASE_URL}/admin/hospitals`, data, {
        withCredentials: true,
      });
      return res.data.message as string;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to add hospital");
    }
  }
);

export const deleteHospital = createAsyncThunk(
  "admin/deleteHospital",
  async (id: number, { rejectWithValue }) => {
    try {
      const res = await axios.delete(`${BASE_URL}/admin/hospitals/${id}`, {
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to delete hospital");
    }
  }
);

// ✅ Slice
const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {
    clearAdminError(state) {
      state.error = null;
    },
    clearHospitalMessage(state) {
      state.hospitalMessage = undefined;
    },
    clearAdmin() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUnapprovedUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUnapprovedUsers.fulfilled, (state, action) => {
        state.unapprovedUsers = action.payload;
        state.loading = false;
      })
      .addCase(fetchUnapprovedUsers.rejected, (state, action) => {
        state.error = action.payload as string;
        state.loading = false;
      })

      .addCase(approveUser.fulfilled, (state, action) => {
        state.unapprovedUsers = state.unapprovedUsers.filter(
          (user) => user.id !== action.payload
        );
      })
      .addCase(approveUser.rejected, (state, action) => {
        state.error = action.payload as string;
      })

    .addCase(rejectUser.fulfilled, (state, action) => {
  state.unapprovedUsers = state.unapprovedUsers.filter(
    (user) => user.id !== action.payload.id
  );
})

    .addCase(rejectUser.rejected, (state, action) => {
  state.error = action.payload as string; // NO toast here
})


      .addCase(addHospital.fulfilled, (state, action) => {
        state.hospitalMessage = action.payload;
      })
      .addCase(addHospital.rejected, (state, action) => {
        state.error = action.payload as string;
      })

      .addCase(deleteHospital.fulfilled, (state, action) => {
        state.hospitalMessage = action.payload.message;
      })
      .addCase(deleteHospital.rejected, (state, action) => {
        state.error = action.payload as string;
      })

      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        state.allUsers = action.payload;
      })
      .addCase(fetchAllUsers.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { clearAdminError, clearHospitalMessage, clearAdmin } = adminSlice.actions;
export default adminSlice.reducer;
