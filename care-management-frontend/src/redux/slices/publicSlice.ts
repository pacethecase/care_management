// src/redux/slices/publicSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL;

// Minimal public types — only what the signup form needs
interface PublicHospital {
  id: number;
  name: string;
  organization_id: number | null;
}

interface PublicOrganization {
  id: number;
  name: string;
}

interface PublicState {
  hospitals: PublicHospital[];
  organizations: PublicOrganization[];
  loading: boolean;
  error: string | null;
}

const initialState: PublicState = {
  hospitals: [],
  organizations: [],
  loading: false,
  error: null,
};

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const fetchPublicHospitals = createAsyncThunk<
  PublicHospital[],
  string | undefined,
  { rejectValue: string }
>("public/fetchHospitals", async (organization_id, { rejectWithValue }) => {
  try {
    const url = organization_id
      ? `${API}/public/hospitals?organization_id=${organization_id}`
      : `${API}/public/hospitals`;
    const res = await axios.get(url);
    return res.data as PublicHospital[];
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Error fetching hospitals");
  }
});

export const fetchPublicOrganizations = createAsyncThunk<
  PublicOrganization[],
  void,
  { rejectValue: string }
>("public/fetchOrganizations", async (_, { rejectWithValue }) => {
  try {
    const res = await axios.get(`${API}/public/organizations`);
    return res.data as PublicOrganization[];
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Error fetching organizations");
  }
});

// ─── Slice ────────────────────────────────────────────────────────────────────

const publicSlice = createSlice({
  name: "public",
  initialState,
  reducers: {
    // FIX: added clearPublic for logout consistency — even though this is
    // public data, clearing it prevents stale org/hospital lists on re-login
    clearPublic: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // fetchPublicHospitals
      .addCase(fetchPublicHospitals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPublicHospitals.fulfilled, (state, action) => {
        state.loading = false;
        state.hospitals = action.payload;
      })
      .addCase(fetchPublicHospitals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Error fetching hospitals";
      })

      // fetchPublicOrganizations
      .addCase(fetchPublicOrganizations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPublicOrganizations.fulfilled, (state, action) => {
        state.loading = false;
        state.organizations = action.payload;
      })
      .addCase(fetchPublicOrganizations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Error fetching organizations";
      });
  },
});

export const { clearPublic } = publicSlice.actions;
export default publicSlice.reducer;