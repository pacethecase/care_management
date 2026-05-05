// src/redux/slices/organizationSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { Organization } from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const fetchOrganizations = createAsyncThunk<
  Organization[],
  void,
  { rejectValue: string }
>("organizations/fetchOrganizations", async (_, { rejectWithValue }) => {
  try {
    const res = await axios.get(`${BASE_URL}/organizations`, { withCredentials: true });
    return res.data.organizations;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to load organizations");
  }
});

export const createOrganization = createAsyncThunk<
  Organization,
  { name: string; timezone: string },
  { rejectValue: string }
>("organizations/createOrganization", async ({ name, timezone }, { rejectWithValue }) => {
  try {
    const res = await axios.post(
      `${BASE_URL}/organizations`,
      { name, timezone },
      { withCredentials: true }
    );
    return res.data.organization;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to create organization");
  }
});

export const updateOrganization = createAsyncThunk<
  Organization,
  { orgId: number; name: string; timezone: string },
  { rejectValue: string }
>("organizations/updateOrganization", async ({ orgId, name, timezone }, { rejectWithValue }) => {
  try {
    const res = await axios.put(
      `${BASE_URL}/organizations/${orgId}`,
      { name, timezone },
      { withCredentials: true }
    );
    return res.data.organization;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to update organization");
  }
});

export const deleteOrganization = createAsyncThunk<
  number,
  number,
  { rejectValue: string }
>("organizations/deleteOrganization", async (orgId, { rejectWithValue }) => {
  try {
    await axios.delete(`${BASE_URL}/organizations/${orgId}`, { withCredentials: true });
    return orgId;
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.error || "Cannot delete organization while hospitals are attached"
    );
  }
});

export const assignHospitalToOrganization = createAsyncThunk<
  { orgId: number; hospitalId: number },
  { orgId: number; hospitalId: number },
  { rejectValue: string }
>("organizations/assignHospitalToOrganization", async ({ orgId, hospitalId }, { rejectWithValue }) => {
  try {
    await axios.post(
      `${BASE_URL}/organizations/assign`,
      { organization_id: orgId, hospital_id: hospitalId },
      { withCredentials: true }
    );
    return { orgId, hospitalId };
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to assign hospital");
  }
});

export const removeHospitalFromOrganization = createAsyncThunk<
  { hospitalId: number },
  { hospitalId: number },
  { rejectValue: string }
>("organizations/removeHospitalFromOrganization", async ({ hospitalId }, { rejectWithValue }) => {
  try {
    await axios.put(
      `${BASE_URL}/organizations/remove-hospital/${hospitalId}`,
      {},
      { withCredentials: true }
    );
    return { hospitalId };
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to remove hospital");
  }
});

// ─── State ────────────────────────────────────────────────────────────────────

interface OrganizationState {
  organizations: Organization[];
  loading: boolean;
  error: string | null;
  successMessage: string | null;
}

const initialState: OrganizationState = {
  organizations: [],
  loading: false,
  error: null,
  successMessage: null,
};

// ─── Slice ────────────────────────────────────────────────────────────────────

const organizationSlice = createSlice({
  name: "organizations",
  initialState,
  reducers: {
    clearOrgMessages(state) {
      state.error = null;
      state.successMessage = null;
    },
    // FIX: added clearOrganizations for logoutAndClearAll consistency
    clearOrganizations: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // fetchOrganizations
      .addCase(fetchOrganizations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOrganizations.fulfilled, (state, action) => {
        state.loading = false;
        state.organizations = action.payload;
      })
      .addCase(fetchOrganizations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Could not load organizations";
      })
      .addCase(createOrganization.fulfilled, (state, action) => {
        state.organizations.unshift(action.payload);
        state.successMessage = "Organization created successfully";
      })
      .addCase(createOrganization.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to create organization";
      })


      .addCase(updateOrganization.fulfilled, (state, action) => {
        const idx = state.organizations.findIndex((o) => o.id === action.payload.id);
        if (idx !== -1) state.organizations[idx] = action.payload;
        state.successMessage = "Organization updated successfully";
      })
      .addCase(updateOrganization.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to update organization";
      })
      .addCase(deleteOrganization.fulfilled, (state, action) => {
        state.organizations = state.organizations.filter((o) => o.id !== action.payload);
        state.successMessage = "Organization deleted successfully";
      })
      .addCase(deleteOrganization.rejected, (state, action) => {
        state.error = action.payload ?? "Cannot delete organization with active hospitals";
      })

      .addCase(assignHospitalToOrganization.fulfilled, (state) => {
        state.successMessage = "Hospital assigned to organization";
      })
      .addCase(assignHospitalToOrganization.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to assign hospital";
      })
      .addCase(removeHospitalFromOrganization.fulfilled, (state) => {
        state.successMessage = "Hospital removed from organization";
      })
      .addCase(removeHospitalFromOrganization.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to remove hospital";
      });
  },
});

export const { clearOrgMessages, clearOrganizations } = organizationSlice.actions;
export default organizationSlice.reducer;