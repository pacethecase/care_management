import { useState, FormEvent } from "react";
import { useDispatch, useSelector } from "react-redux";
import { sendResetLink } from "../redux/slices/userSlice";
import { RootState, AppDispatch } from "../redux/store";
import Navbar from "./Navbar";
import Footer from "./Footer";

const ForgotPassword = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error, message } = useSelector((state: RootState) => state.user);

  const [email, setEmail] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      dispatch(sendResetLink(email.toLowerCase()));
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-light)] text-[var(--text-dark)]">
      <Navbar />

      <div className="max-w-md mx-auto mt-20 p-6 bg-white shadow rounded">
        <h2 className="text-xl font-bold mb-4">Forgot Password</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            className="w-full border p-2 mb-4 rounded"
          />
          <button type="submit" className="btn w-full">
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
        {error && <p className="text-red-500 mt-2">{error}</p>}
        {message && <p className="text-green-600 mt-2">{message}</p>}
      </div>

      <Footer />
    </div>
  );
};

export default ForgotPassword;
