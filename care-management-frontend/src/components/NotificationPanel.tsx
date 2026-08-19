// src/components/NotificationPanel.tsx
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "../redux/store";
import {
  fetchNotifications, markAllRead,
  clearAllNotificationsThunk, deleteNotificationThunk,
} from "../redux/slices/notificationSlice";
import type { Notification } from "../redux/types";
import { DateTime } from "luxon";
import BlueLoader from "./BlueLoader";

const NotificationPanel = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { items: notifications, loading } = useSelector((s: RootState) => s.notifications);

  return (
    <div className="w-80 bg-white rounded-lg shadow-lg p-3 z-50 max-h-[60vh] overflow-y-auto">

      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg text-black font-semibold">Notifications</h2>
        <div className="flex gap-2">
          <button
            className="text-xs text-blue-600 hover:underline"
            onClick={() => dispatch(markAllRead())}
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
        <BlueLoader />
      ) : notifications.length === 0 ? (
        <p className="text-gray-500 text-sm">No notifications</p>
      ) : (
        notifications.map((n: Notification) => {
          const isRequestNotif = n.type === "override_request" || n.type === "approval_request";
          const isOverrideType = (n.type || "").startsWith("override");

          const titleColor = isOverrideType
            ? "text-red-700"
            : (n.type || "").startsWith("approval")
            ? "text-purple-700"
            : "text-gray-600";

      
          return (
            <div
              key={n.id}
              className={`relative mb-3 p-3 border rounded-md ${n.read ? "bg-gray-100" : "bg-yellow-50"}`}
            >
              <div
                className="absolute top-2 right-2 text-gray-400 hover:text-red-600 cursor-pointer text-lg leading-none"
                title="Dismiss"
                onClick={() => dispatch(deleteNotificationThunk(Number(n.id)))}
              >
                ×
              </div>

              <div className={`font-medium text-sm pr-4 ${titleColor}`}>
                {n.title}
              </div>

              <div className="text-xs text-gray-500">
                {n.created_at
                  ? DateTime.fromISO(n.created_at, { zone: "utc" }).toLocal().toFormat("MMM d, yyyy, h:mm a")
                  : "N/A"}
              </div>

              <div className="text-sm text-gray-700 mt-1">
                {(n.message || "").split("\n").map((line, idx) => (
                  <span key={idx}>{line}<br /></span>
                ))}
              </div>
              <div className="mt-2">
                
              </div>

              {isRequestNotif && (
                <a href="/approvals" className={`!text-gray-500 text-sm`}>
                  Review on Requests page →
                </a>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default NotificationPanel;