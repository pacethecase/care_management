// file: src/redux/actions/logoutAndClearAll.ts
import { logoutUser } from "../slices/userSlice";
import { clearPatients } from "../slices/patientSlice";
import { clearNotes } from "../slices/noteSlice";
import { clearUser } from "../slices/userSlice";
import type { AppDispatch } from "../store";
import { clearReports } from "../slices/reportSlice";
import { clearAdmin } from "../slices/adminSlice";
import { clearHospitals } from "../slices/hospitalSlice";
export const logoutAndClearAll = (reason?: "manual" | "idle") => async (dispatch: AppDispatch) => {
  try {
    await dispatch(logoutUser()).unwrap();
  } catch (err) {
    console.warn("Backend logout failed, clearing locally anyway:", err);
  }

  dispatch(clearUser());
  dispatch(clearPatients());
  dispatch(clearNotes());
dispatch(clearReports());
dispatch(clearAdmin());
dispatch(clearHospitals());

  if (reason === "idle") {
    console.log("Logged out due to inactivity.");
  } else {
    console.log("User manually logged out.");
  }
};

