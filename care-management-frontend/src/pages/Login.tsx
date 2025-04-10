import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loginUser } from "../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { RootState } from "../redux/store";
import { Mail, Lock } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Accessing user state, loading, and error from Redux store
  const { user, loading, error } = useSelector((state: RootState) => state.user);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  useEffect(() => {
    if (user) {
      navigate("/homepage");
    }
  }, [user, navigate]);
  

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await dispatch(loginUser(formData)).unwrap();
      console.log("Login response:", response);
      toast.success("Logged in successfully!");
      navigate("/homepage");
    } catch (err: any) {
      const message =
      typeof err === "string"
        ? err
        : err?.error || err?.message || "Login failed";
    toast.error(message); 
    }
  };
  

  return (
    <div className="flex flex-col min-h-screen bg-hospital-neutral text-gray-700">
     <Navbar />
      <main className="flex items-center p-6">
        <div className="card w-full max-w-d">
          <h2 className="text-2xl font-bold mb-4">Sign In</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block mb-1 font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
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

            <div>
              <label className="block mb-1 font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
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

            {/* Show error message if exists */}
            {error && <p className="text-red-500 text-sm">{error}</p>}

            {/* Button showing loading state */}
            <button type="submit" className="btn w-full mt-4" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Link to Sign Up page */}
          <p className="text-center text-sm mt-4">
            Don’t have an account?{" "}
            <a href="/signup" className="text-hospital-blue font-medium hover:underline">
              Sign Up
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Login;
