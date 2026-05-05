// src/components/NotificationPanel.tsx
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "../redux/store";
import {
  fetchNotifications, markAllRead,
  clearAllNotificationsThunk, deleteNotificationThunk,
} from "../redux/slices/notificationSlice";
import { decideOverride, loadPatientTasks } from "../redux/slices/taskSlice";
import type { Notification } from "../redux/types";
import { DateTime } from "luxon";
import { toast } from "react-toastify";
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
          const patientTaskId = Number((n as any).patient_task_id ?? (n as any).task_id);

          return (
            <div
              key={n.id}
              className={`relative mb-3 p-3 border rounded-md ${n.read ? "bg-gray-100" : "bg-yellow-50"}`}
            >
              {/* Dismiss */}
              <div
                className="absolute top-2 right-2 text-gray-400 hover:text-red-600 cursor-pointer text-lg leading-none"
                title="Dismiss"
                onClick={() => dispatch(deleteNotificationThunk(Number(n.id)))}
              >
                ×
              </div>

              {/* Title */}
              <div className={`font-medium text-sm pr-4 ${
                (n.type || "").startsWith("override") ? "text-red-700" : "text-gray-600"
              }`}>
                {n.title}
              </div>

              {/* Timestamp */}
              <div className="text-xs text-gray-500">
                {n.created_at
                  ? DateTime.fromISO(n.created_at, { zone: "utc" })
                      .toLocal()
                      .toFormat("MMM d, yyyy, h:mm a")
                  : "N/A"}
              </div>

              {/* Message */}
              <div className="text-sm text-gray-700 mt-1">
                {(n.message || "").split("\n").map((line, idx) => (
                  <span key={idx}>{line}<br /></span>
                ))}
              </div>

              {/* Override approve/deny buttons — only for pending override requests */}
              {n.type === "override_request" && patientTaskId && n.request_status === "Pending" && (
                <div className="flex gap-2 mt-2">
                  <button
                    className="btn btn-xs bg-green-600 text-white hover:bg-green-700"
                    onClick={async () => {
                      try {
                        await dispatch(decideOverride({ patientTaskId, decision: "Approved" })).unwrap();
                        toast.success("Override approved");
                      } catch (e: any) {
                        toast.error(e?.error || e?.message || "Failed to approve");
                      } finally {
                        dispatch(fetchNotifications());
                        if ((n as any).patient_id) {
                          dispatch(loadPatientTasks(Number((n as any).patient_id)));
                        }
                      }
                    }}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-xs bg-red-600 text-white hover:bg-red-700"
                    onClick={async () => {
                      try {
                        await dispatch(decideOverride({ patientTaskId, decision: "Denied" })).unwrap();
                        toast.info("Override denied");
                      } catch (e: any) {
                        toast.error(e?.error || e?.message || "Failed to deny");
                      } finally {
                        dispatch(fetchNotifications());
                        if ((n as any).patient_id) {
                          dispatch(loadPatientTasks(Number((n as any).patient_id)));
                        }
                      }
                    }}
                  >
                    Deny
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default NotificationPanel;