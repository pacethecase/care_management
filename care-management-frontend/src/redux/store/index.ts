// src/redux/store/index.ts
import { configureStore } from "@reduxjs/toolkit";
import userReducer from "../slices/userSlice";
import patientsReducer from "../slices/patientSlice";
import taskReducer from "../slices/taskSlice";
import noteReducer from "../slices/noteSlice";
import reportReducer from "../slices/reportSlice";
import algorithmReducer from "../slices/algorithmSlice";
import notificationReducer from "../slices/notificationSlice";
import hospitalReducer from "../slices/hospitalSlice";
import adminReducer from "../slices/adminSlice";
import organizationReducer from "../slices/organizationSlice";
import publicReducer from "../slices/publicSlice";

export const store = configureStore({
  reducer: {
    user: userReducer,
    patients: patientsReducer,
    tasks: taskReducer,
    notes: noteReducer,
    reports: reportReducer,
    algorithms: algorithmReducer,
    notifications: notificationReducer,
    hospitals: hospitalReducer,
    admin: adminReducer,
    organizations: organizationReducer,
    public: publicReducer,
  },

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;