import React, { useState } from 'react';
import { FiUser, FiBell } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../redux/slices/userSlice';
import logo from '../assets/logo.png';
import NotificationPanel from './NotificationPanel';
import type { AppDispatch } from '../redux/store';
import { RootState } from "../redux/store";
import type { Notification } from "../redux/types"; // ✅ assuming types centralized

const Navbar: React.FC = () => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { user } = useSelector((state: RootState) => state.user);
  const { items: notifications } = useSelector((state: RootState) => state.notifications);
console.log(user);
  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
      navigate('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const unreadCount = notifications.filter((n: Notification) => !n.read).length;

  return (
    <header className="shadow-sm">
      {/* Top Logo Strip */}
      <div className="bg-white py-3 px-6 flex items-center justify-between">
        <img src={logo} alt="Pace The Case Logo" loading="lazy" className="h-20 w-auto" />
      </div>

      {/* Navbar */}
      <nav className="navbar">
        
      <h1 className="text-lg text-orange font-semibold tracking-wide">
        {user?.is_admin
          ? "Case Management: Leadership Portal"
          : user?.is_staff
          ? "Case Management: Staff Portal"
          : "Case Management"}
      </h1>

        <div className="flex space-x-4 items-center">
          <div className="hidden sm:flex space-x-4">
              <Link to="/homepage" className="tab transition">Home</Link>
              <Link to="/patients" className="tab transition">Patients</Link>
              {user?.is_staff && <Link to="/tasks" className="tab transition">Tasks</Link>}
              {user?.is_admin && <Link to="/reports" className="tab transition">Reports</Link>}
          </div>
          {/* Notifications */}
          {user && (
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


          {/* Profile */}
          <div className="relative">
            <button onClick={() => setDropdownOpen(!isDropdownOpen)} className="focus:outline-none">
              <FiUser className="w-5 h-5" />
            </button>

            {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white text-black rounded shadow-lg z-50">
              {/* Mobile Nav Links */}
              <div className="block sm:hidden">
                <Link to="/homepage" className="block px-4 py-2 hover:bg-gray-100">Home</Link>
                <Link to="/patients" className="block px-4 py-2 hover:bg-gray-100">Patients</Link>
                {user?.is_staff && <Link to="/tasks" className="block px-4 py-2 hover:bg-gray-100">Tasks</Link>}
                {user?.is_admin && <Link to="/reports" className="block px-4 py-2 hover:bg-gray-100">Reports</Link>}
                <hr className="my-1" />
              </div>

              {/* Always shown */}
              <Link to="/edit-profile" className="block px-4 py-2 hover:bg-gray-100">Edit Profile</Link>
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-500"
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
