// src/hooks/useHospitalTimezone.ts
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
import { DateTime } from "luxon";

export const useHospitalTimezone = () => {
  const { user } = useSelector((s: RootState) => s.user);

  const timezone = user?.timezone || "America/New_York";

  const formatDateTime = (
    dateStr: string | null | undefined,
    format = "MMM d, yyyy, h:mm a"
  ): string => {
    if (!dateStr) return "N/A";
    const dt = DateTime.fromISO(dateStr, { zone: "utc" });
    if (!dt.isValid) return "N/A";
    return dt.setZone(timezone).toFormat(format);
  };

  // DOB and plain dates — no timezone conversion, just parse as-is
  const formatDateOnly = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "N/A";
    const dt = DateTime.fromISO(dateStr);
    if (!dt.isValid) return "N/A";
    return dt.toFormat("MMM d, yyyy");
  };

  const formatDueDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "N/A";
    const dt = DateTime.fromISO(dateStr, { zone: "utc" });
    if (!dt.isValid) return "N/A";
    return dt.setZone(timezone).toFormat("MMM d, yyyy, h:mm a");
  };

  const isOverdue = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false;
    const due = DateTime.fromISO(dateStr, { zone: "utc" });
    if (!due.isValid) return false;
    return DateTime.utc() > due;
  };

  const isDueToday = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false;
    const due   = DateTime.fromISO(dateStr, { zone: "utc" }).setZone(timezone);
    const today = DateTime.now().setZone(timezone);
    return due.toISODate() === today.toISODate();
  };

  const isDueSoon = (dateStr: string | null | undefined, withinHours = 24): boolean => {
    if (!dateStr) return false;
    const due = DateTime.fromISO(dateStr, { zone: "utc" });
    if (!due.isValid) return false;
    const now = DateTime.utc();
    return due > now && due <= now.plus({ hours: withinHours });
  };

  const formatShort = (dateStr: string | null | undefined): string =>
    formatDateTime(dateStr, "M/d/yy, h:mm a");

  const formatTimeOnly = (dateStr: string | null | undefined): string =>
    formatDateTime(dateStr, "h:mm a");

  const todayLocal = (): string =>
    DateTime.now().setZone(timezone).toISODate() ?? "";

  return {
    timezone,
    formatDateTime,
    formatDateOnly,
    formatDueDate,
    formatShort,
    formatTimeOnly,
    isOverdue,
    isDueToday,
    isDueSoon,
    todayLocal,
  };
};