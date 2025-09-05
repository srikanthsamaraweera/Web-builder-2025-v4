"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";

const Turnstile = dynamic(() => import("react-turnstile"), { ssr: false });

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";

  const verifyTurnstile = async () => {
    const res = await fetch("/api/turnstile/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    return !!data.success;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSent(false);
    if (!token) {
      setError("Please complete the Turnstile challenge.");
      return;
    }
    setLoading(true);
    try {
      const ok = await verifyTurnstile();
      if (!ok) {
        setError("Turnstile verification failed.");
        setLoading(false);
        return;
      }
      const redirectTo = `${baseUrl}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo }
      );
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      // Avoid email enumeration by using generic message, but log actual error in dev
      setSent(true);
      if (process.env.NODE_ENV !== "production") {
        setError(err.message || String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-red-700">Reset password</h1>
      <p className="text-sm text-gray-700 mb-4">
        Enter your email address and we’ll send a link to reset your password.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          {siteKey ? (
            <Turnstile sitekey={siteKey} onVerify={(t) => setToken(t)} />
          ) : (
            <div className="text-sm text-red-700">
              Missing NEXT_PUBLIC_TURNSTILE_SITEKEY
            </div>
          )}
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </p>
        )}
        {sent && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">
            If an account exists for that email, a reset link has been sent.
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-red-600 text-white py-2 font-medium hover:bg-red-700 disabled:opacity-60"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>
    </div>
  );
}

