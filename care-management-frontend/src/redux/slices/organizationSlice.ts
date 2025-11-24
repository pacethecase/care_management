import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import type { Organization } from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;



// 🔹 GET ALL ORGANIZATIONS
export const fetchOrganizations = createAsyncThunk<
  Organization[],
  void,
  { rejectValue: string }
>("organizations/fetchOrganizations", async (_, { rejectWithValue }) => {
  try {
    const res = await axios.get(`${BASE_URL}/organizations`, {
      withCredentials: true,
    });
    return res.data.organizations;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to load organizations");
  }
});

// 🔹 CREATE ORGANIZATION
export const createOrganization = createAsyncThunk<
  Organization,
  { name: string },
  { rejectValue: string }
>("organizations/createOrganization", async ({ name }, { rejectWithValue }) => {
  try {
    const res = await axios.post(
      `${BASE_URL}/organizations`,
      { name },
      { withCredentials: true }
    );
    return res.data.organization;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to create organization");
  }
});

// 🔹 DELETE ORGANIZATION
export const deleteOrganization = createAsyncThunk<
  number,
  number,
  { rejectValue: string }
>("organizations/deleteOrganization", async (orgId, { rejectWithValue }) => {
  try {
    await axios.delete(`${BASE_URL}/organizations/${orgId}`, {
      withCredentials: true,
    });
    return orgId;
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.error ||
        "Cannot delete organization while hospitals are attached"
    );
  }
});

// 🔹 ASSIGN HOSPITAL TO ORGANIZATION  ✅ FIXED
export const assignHospitalToOrganization = createAsyncThunk<
  { orgId: number; hospitalId: number },
  { orgId: number; hospitalId: number },
  { rejectValue: string }
>("organizations/assignHospitalToOrganization",
  async ({ orgId, hospitalId }, { rejectWithValue }) => {
    try {
      await axios.post(
        `${BASE_URL}/organizations/assign`,
        {
          organization_id: orgId,
          hospital_id: hospitalId
        },
        { withCredentials: true }
      );

      return { orgId, hospitalId };
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to assign hospital"
      );
    }
  }
);

// 🔹 REMOVE HOSPITAL FROM ORGANIZATION  ✅ FIXED
export const removeHospitalFromOrganization = createAsyncThunk<
  { hospitalId: number },
  { hospitalId: number },
  { rejectValue: string }
>("organizations/removeHospitalFromOrganization",
  async ({ hospitalId }, { rejectWithValue }) => {
    try {
      await axios.put(
        `${BASE_URL}/organizations/remove-hospital/${hospitalId}`,
        {},
        { withCredentials: true }
      );

      return { hospitalId };
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.error || "Failed to remove hospital"
      );
    }
  }
);

// ======================================================
// STATE INTERFACE
// ======================================================

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

// ======================================================
// SLICE
// ======================================================

const organizationSlice = createSlice({
  name: "organizations",
  initialState,
  reducers: {
    clearOrgMessages(state) {
      state.error = null;
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    // =============================
    // FETCH
    // =============================
    builder
      .addCase(fetchOrganizations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchOrganizations.fulfilled,
        (state, action: PayloadAction<Organization[]>) => {
          state.loading = false;
          state.organizations = action.payload;
        }
      )
      .addCase(fetchOrganizations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Could not load organizations";
      });

    // =============================
    // CREATE
    // =============================
    builder
      .addCase(
        createOrganization.fulfilled,
        (state, action: PayloadAction<Organization>) => {
          state.organizations.push(action.payload);
          state.successMessage = "Organization created successfully";
        }
      )
      .addCase(createOrganization.rejected, (state, action) => {
        state.error = action.payload || "Failed to create organization";
      });

    // =============================
    // DELETE
    // =============================
    builder
      .addCase(deleteOrganization.fulfilled, (state, action) => {
        state.organizations = state.organizations.filter(
          (org) => org.id !== action.payload
        );
        state.successMessage = "Organization deleted successfully";
      })
      .addCase(deleteOrganization.rejected, (state, action) => {
        state.error =
          action.payload || "Cannot delete organization with active hospitals";
      });

    // =============================
    // ASSIGN HOSPITAL
    // =============================
    builder.addCase(
      assignHospitalToOrganization.fulfilled,
      (state) => {
        state.successMessage = "Hospital assigned to organization";
      }
    );

    // =============================
    // REMOVE HOSPITAL
    // =============================
    builder.addCase(
      removeHospitalFromOrganization.fulfilled,
      (state) => {
        state.successMessage = "Hospital removed from organization";
      }
    );
  },
});

export const { clearOrgMessages } = organizationSlice.actions;
export default organizationSlice.reducer;
