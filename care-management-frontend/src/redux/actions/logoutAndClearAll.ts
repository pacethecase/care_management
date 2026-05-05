// src/redux/actions/logoutAndClearAll.ts
import { logoutUser, clearUser } from "../slices/userSlice";
import { clearPatients } from "../slices/patientSlice";
import { clearNotes } from "../slices/noteSlice";
import { clearReports } from "../slices/reportSlice";
import { clearAdmin } from "../slices/adminSlice";
import { clearHospitals } from "../slices/hospitalSlice";
import type { AppDispatch } from "../store";

// FIX: also clear notifications and algorithms slices on logout —
// they were being left in state, meaning a second user logging in on
// the same browser session would briefly see the previous user's data.
import { clearNotifications } from "../slices/notificationSlice";
import { clearAlgorithms } from "../slices/algorithmSlice";

export const logoutAndClearAll =
  (reason?: "manual" | "idle") => async (dispatch: AppDispatch) => {
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
    dispatch(clearNotifications());  
    dispatch(clearAlgorithms());     

    if (reason === "idle") {
      console.log("Session expired — logged out due to inactivity.");
    } else {
      console.log("User manually logged out.");
    }
  };