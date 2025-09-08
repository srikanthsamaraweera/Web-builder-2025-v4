"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function TopBar() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const u = data.user ?? null;
      setUser(u);
      try {
        if (typeof window !== "undefined" && window.localStorage?.getItem("DEBUG_UI") === "1") {
          console.debug("[TopBar] getUser()", { user: u?.id, email: u?.email });
        }
      } catch {}
      if (u) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("plan_tier, role")
          .eq("id", u.id)
          .single();
        if (mounted) {
          setPlan(prof?.plan_tier || null);
          setRole(prof?.role || null);
          try {
            if (typeof window !== "undefined" && window.localStorage?.getItem("DEBUG_UI") === "1") {
              console.debug("[TopBar] profile", prof);
            }
          } catch {}
        }
      } else {
        setPlan(null);
        setRole(null);
      }
      setLoading(false);
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
        const { data: prof } = await supabase
          .from("profiles")
          .select("plan_tier, role")
          .eq("id", u.id)
          .single();
        if (mounted) {
          setPlan(prof?.plan_tier || null);
          setRole(prof?.role || null);
          try {
            if (typeof window !== "undefined" && window.localStorage?.getItem("DEBUG_UI") === "1") {
              console.debug("[TopBar] profile (auth change)", prof);
            }
          } catch {}
        }
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

  const onSignOut = async () => {
    await supabase.auth.signOut();
    try {
      // Force a full reload so UI reflects logged-out state everywhere
      window.location.reload();
    } catch {
      // Fallback in non-browser contexts
      router.refresh?.();
      router.push("/");
    }
  };

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
              <a
                href="/dashboard"
                className="rounded px-3 py-1.5 bg-white text-red-700 hover:bg-red-50 border border-white/20"
              >
                Dashboard
              </a>
              {role === "ADMIN" && (
                <a
                  href="/admin"
                  className="rounded px-3 py-1.5 bg-white text-red-700 hover:bg-red-50 border border-white/20"
                >
                  Admin panel
                </a>
              )}
              <button
                onClick={onSignOut}
                className="rounded px-3 py-1.5 bg-white text-red-700 hover:bg-red-50 border border-white/20"
              >
                Sign out
              </button>
            </>
          ) : (
            <a
              href="/login"
              className="rounded px-3 py-1.5 bg-white text-red-700 hover:bg-red-50 border border-white/20"
            >
              Sign in
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
