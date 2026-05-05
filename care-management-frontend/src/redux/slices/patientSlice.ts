// src/redux/slices/patientSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { Patient } from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface PatientState {
  patients: Patient[];
  dischargedPatients: Patient[];
  dischargedCount: number;
  archivedPatients: Patient[];
  archivedCount: number;
  archivedLoading: boolean;
  archivedError: string | null;
  searchResults: Patient[];
  selectedPatient: Patient | null;
  loading: boolean;
  error: string | null;
  updateSuccess: boolean;
}

const initialState: PatientState = {
  patients: [],
  dischargedPatients: [],
  dischargedCount: 0,
  archivedPatients: [],
  archivedCount: 0,
  archivedLoading: false,
  archivedError: null,
  searchResults: [],
  selectedPatient: null,
  loading: false,
  error: null,
  updateSuccess: false,
};

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const fetchPatients = createAsyncThunk(
  "patients/fetchPatients",
  async (
    params: { hospitalId?: string; adminId?: number } | undefined,
    { rejectWithValue }
  ) => {
    try {
      const res = await axios.get(`${BASE_URL}/patients`, { params, withCredentials: true });
      return res.data as Patient[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch patients");
    }
  }
);

export const addPatient = createAsyncThunk(
  "patients/addPatient",
  async (
    patientData: { [key: string]: any; assignedStaffIds: { staff_id: string; access_level: "view" | "edit" }[] },
    { rejectWithValue }
  ) => {
    try {
      const res = await axios.post(`${BASE_URL}/patients`, patientData, { withCredentials: true });
      return res.data;
    } catch (err: any) {
      return rejectWithValue({ status: err.response?.status, data: err.response?.data });
    }
  }
);

export const fetchPatientById = createAsyncThunk(
  "patients/fetchById",
  async (patientId: number, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/patients/${patientId}`, { withCredentials: true });
      return res.data as Patient;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch patient");
    }
  }
);

export const dischargePatient = createAsyncThunk(
  "patients/dischargePatient",
  async (
    { patientId, version, dischargeNote }: { patientId: number; version: number; dischargeNote: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/patients/${patientId}/discharge`,
        { dischargeNote, version },
        { withCredentials: true }
      );
      return { patientId, message: res.data.message };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to discharge patient");
    }
  }
);

export const reactivatePatient = createAsyncThunk<
  { patientId: number },
  { patientId: number; version: number },
  { rejectValue: string }
>("patients/reactivatePatient", async ({ patientId, version }, { rejectWithValue }) => {
  try {
    await axios.patch(`${BASE_URL}/patients/${patientId}/reactivate`, { version }, { withCredentials: true });
    return { patientId };
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to reactivate patient");
  }
});

export const fetchDischargedPatients = createAsyncThunk<
  { count: number; patients: Patient[] },
  { start?: string; end?: string; hospitalId?: string } | void,
  { rejectValue: string }
>("patients/fetchDischargedPatients", async (params, { rejectWithValue }) => {
  try {
    const res = await axios.get(`${BASE_URL}/patients/discharged`, { params: params ?? {}, withCredentials: true });
    return res.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to fetch discharged patients");
  }
});

export const updatePatient = createAsyncThunk(
  "patients/updatePatient",
  async (
    {
      id,
      data,
      version,
    }: {
      id: number | string;
      data: { [key: string]: any; assignedStaffIds: { staff_id: string; access_level: "view" | "edit" }[] };
      version: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const res = await axios.patch(
        `${BASE_URL}/patients/${id}/update`,
        { ...data, version },
        { withCredentials: true }
      );
      return res.data.patient || { id, ...data };
    } catch (err: any) {
      return rejectWithValue(err.response?.data || "Update failed");
    }
  }
);

