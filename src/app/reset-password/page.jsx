"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // When visiting from the email link, Supabase creates a recovery session
    let canceled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        // If there is no session, the user likely didn't come from the link
        if (!canceled) setReady(true);
      } catch {
        if (!canceled) setReady(true);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!password || password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      const { error: updErr } = await supabase.auth.updateUser({
        password,
      });
      if (updErr) throw updErr;
      setMessage("Password updated. You can now sign in.");
      // Optional: sign out any existing session just in case
      await supabase.auth.signOut();
      router.push("/login?registered=0");
    } catch (err) {
      setError(err.message || "Unable to update password. Make sure you used the link from your email.");
    }
  };

  if (!ready) return null;

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-red-700">Choose a new password</h1>
      <p className="text-sm text-gray-700 mb-4">
        If you reached this page from the email link, set your new password below.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">New password</label>
          <input
            type="password"
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirm new password</label>
          <input
            type="password"
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
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
        <button
          type="submit"
          className="w-full rounded bg-red-600 text-white py-2 font-medium hover:bg-red-700 disabled:opacity-60"
        >
          Update password
        </button>
      </form>
    </div>
  );
}

