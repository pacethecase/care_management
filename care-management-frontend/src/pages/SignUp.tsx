// src/pages/SignUp.tsx
import React, { useState, useEffect } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { User, Lock, Mail, UserCog, Stethoscope, Building2 } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { signupUser } from "../redux/slices/userSlice";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import type { AppDispatch } from "../redux/store";
import { fetchPublicHospitals, fetchPublicOrganizations } from "../redux/slices/publicSlice";
import type { UserRole, PublicHospital, PublicOrganization } from "../redux/types";
import { RootState } from "../redux/store";

const SignUp = () => {
  const dispatch  = useDispatch<AppDispatch>();
  const navigate  = useNavigate();

  const { loading, error }    = useSelector((s: RootState) => s.user);
  const { hospitals, organizations } = useSelector((s: RootState) => s.public);

  useEffect(() => {
    dispatch(fetchPublicOrganizations());
    dispatch(fetchPublicHospitals());
  }, [dispatch]);

  const [formData, setFormData] = useState({
    name:            "",
    email:           "",
    password:        "",
    organization_id: "",
    hospital_id:     "",
    role:            "" as UserRole | "",
  });

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleOrgChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const orgId = e.target.value;
    setFormData((prev) => ({ ...prev, organization_id: orgId, hospital_id: "" }));
    // Filter hospitals by org when an org is selected
    dispatch(orgId ? fetchPublicHospitals(orgId) : fetchPublicHospitals());
  };

  const selectRole = (role: UserRole) => {
    setFormData((prev) => ({
      ...prev,
      role,
      // Super admins don't belong to a hospital
      hospital_id: role === "super_admin" ? "" : prev.hospital_id,
    }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.role) return toast.error("Please select a role.");

    if ((formData.role === "staff" || formData.role === "admin") && !formData.hospital_id)
      return toast.error("Please select a hospital.");

    if (formData.role === "super_admin" && !formData.organization_id)
      return toast.error("Please select an organization.");

    // FIX: send role directly — not 3 boolean flags
    const payload = {
      name:            formData.name.trim(),
      email:           formData.email.trim().toLowerCase(),
      password:        formData.password,
      role:            formData.role as UserRole,
      organization_id: formData.organization_id ? Number(formData.organization_id) : undefined,
      hospital_id:     formData.role === "super_admin" ? undefined : Number(formData.hospital_id),
    };

    try {
      await dispatch(signupUser(payload)).unwrap();
      toast.success("Signup successful! Check your email to verify your account.");
      setTimeout(() => navigate("/"), 1500);
    } catch (err: any) {
      toast.error(err || "Signup failed");
    }
  };

  const roleBtn = (role: UserRole, label: string, Icon: React.FC<any>, color: string) => (
    <button
      type="button"
      onClick={() => selectRole(role)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors
        ${formData.role === role
          ? `border-${color}-600 bg-white text-black font-semibold`
          : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
        }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );

  return (
    <div className="flex flex-col min-h-screen text-white">
      <Navbar />

      <main className="flex items-center justify-center p-6 flex-1">
        <div className="card w-full max-w-lg">
          <h2 className="text-2xl font-bold mb-6 text-center">Create an Account</h2>

          <form onSubmit={handleSignup} className="space-y-5">

            {/* Name */}
            <div>
              <label className="block mb-1 font-medium">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-black w-5 h-5" />
                <input
                  type="text" name="name" placeholder="Enter your name"
                  value={formData.name} onChange={handleInput} required
                  className="!pl-10 bg-white text-black border rounded py-2 px-3 w-full"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block mb-1 font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-black w-5 h-5" />
                <input
                  type="email" name="email" placeholder="Enter your email"
                  value={formData.email} onChange={handleInput} required
                  className="!pl-10 bg-white text-black border rounded py-2 px-3 w-full"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block mb-1 font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-black w-5 h-5" />
                <input
                  type="password" name="password" placeholder="Enter your password"
                  value={formData.password} onChange={handleInput} required
                  className="!pl-10 bg-white text-black border rounded py-2 px-3 w-full"
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block mb-2 font-medium">Select Role</label>
              <div className="flex gap-3 flex-wrap">
                {roleBtn("staff",       "Staff",                    Stethoscope, "blue")}
                {roleBtn("admin",       "Hospital Admin",           UserCog,     "blue")}
                {roleBtn("super_admin", "Organization Super Admin", Building2,   "purple")}
              </div>
            </div>

            {/* Organization */}
            <div>
              <label className="block mb-1 font-medium">
                Select Organization
                {formData.role === "super_admin" && (
                  <span className="text-red-400 ml-1">*</span>
                )}
              </label>
              <select
                name="organization_id"
                value={formData.organization_id}
                onChange={handleOrgChange}
                className="bg-white text-black border rounded py-2 px-3 w-full"
              >
                <option value="">-- Select Organization --</option>
                {organizations.map((org: PublicOrganization) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>

            {/* Hospital — hidden for super_admin */}
            {formData.role !== "super_admin" && (
              <div>
                <label className="block mb-1 font-medium">
                  Select Hospital <span className="text-red-400">*</span>
                </label>
                <select
                  name="hospital_id"
                  value={formData.hospital_id}
                  onChange={handleInput}
                  className="bg-white text-black border rounded py-2 px-3 w-full"
                >
                  <option value="">-- Select Hospital --</option>
                  {hospitals.map((h: PublicHospital) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button type="submit" className="btn w-full" disabled={loading}>
              {loading ? "Creating Account..." : "Sign Up"}
            </button>
          </form>

          <p className="text-center text-sm mt-6">
            Already have an account?{" "}
            <a href="/" className="font-medium hover:underline">Sign In</a>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SignUp;