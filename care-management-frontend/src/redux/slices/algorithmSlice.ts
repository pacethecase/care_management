import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { Patient, AlgorithmPatientCount } from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface AlgorithmState {
  patientCounts: AlgorithmPatientCount[];
  patientsByAlgorithm: Patient[];
  loading: boolean;
  loadingCounts: boolean;
  loadingPatients: boolean;
  error: string | null;
}

const initialState: AlgorithmState = {
  patientCounts: [],
  patientsByAlgorithm: [],
  loading: false,
  loadingCounts: false,
  loadingPatients: false,
  error: null,
};


export const loadPatientCountsByAlgorithm = createAsyncThunk<
  AlgorithmPatientCount[],         // return type
  string | undefined,              // ⬅ accepts hospitalId or undefined
  { rejectValue: string }
>(
  "algorithms/loadPatientCountsByAlgorithm",
  async (hospitalId, { rejectWithValue }) => {
    try {
      const url = hospitalId
        ? `${BASE_URL}/algorithms/counts?hospitalId=${hospitalId}`
        : `${BASE_URL}/algorithms/counts`;

      const response = await axios.get(url, {
        withCredentials: true,
      });

      return response.data;
    } catch (error: any) {
      return rejectWithValue("Failed to fetch patient counts by algorithm");
    }
  }
);

export const loadPatientsByAlgorithm = createAsyncThunk<
  Patient[],
  { algorithm: string; hospitalId?: string },
  { rejectValue: string }
>(
  'algorithms/loadPatientsByAlgorithm',
  async ({ algorithm, hospitalId }, { rejectWithValue }) => {
    try {
      const url = hospitalId
        ? `${BASE_URL}/algorithms/${algorithm}?hospitalId=${hospitalId}`
        : `${BASE_URL}/algorithms/${algorithm}`;

      const response = await axios.get(url, { withCredentials: true });
      return response.data;

    } catch (error: any) {
      return rejectWithValue('Failed to fetch patients for the algorithm');
    }
  }
);

const algorithmSlice = createSlice({
  name: "algorithms",
  initialState,
  reducers: {
    resetAlgorithmState: (state) => {
      state.patientCounts = [];
      state.patientsByAlgorithm = [];
      state.loadingCounts = false;
      state.loadingPatients = false;
      state.loading = false;
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    builder
      // COUNT
      .addCase(loadPatientCountsByAlgorithm.pending, (state) => {
        state.loadingCounts = true;
        state.error = null;
      })
      .addCase(loadPatientCountsByAlgorithm.fulfilled, (state, action) => {
        state.loadingCounts = false;
        state.patientCounts = action.payload;
      })
      .addCase(loadPatientCountsByAlgorithm.rejected, (state, action) => {
        state.loadingCounts = false;
        state.error =
          typeof action.payload === "string"
            ? action.payload
            : "Error loading algorithm counts";
      })

      // PATIENTS LIST
      .addCase(loadPatientsByAlgorithm.pending, (state) => {
        state.loadingPatients = true;
        state.error = null;
      })
      .addCase(loadPatientsByAlgorithm.fulfilled, (state, action) => {
        state.loadingPatients = false;
        state.patientsByAlgorithm = action.payload;
      })
      .addCase(loadPatientsByAlgorithm.rejected, (state, action) => {
        state.loadingPatients = false;
        state.error =
          typeof action.payload === "string"
            ? action.payload
            : "Error loading patients";
      });
  },
});

export default algorithmSlice.reducer;