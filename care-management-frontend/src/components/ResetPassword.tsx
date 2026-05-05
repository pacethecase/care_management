// src/components/ResetPassword.tsx
import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams, useNavigate } from "react-router-dom";
import { resetPassword, clearError, clearMessage } from "../redux/slices/userSlice";
import { RootState, AppDispatch } from "../redux/store";
import Navbar from "./Navbar";
import Footer from "./Footer";

const ResetPassword = () => {
  const dispatch   = useDispatch<AppDispatch>();
  const navigate   = useNavigate();
  const { loading, error, message } = useSelector((state: RootState) => state.user);

  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [newPassword, setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError]       = useState("");

  // FIX: redirect to login after successful reset so user doesn't stay on this page
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => navigate("/"), 2500);
      return () => clearTimeout(timer);
    }
  }, [message, navigate]);

  // Clear redux state on unmount
  useEffect(() => {
    return () => {
      dispatch(clearError());
      dispatch(clearMessage());
    };
  }, [dispatch]);


  if (!token || !email) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--bg-light)] text-[var(--text-dark)]">
        <Navbar />
        <div className="max-w-md mx-auto mt-20 p-6 bg-white shadow rounded">
          <p className="text-red-500">
            Invalid or missing reset link. Please request a new one.
          </p>
        </div>
        <Footer />
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");

    // FIX: client-side password confirmation check before hitting the API
    if (newPassword !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setLocalError("Password must be at least 8 characters.");
      return;
    }

    dispatch(clearError());
    dispatch(resetPassword({ token, newPassword, email }));
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-light)] text-[var(--text-dark)]">
      <Navbar />
      <div className="max-w-md mx-auto mt-20 p-6 bg-white shadow rounded">
        <h2 className="text-xl font-bold mb-4">Reset Password</h2>

        {message ? (
          // FIX: show success state clearly, redirect happens via useEffect above
          <p className="text-green-600">{message} Redirecting to login...</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              required
              disabled={loading}
              className="w-full border p-2 mb-3 rounded"
            />
            {/* FIX: added confirm password field — was missing before */}
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              disabled={loading}
              className="w-full border p-2 mb-4 rounded"
            />
            <button type="submit" disabled={loading} className="btn w-full">
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        {localError && <p className="text-red-500 mt-2">{localError}</p>}
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
      <Footer />
    </div>
  );
};

export default ResetPassword;