export const searchPatients = createAsyncThunk(
  "patients/search",
  async (
    {
      query,
      status = "active",
      start,
      end,
      hospitalId,
      adminId,
    }: {
      query: string;
      status?: "active" | "discharged" | "archived";
      start?: string;
      end?: string;
      hospitalId?: string;
      adminId?: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const params: Record<string, string | number> = { q: query, status };
      if (start)    params.start     = start;
      if (end)      params.end       = end;
      if (hospitalId) params.hospitalId = hospitalId;
      if (adminId)  params.adminId   = adminId;
      const res = await axios.get(`${BASE_URL}/patients/search`, { params, withCredentials: true });
      return res.data as Patient[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Search failed");
    }
  }
);

export const fetchPatientsByAdmin = createAsyncThunk<
  Patient[],
  number,
  { rejectValue: string }
>("patients/fetchByAdmin", async (adminId, { rejectWithValue }) => {
  try {
    const res = await axios.get(`${BASE_URL}/patients/by-admin/${adminId}`, { withCredentials: true });
    return res.data as Patient[];
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to fetch patients");
  }
});

export const updateCourtDate = createAsyncThunk(
  "patients/updateCourtDate",
  async (
    {
      patientId,
      type,
      newDate,
      version,
    }: {
      patientId: number;
      type: "guardianship" | "ltc";
      newDate: string;
      version: number;
    },
    { rejectWithValue }
  ) => {
    try {
      await axios.patch(
        `${BASE_URL}/patients/${patientId}/court-date`,
        { type, newDate, version },
        { withCredentials: true }
      );
      return { patientId, type, newDate };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Update failed");
    }
  }
);
export const archiveDischargedPatient = createAsyncThunk<
  { patientId: number },
  { patientId: number; reason?: string; version: number },
  { rejectValue: string }
>("patients/archiveDischargedPatient", async ({ patientId, reason, version }, { rejectWithValue }) => {
  try {
    await axios.post(`${BASE_URL}/patients/${patientId}/archive`, { reason, version }, { withCredentials: true });
    return { patientId };
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to archive patient");
  }
});

export const fetchArchivedPatients = createAsyncThunk<
  { count: number; patients: Patient[] },
  { start?: string; end?: string; hospitalId?: string },
  { rejectValue: string }
>("patients/fetchArchivedPatients", async (params, { rejectWithValue }) => {
  try {
    const res = await axios.get(`${BASE_URL}/patients/archived`, { params, withCredentials: true });
    return res.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to fetch archived patients");
  }
});

// ─── Slice ────────────────────────────────────────────────────────────────────

const patientsSlice = createSlice({
  name: "patients",
  initialState,
  reducers: {
    setPatients: (state, action) => { state.patients = action.payload; },
    clearPatients: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPatients.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchPatients.fulfilled, (state, action) => {
        state.loading = false;
        state.patients = action.payload;
      })
      .addCase(fetchPatients.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // addPatient
      .addCase(addPatient.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(addPatient.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.patient) state.patients.unshift(action.payload.patient);
      })
      .addCase(addPatient.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as any)?.data?.error || "Failed to add patient";
      })

      // fetchPatientById
      .addCase(fetchPatientById.fulfilled, (state, action) => {
        state.selectedPatient = action.payload;
      })
      .addCase(fetchPatientById.rejected, (state, action) => {
        state.error = action.payload as string;
      })

      // dischargePatient
      .addCase(dischargePatient.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(dischargePatient.fulfilled, (state, action) => {
        state.loading = false;
        state.patients = state.patients.filter(p => p.id !== action.payload.patientId);
      })
      .addCase(dischargePatient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // reactivatePatient
      .addCase(reactivatePatient.pending, (state) => { state.loading = true; })
      .addCase(reactivatePatient.fulfilled, (state, action) => {
        state.loading = false;
        state.dischargedPatients = state.dischargedPatients.filter(p => p.id !== action.payload.patientId);
        const p = state.patients.find(p => p.id === action.payload.patientId);
        if (p) { p.status = "Admitted"; p.discharge_note = null; p.discharge_date = null; }
      })
      .addCase(reactivatePatient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // fetchDischargedPatients
      .addCase(fetchDischargedPatients.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchDischargedPatients.fulfilled, (state, action) => {
        state.loading = false;
        state.dischargedPatients = action.payload.patients ?? [];
        state.dischargedCount    = action.payload.count    ?? 0;
      })
      .addCase(fetchDischargedPatients.rejected, (state, action) => {
        state.loading = false;
        state.dischargedPatients = [];
        state.dischargedCount = 0;
        state.error = action.payload as string;
      })

      // updatePatient
      .addCase(updatePatient.pending, (state) => { state.loading = true; state.updateSuccess = false; })
      .addCase(updatePatient.fulfilled, (state, action) => {
        state.loading = false;
        state.updateSuccess = true;
        const idx = state.patients.findIndex(p => p.id === action.payload.id);
        if (idx !== -1) state.patients[idx] = action.payload;
        if (state.selectedPatient?.id === action.payload.id) state.selectedPatient = action.payload;
      })
      .addCase(updatePatient.rejected, (state, action) => {
        state.loading = false;
        state.updateSuccess = false;
        state.error = (action.payload as any)?.error || "Update failed";
      })

      // searchPatients
      .addCase(searchPatients.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(searchPatients.fulfilled, (state, action) => {
        state.loading = false;
        state.searchResults = action.payload;
      })
      .addCase(searchPatients.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // fetchPatientsByAdmin
      .addCase(fetchPatientsByAdmin.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchPatientsByAdmin.fulfilled, (state, action) => {
        state.loading = false;
        state.patients = action.payload;
      })
      .addCase(fetchPatientsByAdmin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      .addCase(updateCourtDate.pending, (state) => {
          state.loading = true;
          state.updateSuccess = false;
          state.error = null;
        })
        .addCase(updateCourtDate.fulfilled, (state, action) => {
          state.loading = false;  
          state.updateSuccess = true;
          const { type, newDate } = action.payload;
          if (state.selectedPatient) {
            if (type === "guardianship") {
              state.selectedPatient.guardianship_court_date = newDate;
            } else {
              state.selectedPatient.ltc_court_date = newDate;
            }
          }
        })
        .addCase(updateCourtDate.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload as string;
          state.updateSuccess = false;
        })

      .addCase(fetchArchivedPatients.pending, (state) => { state.archivedLoading = true; state.archivedError = null; })
      .addCase(fetchArchivedPatients.fulfilled, (state, action) => {
        state.archivedLoading = false;
        state.archivedPatients = action.payload.patients ?? [];
        state.archivedCount    = action.payload.count    ?? 0;
      })
      .addCase(fetchArchivedPatients.rejected, (state, action) => {
        state.archivedLoading = false;
        state.archivedError = action.payload as string;
      })
      .addCase(archiveDischargedPatient.fulfilled, (state, action) => {
        state.dischargedPatients = state.dischargedPatients.filter(p => p.id !== action.payload.patientId);
      })
      .addCase(archiveDischargedPatient.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { clearPatients, setPatients } = patientsSlice.actions;
export default patientsSlice.reducer;