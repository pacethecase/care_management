import React, { useState, useEffect } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { User, Lock, Mail, UserCog, Stethoscope, Building2 } from "lucide-react";

import { useDispatch, useSelector } from "react-redux";
import { signupUser, clearUser } from "../redux/slices/userSlice";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import type { AppDispatch } from "../redux/store";

import { fetchPublicHospitals, fetchPublicOrganizations } from "../redux/slices/publicSlice";

import type { Hospital, Organization } from "../redux/types";
import { RootState } from "../redux/store";

const SignUp = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { loading, error } = useSelector((state: RootState) => state.user);
  const publicState = useSelector((state: RootState) => state.public);
  const hospitals = publicState.hospitals;
  const organizations = publicState.organizations;

  useEffect(() => {
    dispatch(fetchPublicOrganizations());
    dispatch(fetchPublicHospitals());
  }, [dispatch]);


  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    organization_id: "",
    hospital_id: "",
    role: "", 
  });

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleOrgChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const orgId = e.target.value;

    setFormData((prev) => ({
      ...prev,
      organization_id: orgId,
      hospital_id: "",
    }));

    if (!orgId) {
      dispatch(fetchPublicHospitals()); 
    } else {
      dispatch(fetchPublicHospitals(orgId)); 
    }
  };

  // Role selection buttons
  const selectRole = (role: string) => {
    setFormData((prev) => ({
      ...prev,
      role,
      hospital_id: role === "super_admin" ? "" : prev.hospital_id,
    }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((formData.role === "staff" || formData.role === "admin") && !formData.hospital_id) {
      return toast.error("Please select a hospital.");
    }
  const payload = {
    name: formData.name,
    email: formData.email,
    password: formData.password,

    // MUST MATCH BACKEND FIELD NAMES
    isStaff: formData.role === "staff",
    isAdmin: formData.role === "admin",
    is_super_admin: formData.role === "super_admin",  

    organization_id: formData.organization_id || null,
    hospital_id:
      formData.role === "super_admin" ? null : formData.hospital_id,
  };

    try {
      await dispatch(signupUser(payload)).unwrap();
      dispatch(clearUser());
      toast.success("Signup successful! Check your email.");
      setTimeout(() => navigate("/"), 1500);
    } catch (err: any) {
      toast.error(err?.error || "Signup failed");
    }
  };

  return (
    <div className="flex flex-col min-h-screen text-white">
      <Navbar />

      <main className="flex items-center justify-center p-6 flex-1">
        <div className="card w-full max-w-lg">
          <h2 className="text-2xl font-bold mb-6 text-center">Create an Account</h2>

          <form onSubmit={handleSignup} className="space-y-5">

            {/* NAME */}
            <div>
              <label className="block mb-1 font-medium">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-black w-5 h-5" />
                <input
                  type="text"
                  name="name"
                  placeholder="Enter your name"
                  value={formData.name}
                  onChange={handleInput}
                  required
                  className="!pl-10 bg-white text-black border rounded py-2 px-3"
                />
              </div>
            </div>

            {/* EMAIL */}
            <div>
              <label className="block mb-1 font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-black w-5 h-5" />
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleInput}
                  required
                  className="!pl-10 bg-white text-black border rounded py-2 px-3"
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label className="block mb-1 font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-black w-5 h-5" />
                <input
                  type="password"
                  name="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleInput}
                  required
                  className="!pl-10 bg-white text-black border rounded py-2 px-3"
                />
              </div>
            </div>

            {/* ROLE BUTTONS */}
            <div>
              <label className="block mb-1 font-medium">Select Role</label>

              <div className="flex gap-3 flex-wrap mb-1">

                <button
                  type="button"
                  onClick={() => selectRole("staff")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${
                    formData.role === "staff"
                      ? "border-blue-600 bg-white text-black font-semibold"
                      : "border-gray-300 bg-white text-gray-600"
                  }`}
                >
                  <Stethoscope className="w-4 h-4" /> Staff
                </button>

                <button
                  type="button"
                  onClick={() => selectRole("admin")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${
                    formData.role === "admin"
                      ? "border-blue-600 bg-white text-black font-semibold"
                      : "border-gray-300 bg-white text-gray-600"
                  }`}
                >
                  <UserCog className="w-4 h-4" /> Hospital Admin
                </button>

                <button
                  type="button"
                  onClick={() => selectRole("super_admin")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${
                    formData.role === "super_admin"
                      ? "border-purple-600 bg-white text-black font-semibold"
                      : "border-gray-300 bg-white text-gray-600"
                  }`}
                >
                  <Building2 className="w-4 h-4" /> Organization Super Admin
                </button>
              </div>
            </div>

            {/* ORGANIZATION DROPDOWN (always visible) */}
            <div>
              <label className="block mb-1 font-medium">Select Organization</label>
              <select
                name="organization_id"
                value={formData.organization_id}
                onChange={handleOrgChange}
                className="bg-white text-black border rounded py-2 px-3 w-full"
              >
                <option value="">-- All Organizations --</option>
                {organizations.map((org: Organization) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            {/* HOSPITAL DROPDOWN (only for staff/admin) */}
            {formData.role !== "super_admin" && (
              <div>
                <label className="block mb-1 font-medium">Select Hospital</label>
                <select
                  name="hospital_id"
                  value={formData.hospital_id}
                  onChange={handleInput}
                  required
                  className="bg-white text-black border rounded py-2 px-3 w-full"
                >
                  <option value="">-- Select Hospital --</option>
                  {hospitals.map((h: Hospital) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button type="submit" className="btn w-full" disabled={loading}>
              {loading ? "Creating Account..." : "Sign Up"}
            </button>
          </form>

          <p className="text-center text-sm mt-6">
            Already have an account?{" "}
            <a href="/" className="font-medium hover:underline">
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
