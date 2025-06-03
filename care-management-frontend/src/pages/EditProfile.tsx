import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Eye, EyeOff } from "lucide-react";
import { RootState } from "../redux/store";
import { updateUserProfile } from "../redux/slices/userSlice";
import type { AppDispatch } from '../redux/store';
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

const EditProfile = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { user, loading, authLoaded } = useSelector((state: RootState) => state.user);

  const [formData, setFormData] = useState({
    name: user?.name || "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dispatch(
        updateUserProfile({
          id: user!.id,
          name: formData.name.trim(),
          password: formData.password || undefined,
        })
      ).unwrap();

      toast.success("Profile updated successfully!");
      navigate("/homepage");
    } catch (err: any) {
      toast.error(err || "Failed to update profile");
    }
  };

  if (!authLoaded) return <div className="p-4">Loading profile...</div>;
  if (!user) return <div className="p-4 text-red-600">User not found</div>;

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-light)] text-[var(--text-dark)]">
      <Navbar />
      <div className="bg-hospital-neutral p-6">
        <div className="card max-w-md mx-auto">
          <h2 className="text-xl font-bold mb-4">Edit Profile</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field */}
            <div>
              <label className="block mb-1 font-medium">Name</label>
              <input
                type="text"
                name="name"
                className="w-full border p-2 rounded"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block mb-1 font-medium">Change Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="w-full border p-2 rounded pr-10"
                  placeholder="Leave blank to keep existing"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn w-full"
              disabled={!formData.name.trim() || loading}
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
};


export default EditProfile;
