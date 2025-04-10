// src/redux/slices/noteSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

const BASE_URL = "http://localhost:5001";

// 🧾 Types
interface Note {
  id: number;
  patient_id: number;
  staff_id: number;
  nurse_name?: string;
  note_text: string;
  created_at: string;
}

interface NoteState {
  notes: Note[];
  loading: boolean;
  error: string | null;
}

const initialState: NoteState = {
  notes: [],
  loading: false,
  error: null,
};

// ✅ Fetch Notes for a Patient
export const fetchPatientNotes = createAsyncThunk(
  "notes/fetchPatientNotes",
  async (patientId: number, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${BASE_URL}/notes/${patientId}`, {
        withCredentials: true,
      });
      return res.data as Note[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to fetch notes");
    }
  }
);

// ✅ Add Note to Patient
export const addPatientNote = createAsyncThunk(
  "notes/addPatientNote",
  async (
    {
      patientId,
      staff_id,
      note_text,
    }: { patientId: number; staff_id: number; note_text: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/notes/${patientId}`,
        { staff_id, note_text },
        { withCredentials: true }
      );
      return res.data as Note;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.error || "Failed to add note");
    }
  }
);

// ✅ Update Existing Note (Optional)
export const updatePatientNote = createAsyncThunk(
  "notes/updatePatientNote",
  async (
    { noteId, note_text }: { noteId: number; note_text: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await axios.put(
        `${BASE_URL}/notes/${noteId}`,
        { note_text },
        { withCredentials: true }
      );
      return res.data as Note;
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
      .addCase(fetchPatientNotes.fulfilled, (state, action: PayloadAction<Note[]>) => {
        state.loading = false;
        state.notes = action.payload;
      })
      .addCase(fetchPatientNotes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      .addCase(addPatientNote.fulfilled, (state, action: PayloadAction<Note>) => {
        state.notes.unshift(action.payload); // add new note to top
      })
      .addCase(addPatientNote.rejected, (state, action) => {
        state.error = action.payload as string;
      })

      .addCase(updatePatientNote.fulfilled, (state, action: PayloadAction<Note>) => {
        const idx = state.notes.findIndex((n) => n.id === action.payload.id);
        if (idx !== -1) state.notes[idx] = action.payload;
      })
      .addCase(updatePatientNote.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { clearNotes } = noteSlice.actions;
export default noteSlice.reducer;
