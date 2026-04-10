import React, { useState, useEffect } from "react";
import { User, Lock, Save, Eye, EyeOff, CheckCircle, AlertCircle, Calendar, LogIn } from "lucide-react";
import API from "../api/api";

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  
  const [usernameForm, setUsernameForm] = useState({ newUsername: "" });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const response = await API.get("/auth/profile");
      if (response.data.success) {
        setProfile(response.data.profile);
      }
    } catch (error) {
      console.error("Load profile error:", error);
    }
    setLoading(false);
  };

  const handleUsernameChange = async (e) => {
    e.preventDefault();
    if (!usernameForm.newUsername || usernameForm.newUsername.length < 3) {
      setMessage({ type: "error", text: "Username must be at least 3 characters" });
      return;
    }
    
    setLoading(true);
    setMessage({ type: "", text: "" });
    
    try {
      const response = await API.post("/auth/change-username", {
        newUsername: usernameForm.newUsername
      });
      
      if (response.data.success) {
        localStorage.setItem("adminToken", response.data.token);
        localStorage.setItem("adminUser", JSON.stringify({ 
          username: response.data.username,
          id: profile?.id 
        }));
        API.defaults.headers.common["Authorization"] = `Bearer ${response.data.token}`;
        
        setMessage({ type: "success", text: response.data.message });
        setUsernameForm({ newUsername: "" });
        loadProfile();
      }
    } catch (error) {
      setMessage({ type: "error", text: error.response?.data?.error || "Failed to change username" });
    }
    setLoading(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!passwordForm.currentPassword) {
      setMessage({ type: "error", text: "Current password is required" });
      return;
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 4) {
      setMessage({ type: "error", text: "New password must be at least 4 characters" });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
      return;
    }
    
    setLoading(true);
    setMessage({ type: "", text: "" });
    
    try {
      const response = await API.post("/auth/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      
      if (response.data.success) {
        setMessage({ type: "success", text: response.data.message });
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.response?.data?.error || "Failed to change password" });
    }
    setLoading(false);
  };

  if (loading && !profile) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">Profile Settings</h2>
        <p className="text-sm text-gray-500">Manage your account settings</p>
      </div>

      {message.text && (
        <div className={`p-3 md:p-4 rounded-lg flex items-center space-x-2 ${
          message.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        }`}>
          {message.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {profile && (
        <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-4">Account Information</h3>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500 w-32">Username</span>
              <span className="text-sm md:text-base font-medium text-gray-800">{profile.username}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500 w-32 flex items-center">
                <Calendar size={14} className="mr-2" />
                Member Since
              </span>
              <span className="text-sm md:text-base text-gray-700">
                {new Date(profile.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center py-2">
              <span className="text-sm text-gray-500 w-32 flex items-center">
                <LogIn size={14} className="mr-2" />
                Last Login
              </span>
              <span className="text-sm md:text-base text-gray-700">
                {profile.last_login ? new Date(profile.last_login).toLocaleString() : "Never"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Change Username Card */}
      <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
        <div className="flex items-center space-x-2 mb-4">
          <User size={20} className="text-yellow-500" />
          <h3 className="text-base md:text-lg font-semibold text-gray-800">Change Username</h3>
        </div>
        
        <form onSubmit={handleUsernameChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Username</label>
            <input
              type="text"
              value={usernameForm.newUsername}
              onChange={(e) => setUsernameForm({ newUsername: e.target.value })}
              placeholder="Enter new username"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Minimum 3 characters</p>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50 text-sm w-full sm:w-auto"
          >
            <Save size={16} className="mr-2" />
            Update Username
          </button>
        </form>
      </div>

      {/* Change Password Card */}
      <div className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Lock size={20} className="text-yellow-500" />
          <h3 className="text-base md:text-lg font-semibold text-gray-800">Change Password</h3>
        </div>
        
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                placeholder="Enter current password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder="Enter new password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Minimum 4 characters</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50 text-sm w-full sm:w-auto"
          >
            <Save size={16} className="mr-2" />
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
}