"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ChangePasswordCard() {
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setEmail(data.user?.email || "");
    })();
    return () => {
      active = false;
    };
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!email) {
      setError("Password change is unavailable for this account.");
      return;
    }
    if (!currentPassword) {
      setError("Please enter your current password.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from current password.");
      return;
    }

    setLoading(true);
    try {
      // Re-verify current password to prevent accidental changes
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (verifyErr) {
        throw new Error("Current password is incorrect.");
      }

      const { error: updErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updErr) throw updErr;

      setMessage("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message || "Unable to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-red-200 bg-white shadow-sm">
      <div className="px-5 py-4 border-b border-red-100 bg-red-50 rounded-t-lg">
        <h2 className="text-lg font-semibold text-red-700">Security</h2>
        <p className="text-sm text-red-700/80">Change your account password</p>
      </div>
      <form onSubmit={onSubmit} className="p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Current password</label>
          <input
            type="password"
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">New password</label>
            <input
              type="password"
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm new password</label>
            <input
              type="password"
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">
            {message}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-red-600 text-white px-4 py-2 font-medium hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
          <p className="text-xs text-gray-500">Minimum 8 characters recommended.</p>
        </div>
      </form>
    </section>
  );
}

