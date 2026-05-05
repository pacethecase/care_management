// src/components/ForgotPassword.tsx
import { useState, FormEvent } from "react";
import { useDispatch, useSelector } from "react-redux";
import { sendResetLink, clearError, clearMessage } from "../redux/slices/userSlice";
import { RootState, AppDispatch } from "../redux/store";
import Navbar from "./Navbar";
import Footer from "./Footer";

const ForgotPassword = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error, message } = useSelector((state: RootState) => state.user);
  const [email, setEmail] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    // Clear any previous state before dispatching
    dispatch(clearError());
    dispatch(clearMessage());
    dispatch(sendResetLink(trimmed));
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-light)] text-[var(--text-dark)]">
      <Navbar />
      <div className="max-w-md mx-auto mt-20 p-6 bg-white shadow rounded">
        <h2 className="text-xl font-bold mb-4">Forgot Password</h2>

        {!message ? (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading}
              className="w-full border p-2 mb-4 rounded"
            />
            <button type="submit" disabled={loading} className="btn w-full">
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        ) : (
          <p className="text-green-600">{message}</p>
        )}

        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
      <Footer />
    </div>
  );
};

export default ForgotPassword;