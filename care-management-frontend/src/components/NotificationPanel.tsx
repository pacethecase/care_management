import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../redux/store';
import { clearNotifications, fetchNotifications, markAllRead } from '../redux/slices/notificationSlice';

const NotificationPanel = () => {
  const dispatch = useDispatch();
  const { items: notifications, loading } = useSelector((state: RootState) => state.notifications);

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  return (
    <div className="w-80 bg-white rounded-lg shadow-lg p-3 z-50 max-h-[60vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <button
          className="text-xs text-blue-600 hover:underline"
          onClick={() => dispatch(markAllRead())}
        >
          Mark All Read
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : notifications.length === 0 ? (
        <p className="text-gray-500 text-sm">No notifications</p>
      ) : (
        notifications.map((n) => (
          <div
            key={n.id}
            className={`mb-3 p-3 border rounded-md ${
              n.read ? "bg-gray-100" : "bg-yellow-50"
            }`}
          >
            <div className="font-medium text-sm">{n.title}</div>
            <div className="text-xs text-gray-500">
              {n.created_at
                ? new Date(n.created_at).toLocaleString()
                : n.timestamp}
            </div>
            <div className="text-sm text-gray-700 mt-1">{n.message}</div>
          </div>
        ))
      )}
    </div>
  );
};

export default NotificationPanel;
