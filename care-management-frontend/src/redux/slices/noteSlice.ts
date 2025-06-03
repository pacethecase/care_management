import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { Note } from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface NoteState {
  notes: Note[];
   addLoading?: boolean;
     loading: boolean;
  updateLoading?: boolean;
  error: string | null;
}

const initialState: NoteState = {
  notes: [],
  loading:false,
  addLoading: false,
  updateLoading: false,
  error: null,
};

// ✅ Fetch Notes for a Patient
export const fetchPatientNotes = createAsyncThunk<
  Note[],                         // Return type
  number,                         // patientId
  { rejectValue: string }         // Reject value
>(
  "notes/fetchPatientNotes",
  async (patientId, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/notes/${patientId}`, {
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch notes");
    }
  }
);

// ✅ Add Note to Patient
export const addPatientNote = createAsyncThunk<
  Note,
  { patientId: number; staff_id: number; note_text: string },
  { rejectValue: string }
>(
  "notes/addPatientNote",
  async ({ patientId, staff_id, note_text }, { rejectWithValue }) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/notes/${patientId}`,
        { staff_id, note_text },
        { withCredentials: true }
      );
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to add note");
    }
  }
);

// ✅ Update Existing Note
export const updatePatientNote = createAsyncThunk<
  Note,
  { noteId: number; note_text: string },
  { rejectValue: string }
>(
  "notes/updatePatientNote",
  async ({ noteId, note_text }, { rejectWithValue }) => {
    try {
      const res = await axios.put(
        `${BASE_URL}/notes/${noteId}`,
        { note_text },
        { withCredentials: true }
      );
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to update note");
    }
  }
);

// ✅ Slice
const noteSlice = createSlice({
  name: "notes",
  initialState,
  reducers: {
    clearNotes: (state) => {
      state.notes = [];
      state.error = null;
      state.loading = false;
      
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPatientNotes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPatientNotes.fulfilled, (state, action) => {
        state.loading = false;
        state.notes = action.payload;
      })
      .addCase(addPatientNote.pending, (state) => {
          state.addLoading = true;
        })
        .addCase(addPatientNote.fulfilled, (state, action) => {
          state.addLoading = false;
          state.notes.unshift(action.payload);
        })
        .addCase(addPatientNote.rejected, (state, action) => {
          state.addLoading = false;
          state.error = typeof action.payload === "string" ? action.payload : "Failed to add note";
        })

          .addCase(updatePatientNote.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updatePatientNote.fulfilled, (state, action) => {
        state.loading = false;
        const idx = state.notes.findIndex((n) => n.id === action.payload.id);
        if (idx !== -1) {
          state.notes[idx] = action.payload;
        }
      })
      .addCase(updatePatientNote.rejected, (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string"
          ? action.payload
          : "Failed to update note";
      });

  },
});

export const { clearNotes } = noteSlice.actions;
export default noteSlice.reducer;
