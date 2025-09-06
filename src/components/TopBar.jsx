"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function TopBar() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data.user ?? null);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
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
                <div className="text-white/80">
                  Level: {user.user_metadata?.level || "member"}
                </div>
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
