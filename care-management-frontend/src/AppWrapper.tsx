import { useIdleTimer } from 'react-idle-timer';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logoutAndClearAll } from './redux/actions/logoutAndClearAll';
import App from './App';
import { toast } from 'react-toastify';
import type { AppDispatch } from './redux/store'; // ✅ Import your dispatch type

const AppWrapper = () => {
  const dispatch = useDispatch<AppDispatch>(); // ✅ Type dispatch properly
  const navigate = useNavigate();



  const handleIdle = () => {
    toast.info("Logged out due to inactivity.");
    dispatch(logoutAndClearAll("idle"));
    navigate('/');
  };

  useIdleTimer({
    timeout: 20 * 60 * 1000, // 20 minutes
    onIdle: handleIdle,
    debounce: 500,
  });

  return <App />;
};

export default AppWrapper;
