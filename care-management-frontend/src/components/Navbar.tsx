// src/components/Navbar.tsx
import React, { useState } from "react";
import { FiUser, FiBell } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logoutAndClearAll } from "../redux/actions/logoutAndClearAll";
import NotificationPanel from "./NotificationPanel";
import type { AppDispatch } from "../redux/store";
import { RootState } from "../redux/store";
import type { Notification } from "../redux/types";

const Navbar: React.FC = () => {
  const [isDropdownOpen, setDropdownOpen]       = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { user }                  = useSelector((s: RootState) => s.user);
  const { items: notifications }  = useSelector((s: RootState) => s.notifications);

  const handleLogout = async () => {
    try {
      await dispatch(logoutAndClearAll("manual"));
      navigate("/");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const unreadCount = notifications.filter((n: Notification) => !n.read).length;

  // FIX: all role checks use role string instead of boolean flags
  const role = user?.role;

  const navbarTitle =
    role === "administration" && user?.has_global_access ? "Case Management: System Dashboard"
    : role === "super_admin"                          ? "Case Management: Org Portal"
    : role === "admin"                                ? "Case Management: Leadership Portal"
    : role === "staff"                                ? "Case Management: Staff Portal"
    : "Case Management";

  // FIX: super_admin (both global and org-level) and admin see dashboard
  const canSeeDashboard = role === "super_admin" || role === "admin" || (role === "administration" && user?.has_global_access);

  // FIX: super_admin with global access doesn't see patient-facing tabs
  // but org-level super_admin (no global access) can see them
  const isGlobalAdmin   = role === "administration" && user?.has_global_access;
  const canSeeHome      = !isGlobalAdmin;
  const canSeePatients  = !isGlobalAdmin;
  const canSeeReports   = !isGlobalAdmin;

  // Only staff see the Tasks tab
  const canSeeTasks     = role === "staff";

  // Don't show notifications to global super admins — they don't deal with patient tasks
  const canSeeNotifications = !!user && !isGlobalAdmin;

  return (
    <header className="shadow-sm">
      <div className="bg-white py-3 px-6 flex items-center justify-between">
        <img src="/logo.png" alt="Pace The Case Logo" loading="lazy" className="h-30 w-auto" />
      </div>

      <nav className="navbar">
        <h1 className="text-lg font-semibold tracking-wide">{navbarTitle}</h1>

        <div className="flex space-x-4 items-center">

          {/* Desktop nav */}
          <div className="hidden sm:flex space-x-4">
            {canSeeHome      && <Link to="/homepage"  className="tab transition">Home</Link>}
            {canSeePatients  && <Link to="/patients"  className="tab transition">Patients</Link>}
            {canSeeReports   && <Link to="/reports"   className="tab transition">Reports</Link>}
            {canSeeTasks     && <Link to="/tasks"     className="tab transition">Tasks</Link>}
            {canSeeDashboard && <Link to="/dashboard" className="tab transition">Dashboard</Link>}
          </div>

          {/* Notifications */}
          {canSeeNotifications && (
            <div className="relative">
              <button
                onClick={() => setShowNotifications((prev) => !prev)}
                className="relative focus:outline-none"
              >
                <FiBell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg p-3 z-50 max-h-[60vh] overflow-y-auto">
                  <NotificationPanel />
                </div>
              )}
            </div>
          )}

          {/* User dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="focus:outline-none"
            >
              <FiUser className="w-5 h-5" />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white text-black rounded p-3 shadow-lg z-50">

                {/* Mobile nav — mirrors desktop */}
                <div className="block sm:hidden">
                  {canSeeHome      && <Link to="/homepage"  className="block px-4 py-2 hover:bg-gray-100">Home</Link>}
                  {canSeePatients  && <Link to="/patients"  className="block px-4 py-2 hover:bg-gray-100">Patients</Link>}
                  {canSeeReports   && <Link to="/reports"   className="block px-4 py-2 hover:bg-gray-100">Reports</Link>}
                  {canSeeTasks     && <Link to="/tasks"     className="block px-4 py-2 hover:bg-gray-100">Tasks</Link>}
                  {canSeeDashboard && <Link to="/dashboard" className="block px-4 py-2 hover:bg-gray-100">Dashboard</Link>}
                  <hr className="my-1" />
                </div>

                <Link to="/edit-profile" className="block px-4  bg-[var(--prussian-blue)] py-2 hover:bg-gray-100">
                  Edit Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Logout
                </button>
              </div>
            )}
          </div>

        </div>
      </nav>
    </header>
  );
};

export default Navbar;