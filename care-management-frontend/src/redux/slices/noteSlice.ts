// src/redux/slices/noteSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import type { Note } from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface NoteState {
  notes: Note[];
  loading: boolean;
  addLoading: boolean;
  updateLoading: boolean;
  error: string | null;
}

const initialState: NoteState = {
  notes: [],
  loading: false,
  addLoading: false,
  updateLoading: false,
  error: null,
};

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const fetchPatientNotes = createAsyncThunk<
  Note[],
  number,
  { rejectValue: string }
>("notes/fetchPatientNotes", async (patientId, { rejectWithValue }) => {
  try {
    const res = await axios.get(`${BASE_URL}/notes/${patientId}`, {
      withCredentials: true,
    });
    return res.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to fetch notes");
  }
});

export const addPatientNote = createAsyncThunk<
  Note,
  { patientId: number; note_text: string },  // FIX: removed staff_id — backend derives it from req.user
  { rejectValue: string }
>("notes/addPatientNote", async ({ patientId, note_text }, { rejectWithValue }) => {
  try {
    const res = await axios.post(
      `${BASE_URL}/notes/${patientId}`,
      { note_text },                          // FIX: don't send staff_id from client
      { withCredentials: true }
    );
    return res.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to add note");
  }
});

export const updatePatientNote = createAsyncThunk<
  Note,
  { noteId: number; note_text: string },
  { rejectValue: string }
>("notes/updatePatientNote", async ({ noteId, note_text }, { rejectWithValue }) => {
  try {
    const res = await axios.put(
      `${BASE_URL}/notes/update/${noteId}`,
      { note_text },
      { withCredentials: true }
    );
    return res.data;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Failed to update note");
  }
});

export const deletePatientNote = createAsyncThunk<
  { noteId: number },
  { noteId: number },
  { rejectValue: string }
>("notes/deletePatientNote", async ({ noteId }, { rejectWithValue }) => {
  try {
    await axios.delete(`${BASE_URL}/notes/${noteId}`, { withCredentials: true });
    return { noteId };
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.error || "Delete failed");
  }
});

// ─── Slice ────────────────────────────────────────────────────────────────────

const noteSlice = createSlice({
  name: "notes",
  initialState,
  reducers: {
    clearNotes: () => initialState,  // FIX: return initialState resets everything cleanly
  },
  extraReducers: (builder) => {
    builder
      // fetchPatientNotes
      .addCase(fetchPatientNotes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPatientNotes.fulfilled, (state, action) => {
        state.loading = false;
        state.notes = action.payload;
      })
      .addCase(fetchPatientNotes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to fetch notes";
      })

      // addPatientNote
      .addCase(addPatientNote.pending, (state) => {
        state.addLoading = true;
        state.error = null;
      })
      .addCase(addPatientNote.fulfilled, (state, action) => {
        state.addLoading = false;
        state.notes.unshift(action.payload); // newest first
      })
      .addCase(addPatientNote.rejected, (state, action) => {
        state.addLoading = false;
        state.error = action.payload ?? "Failed to add note";
      })

      // updatePatientNote
      .addCase(updatePatientNote.pending, (state) => {
        state.updateLoading = true;  // FIX: use updateLoading not loading
        state.error = null;
      })
      .addCase(updatePatientNote.fulfilled, (state, action) => {
        state.updateLoading = false;
        const idx = state.notes.findIndex((n) => n.id === action.payload.id);
        if (idx !== -1) state.notes[idx] = action.payload;
      })
      .addCase(updatePatientNote.rejected, (state, action) => {
        state.updateLoading = false;
        state.error = action.payload ?? "Failed to update note";
      })

      // deletePatientNote
      .addCase(deletePatientNote.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deletePatientNote.fulfilled, (state, action) => {
        state.loading = false;
        state.notes = state.notes.filter((n) => n.id !== action.payload.noteId);
      })
      .addCase(deletePatientNote.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to delete note";
      });
  },
});

export const { clearNotes } = noteSlice.actions;
export default noteSlice.reducer;