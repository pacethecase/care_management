import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "../redux/store";
import { addNotification } from "../redux/slices/notificationSlice";
import socket from "../utils/socket";

interface NotificationPayload {
  id:              number;
  user_id:         number;
  patient_id?:     number;
  patient_task_id?: number;
  title:           string;
  message:         string;
  type:            string;
  created_at?:     string;
  read?:           boolean;
  request_status:  "Pending" | "Approved" | "Denied";
}

const Notifications = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((s: RootState) => s.user);

  useEffect(() => {
    if (!user?.id) return;

    socket.emit("join", `user-${user.id}`);

    const handleNotification = (data: NotificationPayload) => {
      if (data.user_id !== user.id) return;
      dispatch(addNotification(data));
    };

    socket.on("notification", handleNotification);

    return () => {
      socket.off("notification", handleNotification);
    };
  }, [user?.id, dispatch]);

  return null;
};

export default Notifications;