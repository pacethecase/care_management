import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL;

// ===============================
// PUBLIC: HOSPITALS + ORGANIZATIONS
// ===============================
export const fetchPublicHospitals = createAsyncThunk(
  "public/fetchHospitals",
  async (organization_id: string | undefined, thunkAPI) => {
    try {
      const url = organization_id
        ? `${API}/public/hospitals?organization_id=${organization_id}`
        : `${API}/public/hospitals`;

      const res = await axios.get(url);
      return res.data;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data || "Error fetching hospitals");
    }
  }
);

export const fetchPublicOrganizations = createAsyncThunk(
  "public/fetchOrganizations",
  async (_, thunkAPI) => {
    try {
      const res = await axios.get(`${API}/public/organizations`);
      return res.data;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.response?.data || "Error fetching organizations");
    }
  }
);

interface PublicState {
  hospitals: any[];
  organizations: any[];
  loading: boolean;
  error: string | null;
}

const initialState: PublicState = {
  hospitals: [],
  organizations: [],
  loading: false,
  error: null,
};

const publicSlice = createSlice({
  name: "public",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // HOSPITALS
    builder.addCase(fetchPublicHospitals.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(fetchPublicHospitals.fulfilled, (state, action) => {
      state.loading = false;
      state.hospitals = action.payload;
    });
    builder.addCase(fetchPublicHospitals.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // ORGANIZATIONS
    builder.addCase(fetchPublicOrganizations.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(fetchPublicOrganizations.fulfilled, (state, action) => {
      state.loading = false;
      state.organizations = action.payload;
    });
    builder.addCase(fetchPublicOrganizations.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
  },
});

export default publicSlice.reducer;
