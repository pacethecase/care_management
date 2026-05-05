import { useIdleTimer } from 'react-idle-timer';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logoutAndClearAll } from './redux/actions/logoutAndClearAll';
import App from './App';
import { toast } from 'react-toastify';
import type { AppDispatch } from './redux/store';

const AppWrapper = () => {
  const dispatch = useDispatch<AppDispatch>(); 
  const navigate = useNavigate();



  const handleIdle = () => {
    toast.info("Logged out due to inactivity.");
    dispatch(logoutAndClearAll("idle"));
    navigate('/');
  };

  useIdleTimer({
    timeout: 20 * 60 * 1000,
    onIdle: handleIdle,
    debounce: 500,
  });

  return <App />;
};

export default AppWrapper;
