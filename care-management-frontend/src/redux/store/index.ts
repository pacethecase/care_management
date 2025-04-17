import { configureStore } from "@reduxjs/toolkit";
import userReducer from "../slices/userSlice";
import patientsReducer from "../slices/patientSlice";
import taskReducer from "../slices/taskSlice";
import noteReducer from "../slices/noteSlice";
import reportReducer from "../slices/reportSlice";
import algorithmReducer from '../slices/algorithmSlice'; 
export const store = configureStore({
  reducer: {
    user: userReducer,
    patients: patientsReducer, 
    tasks: taskReducer,
    notes: noteReducer,
    reports: reportReducer, 
    algorithms: algorithmReducer,
  },
});
