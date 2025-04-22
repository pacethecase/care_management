import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import socket from '../utils/socket';
import { RootState } from '../redux/store';
import { addNotification } from '../redux/slices/notificationSlice';

const Notifications = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.user);

  useEffect(() => {
    if (!user || !user.id) return; // ✅ ensure user exists
    socket.emit('join', `user-${user.id}`);

    socket.on('notification', (data) => {
      console.log("📩 Received notification:", data);
      dispatch(addNotification({
        id: Date.now().toString(),
        title: data.title,
        message: data.message,
        created_at: new Date().toISOString(),
        read: false,
      }));
    });

    return () => {
      socket.off('notification');
    };
  }, [user?.id]);

  return null;
};

export default Notifications;
