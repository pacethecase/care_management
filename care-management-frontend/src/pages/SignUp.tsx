import React, { useState } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { User, Lock, Mail, UserCog, Stethoscope } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { signupUser, clearUser } from "../redux/slices/userSlice";
import { RootState } from "../redux/store";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const SignUp = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state: RootState) => state.user);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    isStaff: false,
    isAdmin: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dispatch(signupUser(formData)).unwrap();
      dispatch(clearUser());
      toast.success("Signup successful! Check your email.");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err: any) {
      const message =
        typeof err === "string"
          ? err
          : err?.error || err?.message || "Signup failed";
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-light)] text-[var(--text-dark)]">
      <Navbar />
      <main className="flex items-center justify-center p-6 flex-1">
        <div className="card w-full max-w-lg">
          <h2 className="text-2xl font-bold mb-6 text-center">Create an Account</h2>

          <form onSubmit={handleSignup} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block mb-1 font-medium">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  className="!pl-10"
                  type="text"
                  name="name"
                  placeholder="Enter your name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block mb-1 font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  className="!pl-10"
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block mb-1 font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  className="!pl-10"
                  type="password"
                  name="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Role Selector */}
            <div>
              <label className="block mb-1 font-medium">Select Role</label>
              <div className="flex gap-4 mb-1">
                <button
                  type="button"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition ${
                    formData.isStaff
                      ? "border-[var(--funky-orange)] bg-[var(--hover-tab)] text-[var(--funky-orange)] font-semibold"
                      : "border-gray-300 bg-white text-gray-600"
                  }`}
                  onClick={() =>
                    setFormData({ ...formData, isStaff: true, isAdmin: false })
                  }
                >
                  <Stethoscope className="w-4 h-4" />
                  Staff
                </button>

                <button
                  type="button"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition ${
                    formData.isAdmin
                      ? "border-[var(--funky-orange)] bg-[var(--hover-tab)] text-[var(--funky-orange)] font-semibold"
                      : "border-gray-300 bg-white text-gray-600"
                  }`}
                  onClick={() =>
                    setFormData({ ...formData, isAdmin: true, isStaff: false })
                  }
                >
                  <UserCog className="w-4 h-4" />
                  Admin
                </button>
              </div>

              <p className="text-sm text-gray-500">
                {formData.isStaff
                  ? "Staffs can manage patient aftercare plans"
                  : "Admins can manage staff and system settings"}
              </p>
            </div>

            {/* Error */}
            {error && <p className="text-red-500 text-sm">{error}</p>}

            {/* Submit */}
            <button type="submit" className="btn w-full" disabled={loading}>
              {loading ? "Creating Account..." : "Sign Up"}
            </button>
          </form>

          {/* Switch to Login */}
          <p className="text-center text-sm mt-6">
            Already have an account?{" "}
            <a href="/login" className="text-orange font-medium hover:underline">
              Sign In
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SignUp;
