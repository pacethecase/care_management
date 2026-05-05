// src/App.tsx
import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';

import type { AppDispatch } from './redux/store';
import { RootState } from './redux/store';
import { fetchCurrentUser } from './redux/slices/userSlice';
import { fetchNotifications } from './redux/slices/notificationSlice';
import { loadHospitals } from './redux/slices/hospitalSlice';

import PrivateRoute from './components/PrivateRoute';
import PatientTasks from './components/PatientTasks';
import Notifications from './components/Notifications';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';

import SignUp from './pages/SignUp';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import HomePage from './pages/HomePage';
import AddPatientPage from './pages/AddPatientPage';
import EditProfile from './pages/EditProfile';
import Patients from './pages/Patients';
import AlgorithmPatients from './pages/AlgorithmPatientsPage';
import ReportPage from './pages/ReportPage';
import StaffPerformanceReportPage from './pages/StaffPerformanceReportPage';
import DischargedPatients from './pages/DischargedPatients';
import Tasks from './pages/Tasks';
import EditPatientPage from './pages/EditPatientPage';
import LengthOfStayReport from './pages/LengthOfStayReport';
import OpportunityLOSPage from './pages/OpportunityLOSPage';
import ArchivedPatients from './pages/ArchivedPatients';

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { user, authLoaded } = useSelector((state: RootState) => state.user);

  // Always attempt to restore session on mount
  useEffect(() => {
    dispatch(fetchCurrentUser());
  }, [dispatch]);

  // Fetch notifications only when a user is logged in
  useEffect(() => {
    if (user?.id) {
      dispatch(fetchNotifications());
    }
  }, [dispatch, user?.id]);

  useEffect(() => {
    if (authLoaded && user) {
      dispatch(loadHospitals());
    }
  }, [authLoaded, user, dispatch]);

  if (!authLoaded) {
    return <p>Loading...</p>;
  }

  return (
    <>
      <Routes>
        {/* ── Public routes ─────────────────────────────────────────────── */}
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* ── Super admin + admin only ───────────────────────────────────── */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute allowedRoles={['super_admin', 'admin','administration']}>
              <Dashboard />
            </PrivateRoute>
          }
        />

        {/* ── Any logged-in user ─────────────────────────────────────────── */}
        <Route
          path="/homepage"
          element={
            <PrivateRoute>
              <HomePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/patients"
          element={
            <PrivateRoute>
              <Patients />
            </PrivateRoute>
          }
        />
        <Route
          path="/edit-profile"
          element={
            <PrivateRoute>
              <EditProfile />
            </PrivateRoute>
          }
        />
        <Route
          path="/add-patient"
          element={
            <PrivateRoute>
              <AddPatientPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/patients/:patientId/tasks"
          element={
            <PrivateRoute>
              <PatientTasks />
            </PrivateRoute>
          }
        />
        <Route
          path="/patients/:patientId/edit"
          element={
            <PrivateRoute>
              <EditPatientPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <PrivateRoute>
              <Tasks />
            </PrivateRoute>
          }
        />
        <Route
          path="/algorithms/:algorithm"
          element={
            <PrivateRoute>
              <AlgorithmPatients />
            </PrivateRoute>
          }
        />
        <Route
          path="/discharged"
          element={
            <PrivateRoute>
              <DischargedPatients />
            </PrivateRoute>
          }
        />

      
        <Route
          path="/archived"
          element={
            <PrivateRoute>
              <ArchivedPatients />
            </PrivateRoute>
          }
        />

        {/* ── Reports — any logged-in user ───────────────────────────────── */}
        <Route
          path="/reports"
          element={
            <PrivateRoute>
              <ReportPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/los"
          element={
            <PrivateRoute>
              <LengthOfStayReport />
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/opportunitysummary"
          element={
            <PrivateRoute>
              <OpportunityLOSPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/reports/staffPerformance"
          element={
            <PrivateRoute allowedRoles={['super_admin', 'admin']}>
              <StaffPerformanceReportPage />
            </PrivateRoute>
          }
        />
      </Routes>

      <Notifications />
      <ToastContainer position="top-right" autoClose={3000} theme="light" />
    </>
  );
}

export default App;