import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../redux/store';
import {
  fetchNotifications,
  markAllRead,
  clearAllNotificationsThunk,
  deleteNotificationThunk
} from '../redux/slices/notificationSlice';
import type { AppDispatch } from '../redux/store';
import type { Notification } from '../redux/types';

const NotificationPanel = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { items: notifications, loading } = useSelector((state: RootState) => state.notifications);

  return (
    <div className="w-80 bg-white rounded-lg shadow-lg p-3 z-50 max-h-[60vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <div className="flex gap-2">
          <button
            className="text-xs text-blue-600 hover:underline"
            onClick={async () => {
              await dispatch(markAllRead());
            }}
          >
            Mark All Read
          </button>
          <button
            className="text-xs text-red-600 hover:underline"
            onClick={async () => {
              await dispatch(clearAllNotificationsThunk());
              dispatch(fetchNotifications());
            }}
          >
            Clear All
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : notifications.length === 0 ? (
        <p className="text-gray-500 text-sm">No notifications</p>
      ) : (
        notifications.map((n: Notification) => (
          <div
            key={n.id}
            className={`relative mb-3 p-3 border rounded-md ${
              n.read ? 'bg-gray-100' : 'bg-yellow-50'
            }`}
          >
            {/* ❌ Dismiss Button */}
            <div
              className="absolute top-2 right-2 text-gray-400 hover:text-red-600 cursor-pointer"
              title="Dismiss"
              onClick={() => dispatch(deleteNotificationThunk(Number(n.id)))}
            >
              x
            </div>

            <div className="font-medium text-gray-500 text-sm">{n.title}</div>
            <div className="text-xs text-gray-500">
              {n.created_at ? new Date(n.created_at).toLocaleString() : n.timestamp}
            </div>
            <div className="text-sm text-gray-700 mt-1">{n.message}</div>
          </div>
        ))
      )}
    </div>
  );
};

export default NotificationPanel;
