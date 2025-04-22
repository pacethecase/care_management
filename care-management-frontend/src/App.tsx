  import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
  import SignUp from "./pages/SignUp";
  import Login from "./pages/Login";
  import HomePage from "./pages/HomePage";
  import AddPatientPage from './pages/AddPatientPage';
  import EditProfile from "./pages/EditProfile";
  import Patients from "./pages/Patients";
  import AlgorithmPatients from './pages/AlgorithmPatientsPage';
  import ReportPage from './pages/ReportPage';
  import { ToastContainer } from 'react-toastify';
  import 'react-toastify/dist/ReactToastify.css';
  import './index.css'; 
  import { useEffect } from "react";
  import { useDispatch, useSelector } from "react-redux";
  import type { AppDispatch } from './redux/store';
  import { fetchCurrentUser } from "./redux/slices/userSlice";
  import { RootState } from "./redux/store";
  import PrivateRoute from "./components/PrivateRoute";
  import PatientTasks from "./components/PatientTasks";
  import DischargedPatients from './pages/DischargedPatients';
  import Tasks  from './pages/Tasks';
  import ForgotPassword from './components/ForgotPassword';
  import ResetPassword from './components/ResetPassword';
  import Notifications from './components/Notifications';
  import EditPatientPage from './pages/EditPatientPage';
  import { fetchNotifications } from './redux/slices/notificationSlice';
  function App() {
    const dispatch = useDispatch<AppDispatch>();

    const { user, authLoaded, loading } = useSelector((state: RootState) => state.user);

    useEffect(() => {
      dispatch(fetchCurrentUser());
    }, [dispatch]);
    
 
    useEffect(() => {
      if (user?.id) {
        dispatch(fetchNotifications());
      }
    }, [dispatch, user?.id]);
    
   if (!authLoaded || loading) {
    return <p>Loading...</p>; // gracefully handle loading state
  }
    
    return (
      <Router>
        <Routes>
          <Route path="/signup" element={<SignUp />} />
          <Route path="/" element={<Login />} />
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
          path="/reports"
          element={
            <PrivateRoute>
              <ReportPage />
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
          path="/patients/:patientId/edit"
          element={
            <PrivateRoute>
              <EditPatientPage />
              </PrivateRoute>
          }
        />
   

          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />


        </Routes>
        <Notifications />
        <ToastContainer position="top-right" autoClose={3000} theme="light" />
      </Router>
    );
  }

  export default App;
