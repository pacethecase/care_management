  import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
  import SignUp from "./pages/SignUp";
  import Login from "./pages/Login";
  import HomePage from "./pages/HomePage";
  import AddPatientPage from './pages/AddPatientPage';
  import EditProfile from "./pages/EditProfile";
  import Patients from "./pages/Patients";
  import { ToastContainer } from 'react-toastify';
  import 'react-toastify/dist/ReactToastify.css';
  import './index.css'; 
  import { useEffect } from "react";
  import { useDispatch, useSelector } from "react-redux";
  import { fetchCurrentUser } from "./redux/slices/userSlice";
  import { RootState } from "./redux/store";
  import PrivateRoute from "./components/PrivateRoute";
  import PatientTasks from "./components/PatientTasks";
  import Tasks  from './pages/Tasks';

  function App() {
    const dispatch = useDispatch(); 

    const { user, authLoaded, loading } = useSelector((state: RootState) => state.user);

    useEffect(() => {
      dispatch(fetchCurrentUser());
    }, [dispatch]);
    
   if (!authLoaded || loading) {
    return <p>Loading...</p>; // gracefully handle loading state
  }
    
    return (
      <Router>
        <Routes>
          <Route path="/signup" element={<SignUp />} />
          <Route path="/login" element={<Login />} />
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
        
        
        
        </Routes>
        <ToastContainer position="top-right" autoClose={3000} theme="light" />
      </Router>
    );
  }

  export default App;
