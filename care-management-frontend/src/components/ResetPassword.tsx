import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { resetPassword } from "../redux/slices/userSlice";
import { RootState } from "../redux/store";
import Navbar from "./Navbar";
import Footer from "./Footer";

const ResetPassword = () => {
  const dispatch = useDispatch();
  const { loading, error, message } = useSelector((state: RootState) => state.user);

  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [newPassword, setNewPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token && email) {
      dispatch(resetPassword({ token, newPassword, email }) as any);
    }
  };

  return (
     <div className="flex flex-col min-h-screen bg-[var(--bg-light)] text-[var(--text-dark)]">
          <Navbar />
    <div className="max-w-md mx-auto mt-20 p-6 bg-white shadow rounded">
      <h2 className="text-xl font-bold mb-4">Reset Password</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New Password"
          required
          className="w-full border p-2 mb-4 rounded"
        />
        <button type="submit" className="btn w-full">
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
      {error && <p className="text-red-500 mt-2">{error}</p>}
      {message && <p className="text-green-600 mt-2">{message}</p>}
    </div>
    <Footer />
    </div>
  );
};

export default ResetPassword;
