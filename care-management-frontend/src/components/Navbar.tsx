import React, { useState } from 'react';
import { FiUser,FiBell } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';  // Import useSelector
import { logoutUser } from '../redux/slices/userSlice';
import logo from '../assets/logo.png';
import NotificationPanel from './NotificationPanel';
const Navbar = () => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { items: notifications } = useSelector((state: RootState) => state.notifications);



  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Access the user state from Redux
  const { user } = useSelector((state) => state.user);

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <header className="shadow-sm">
      {/* Top Logo Strip */}
      <div className="bg-white py-3 px-6 flex items-center justify-between">
        <img
          src={logo}
          alt="Pace The Case Logo"
          loading="lazy"
          className="h-20 w-auto"
        />
      </div>

      {/* Funky Navbar */}
      <nav className="navbar">
        <h1 className="text-lg  text-orange  font-semibold tracking-wide">Case Management</h1>

        <div className="flex space-x-4 items-center">
          <Link to="/homepage" className="tab transition">
            Home
          </Link>
          <Link to="/patients" className="tab transition">
            Patients
          </Link>
          {user?.is_staff === true && (
            <Link to="/tasks" className="tab transition">
            Tasks
          </Link>
          )}
          {/* Conditionally render Reports link for Admin only */}
          {user?.is_admin === true && (
            <Link to="/reports" className="tab transition">
              Reports
            </Link>
          )}
          <div className="relative">
          <button
            onClick={() => setShowNotifications((prev) => !prev)}
            className="relative focus:outline-none"
          >
            <FiBell className="w-5 h-5" />
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1">
                {notifications.filter(n => !n.read).length}
              </span>
            )}

          </button>
        
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg p-3 z-50 max-h-[60vh] overflow-y-auto">
              <NotificationPanel />
            </div>
          )}
        </div>
        

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!isDropdownOpen)}
              className="focus:outline-none"
            >
              <FiUser className="w-5 h-5" />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white rounded shadow-lg z-50">
                <Link
                  to="/edit-profile"
                  className="block px-4 py-2 hover:bg-gray-100 transition"
                >
                  Edit Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="block tab px-4 py-2 hover:bg-gray-100 transition"
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
