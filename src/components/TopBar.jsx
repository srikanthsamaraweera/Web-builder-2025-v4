"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function TopBar() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const u = data.session?.user ?? null;
      setUser(u);
      // Show header immediately; fetch profile details in background
      setLoading(false);
      try {
        if (typeof window !== "undefined" && window.localStorage?.getItem("DEBUG_UI") === "1") {
          console.debug("[TopBar] getSession()", { user: u?.id, email: u?.email });
        }
      } catch {}
      if (u) {
        supabase
          .from("profiles")
          .select("plan_tier, role")
          .eq("id", u.id)
          .single()
          .then(({ data: prof }) => {
            if (!mounted) return;
            setPlan(prof?.plan_tier || null);
            setRole(prof?.role || null);
            try {
              if (typeof window !== "undefined" && window.localStorage?.getItem("DEBUG_UI") === "1") {
                console.debug("[TopBar] profile", prof);
              }
            } catch {}
          })
          .catch(() => {});
      } else {
        setPlan(null);
        setRole(null);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      try {
        if (typeof window !== "undefined" && window.localStorage?.getItem("DEBUG_UI") === "1") {
          console.debug("[TopBar] onAuthStateChange", { event: _event, user: u?.id });
        }
      } catch {}
      if (u) {
        supabase
          .from("profiles")
          .select("plan_tier, role")
          .eq("id", u.id)
          .single()
          .then(({ data: prof }) => {
            if (!mounted) return;
            setPlan(prof?.plan_tier || null);
            setRole(prof?.role || null);
            try {
              if (typeof window !== "undefined" && window.localStorage?.getItem("DEBUG_UI") === "1") {
                console.debug("[TopBar] profile (auth change)", prof);
              }
            } catch {}
          })
          .catch(() => {});
      } else {
        setPlan(null);
        setRole(null);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="w-full border-b border-red-200 bg-red-600 text-white">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <a href="/" className="font-semibold tracking-wide">Web Builder</a>
        <div className="flex items-center gap-3">
          {!loading && user ? (
            <>
              <div className="text-sm">
                <div className="font-medium">{user.email}</div>
                {plan && (
                  <div className="text-white/80">Plan: {plan}</div>
                )}
              </div>
              <Link
                href="/dashboard/home"
                className="rounded px-3 py-1.5 bg-white text-red-700 hover:bg-red-50 border border-white/20"
              >
                Dashboard
              </Link>
              {role === "ADMIN" && (
                <Link
                  href="/admin"
                  className="rounded px-3 py-1.5 bg-white text-red-700 hover:bg-red-50 border border-white/20"
                  prefetch
                >
                  Admin panel
                </Link>
              )}
              <a
                href="/auth/sign-out"
                className="rounded px-3 py-1.5 bg-white text-red-700 hover:bg-red-50 border border-white/20"
              >
                Sign out
              </a>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded px-3 py-1.5 bg-white text-red-700 hover:bg-red-50 border border-white/20"
              prefetch
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
