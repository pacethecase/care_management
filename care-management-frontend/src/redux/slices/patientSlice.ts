import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import type { Patient } from '../types'; // reuse your shared Patient type


const BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface PatientState {
  patients: Patient[];
  dischargedPatients: Patient[];
  dischargedCount: number;
  searchResults: Patient[];
  archivedPatients: Patient[];
  archivedLoading: boolean;
  archivedError: string | null;
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
  archivedLoading: false,
  archivedError: null,
  searchResults: [],
  selectedPatient: null,
  loading: false,
  error: null,
  updateSuccess: false,
};

export const fetchPatients = createAsyncThunk(
  "patients/fetchPatients",
  async (
    params: { hospitalId?: string; adminId?: number } | undefined,
    { rejectWithValue }
  ) => {
    try {
      const res = await axios.get(`${BASE_URL}/patients`, {
        params, 
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || "Failed to fetch patients");
    }
  }
);


export const addPatient = createAsyncThunk(
  'patients/addPatient',
  async (
    patientData: {
      [key: string]: any;
      assignedStaffIds: { staff_id: string; access_level: 'view' | 'edit' }[];
    },
    { rejectWithValue }) => {
    try {
      const response = await axios.post(`${BASE_URL}/patients`, patientData, {
        withCredentials: true,
      });
      return response.data;
    } catch (error: any) {
      const status = error.response?.status;
      const data = error.response?.data;
      return rejectWithValue({ status, data });
    }
  }
);

export const fetchPatientById = createAsyncThunk(
  'patients/fetchById',
  async (patientId: number, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/patients/${patientId}`, {
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || 'Failed to fetch patient');
    }
  }
);

export const dischargePatient = createAsyncThunk(
  'patients/dischargePatient',
  async ({ patientId, dischargeNote }: { patientId: number; dischargeNote: string }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${BASE_URL}/patients/${patientId}/discharge`, { dischargeNote }, {
        withCredentials: true,
      });
      return { patientId, message: response.data.message };
    } catch (error: any) {
      return rejectWithValue(error.response?.data || 'Failed to discharge patient');
    }
  }
);

export const reactivatePatient = createAsyncThunk<
  { patientId: number },
  number,
  { rejectValue: string }
>('patients/reactivatePatient', async (patientId, { rejectWithValue }) => {
  try {
    await axios.patch(`${BASE_URL}/patients/${patientId}/reactivate`, {}, {
      withCredentials: true,
    });
    return { patientId };
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || 'Failed to reactivate patient');
  }
});

export const fetchDischargedPatients = createAsyncThunk<
  { count: number; patients: Patient[] },
  { start?: string; end?: string; hospitalId?: string } | void,
  { rejectValue: string }
>(
  "patients/fetchDischargedPatients",
  async (params, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${BASE_URL}/patients/discharged`, {
        params,
        withCredentials: true,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue("Failed to fetch discharged patients");
    }
  }
);


export const updatePatient = createAsyncThunk(
  'patients/updatePatient',
  async (
    {
      id,
      data,
    }: {
      id: number | string;
      data: { [key: string]: any; assignedStaffIds: { staff_id: string; access_level: 'view' | 'edit' }[] };
    },
    { rejectWithValue }) => {
    try {
      const res = await axios.patch(`${BASE_URL}/patients/${id}/update`, data, {
        withCredentials: true,
      });
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
      adminId
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

      if (start) params.start = start;
      if (end) params.end = end;
      if (hospitalId) params.hospitalId = hospitalId;
      if (adminId) params.adminId = adminId;

      const res = await axios.get(`${BASE_URL}/patients/search`, {
        params,
        withCredentials: true,
      });

      return res.data;
    } catch (err: any) {
      console.error("❌ searchPatients error:", err);
      return rejectWithValue(err.response?.data || "Search failed");
    }
  }
);

export const fetchPatientsByAdmin = createAsyncThunk<
Patient[],
number,
{ rejectValue: string }
>(
'patients/fetchByAdmin',
async (adminId, { rejectWithValue }) => {
  try {
    const res = await axios.get(`${BASE_URL}/patients/by-admin/${adminId}`, { withCredentials: true });
    console.log("✅ fetchPatientsByAdmin response:", res.data);
    return res.data;
  } catch (err: any) {
    console.error("❌ fetchPatientsByAdmin error:", err.response?.data);
    return rejectWithValue(err.response?.data?.error || 'Failed to fetch patients');
  }
}
);

export const updateCourtDate = createAsyncThunk(
  "patients/updateCourtDate",
  async (
    {
      patientId,
      type,
      newDate,
    }: { patientId: number; type: "guardianship" | "ltc"; newDate: string },
    { rejectWithValue }
  ) => {
    try {
      await axios.patch(
        `${BASE_URL}/patients/${patientId}/court-date`,
        {
          type,
          newDate,
        },
        {
          withCredentials: true,
        }
      );

      return { patientId, type, newDate };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || "Update failed");
    }
  }
);


export const archiveDischargedPatient = createAsyncThunk<
  { patientId: number },                               
  { patientId: number; reason?: string },             
  { rejectValue: string }
>("patients/archiveDischargedPatient", async ({ patientId, reason }, { rejectWithValue }) => {
  try {
    await axios.post(`${BASE_URL}/patients/${patientId}/archive`, { reason }, { withCredentials: true });
    return { patientId };
  } catch (e: any) {
    return rejectWithValue(e?.response?.data?.error || "Failed to archive patient");
  }
});

export const fetchArchivedPatients = createAsyncThunk<
  { count: number; patients: Patient[] },
  { start?: string; end?: string; hospitalId?: string },
  { rejectValue: string }
>(
  "patients/fetchArchivedPatients",
  async (params, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${BASE_URL}/patients/archived`, {
        params,
        withCredentials: true,
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data || "Failed to fetch archived patients"
      );
    }
  }
);



