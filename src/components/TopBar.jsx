"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function TopBar() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const u = data.user ?? null;
      setUser(u);
      if (u) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("plan_tier")
          .eq("id", u.id)
          .single();
        if (mounted) setPlan(prof?.plan_tier || null);
      } else {
        setPlan(null);
      }
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (!u) setPlan(null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <header className="w-full border-b border-red-200 bg-red-600 text-white">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-wide">
          Web Builder
        </Link>
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
                href="/dashboard"
                className="rounded px-3 py-1.5 bg-white text-red-700 hover:bg-red-50 border border-white/20"
              >
                Dashboard
              </Link>
              <button
                onClick={onSignOut}
                className="rounded px-3 py-1.5 bg-white text-red-700 hover:bg-red-50 border border-white/20"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded px-3 py-1.5 bg-white text-red-700 hover:bg-red-50 border border-white/20"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
