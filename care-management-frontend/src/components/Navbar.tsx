import React, { useState } from 'react';
import { FiUser, FiBell } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutAndClearAll } from '../redux/actions/logoutAndClearAll';
import NotificationPanel from './NotificationPanel';
import type { AppDispatch } from '../redux/store';
import { RootState } from "../redux/store";
import type { Notification } from "../redux/types";

const Navbar: React.FC = () => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { user } = useSelector((state: RootState) => state.user);
  const { items: notifications } = useSelector((state: RootState) => state.notifications);

  const handleLogout = async () => {
    try {
      await dispatch(logoutAndClearAll("manual"));
      navigate('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const unreadCount = notifications.filter((n: Notification) => !n.read).length;

  // Title text
  const navbarTitle = user?.has_global_access
    ? "Case Management: System Dashboard"
    : user?.is_super_admin
    ? "Case Management: Org Portal"
    : user?.is_admin
    ? "Case Management: Admin Portal"
    : user?.is_staff
    ? "Case Management: Staff Portal"
    : "Case Management";



  const showTabs = true;
  const canSeeDashboard = user?.has_global_access || user?.is_admin || user?.is_super_admin; 
  const canSeeHome = !user?.has_global_access;
  const canSeePatients = !user?.has_global_access;
  const canSeeReports = !user?.has_global_access;

  const canSeeTasks = user?.is_staff === true; 


  return (
    <header className="shadow-sm">
      <div className="bg-white py-3 px-6 flex items-center justify-between">
        <img src="/logo.png" alt="Pace The Case Logo" loading="lazy" className="h-30 w-auto" />
      </div>

      <nav className="navbar">
        <h1 className="text-lg font-semibold tracking-wide">{navbarTitle}</h1>

        <div className="flex space-x-4 items-center">
          {showTabs && (
            <div className="hidden sm:flex space-x-4">
  
            

              {/* GLOBAL ADMIN sees ONLY dashboard */}
              {canSeeHome && <Link to="/homepage" className="tab transition">Home</Link>}
              {canSeePatients && <Link to="/patients" className="tab transition">Patients</Link>}
              {canSeeReports && <Link to="/reports" className="tab transition">Reports</Link>}

              {/* STAFF ONLY */}
              {canSeeTasks && <Link to="/tasks" className="tab transition">Tasks</Link>}
              {canSeeDashboard && <Link to="/dashboard" className="tab transition">Dashboard</Link>}
            </div>
          )}

          {/* NOTIFICATIONS (not for global admin) */}
          {user && !user?.has_global_access && (
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

          {/* USER DROPDOWN */}
          <div className="relative">
            <button onClick={() => setDropdownOpen(!isDropdownOpen)} className="focus:outline-none">
              <FiUser className="w-5 h-5" />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white text-black rounded p-3 shadow-lg z-50">

                {/* MOBILE MENU FOR NON-GLOBAL USERS */}
                {!user?.has_global_access && (
                  <div className="block sm:hidden">

                    <Link to="/dashboard" className="block px-4 py-2">Dashboard</Link>
                    <Link to="/homepage" className="block px-4 py-2">Home</Link>
                    <Link to="/patients" className="block px-4 py-2">Patients</Link>
                    <Link to="/reports" className="block px-4 py-2">Reports</Link>
                    {user?.is_staff && <Link to="/tasks" className="block px-4 py-2">Tasks</Link>}

                    <hr className="my-1" />
                  </div>
                )}

                <Link to="/edit-profile" className="block px-4 bg-[var(--prussian-blue)]  py-2 hover:bg-gray-100">Edit Profile</Link>
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
