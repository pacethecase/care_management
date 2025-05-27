// src/components/Notifications.tsx
import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../redux/store';
import { addNotification } from '../redux/slices/notificationSlice';
import socket from '../utils/socket'; 
import type { AppDispatch } from '../redux/store';

interface NotificationPayload {
  title: string;
  message: string;
}

const Notifications = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.user);

  useEffect(() => {
    if (!user?.id) return;

    socket.emit('join', `user-${user.id}`);

    const handleNotification = (data: NotificationPayload) => {
      dispatch(addNotification({
        id: Date.now(),
        title: data.title,
        message: data.message,
        created_at: new Date().toISOString(),
        read: false,
      }));
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [user?.id, dispatch]);

  return null;
};

export default Notifications;