const patientsSlice = createSlice({
  name: 'patients',
  initialState,
  reducers: {
     setPatients: (state, action) => {
      state.patients = action.payload;
    },
    clearPatients: (state) => {
      state.patients = [];  
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPatients.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPatients.fulfilled, (state, action) => {
        state.loading = false;
        state.patients = action.payload;
      })
      .addCase(fetchPatients.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(addPatient.fulfilled, (state, action) => {
        state.patients.push(action.payload.patient);
        state.loading = false;
      })
      .addCase(addPatient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addPatient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchPatientById.fulfilled, (state, action) => {
        state.selectedPatient = action.payload;
      })
      .addCase(dischargePatient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(dischargePatient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      .addCase(dischargePatient.fulfilled, (state, action) => {
        state.patients = state.patients.map((patient) =>
          patient.id === action.payload.patientId
            ? {
                ...patient,
                status: 'Discharged',
                discharge_note: 'Added',
                discharge_date: new Date().toISOString(),
              }
            : patient
        );
        state.loading = false;
      })
     .addCase(fetchDischargedPatients.fulfilled, (state, action) => {
        state.dischargedPatients = action.payload.patients || [];
        state.dischargedCount = action.payload.count || 0;
        state.loading = false;
      })
    .addCase(fetchDischargedPatients.rejected, (state, action) => {
      state.loading = false;
      state.dischargedPatients = [];
      state.dischargedCount = 0;
      state.error = action.payload as string;
    })


      .addCase(updatePatient.fulfilled, (state, action) => {
        const updated = action.payload;
        const index = state.patients.findIndex((p) => p.id === updated.id);
        if (index !== -1) {
          state.patients[index] = updated;
        }
      
        // Also update the selectedPatient if it matches
        if (state.selectedPatient?.id === updated.id) {
          state.selectedPatient = updated;
        }
      })
      
      .addCase(searchPatients.fulfilled, (state, action) => {
        state.searchResults = action.payload;
        state.loading = false;
      })
      .addCase(reactivatePatient.fulfilled, (state, action) => {
        const { patientId } = action.payload;
      
        // Remove from discharged
        state.dischargedPatients = state.dischargedPatients.filter(p => p.id !== patientId);
      
        // Optional: refetch full list or mark patient as active again
        const reactivated = state.patients.find(p => p.id === patientId);
        if (reactivated) {
          reactivated.status = 'Admitted';
          reactivated.discharge_note = null;
          reactivated.discharge_date = null;
        }
      
        state.loading = false;
      })
      .addCase(reactivatePatient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
     
      .addCase(fetchPatientsByAdmin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
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
        const { patientId, type, newDate } = action.payload;

        if (state.selectedPatient?.id === patientId) {
          if (type === "guardianship") {
            state.selectedPatient.guardianship_court_datetime = newDate;
          } else {
            state.selectedPatient.ltc_court_datetime = newDate;
          }
        }

        state.loading = false;
        state.updateSuccess = true;
      })
      .addCase(updateCourtDate.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.updateSuccess = false;
      })
       .addCase(fetchArchivedPatients.pending, (state) => {
        state.archivedLoading = true;
        state.archivedError = null;
      })
      .addCase(fetchArchivedPatients.fulfilled, (state, action) => {
        state.archivedLoading = false;
        state.archivedPatients = action.payload.patients || [];
        state.archivedError = null;
      })
      .addCase(fetchArchivedPatients.rejected, (state, action) => {
        state.archivedLoading = false;
        state.archivedError = action.payload as string;
      })
      .addCase(archiveDischargedPatient.fulfilled, (state, action) => {
        state.dischargedPatients = state.dischargedPatients.filter(
          p => p.id !== action.payload.patientId
        );

        state.archivedPatients = state.archivedPatients.filter(
          p => p.id !== action.payload.patientId
        );
      });

        
  },
});

export const { clearPatients } = patientsSlice.actions;
export default patientsSlice.reducer;
