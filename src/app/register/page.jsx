"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import dynamic from "next/dynamic";
const Turnstile = dynamic(() => import("react-turnstile"), { ssr: false });

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY;

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
    setMessage("");
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
      const { data: signUpData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { level: "basic" },
        },
      });
      if (authError) throw authError;
      // Ensure user is not logged in automatically after sign up
      await supabase.auth.signOut();
      // Redirect to login with a success flag to show message there
      router.push("/login?registered=1");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-red-700">Register</h1>
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
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          {siteKey ? (
            <Turnstile
              sitekey={siteKey}
              onVerify={(t) => setToken(t)}
              theme="light"
            />
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
        {message && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-red-600 text-white py-2 font-medium hover:bg-red-700 disabled:opacity-60"
        >
          {loading ? "Registering..." : "Register"}
        </button>
      </form>

      <p className="mt-4 text-sm">
        Already have an account? {" "}
        <a className="text-red-700 underline" href="/login">
          Sign in
        </a>
      </p>
    </div>
  );
}
