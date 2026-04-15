"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function HeroAuthActions() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingLimit, setCheckingLimit] = useState(false);
  const [atLimit, setAtLimit] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      setLoading(false);

      if (sessionUser) {
        setCheckingLimit(true);
        const [profileRes, countRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("site_limit, role")
            .eq("id", sessionUser.id)
            .maybeSingle(),
          supabase
            .from("sites")
            .select("id", { count: "exact", head: true })
            .eq("owner", sessionUser.id),
        ]);
        if (!mounted) return;
        const profile = profileRes?.data || null;
        const isAdmin = (profile?.role || "USER") === "ADMIN";
        const siteLimit = isAdmin
          ? Number.POSITIVE_INFINITY
          : (profile?.site_limit ?? 5);
        const siteCount = countRes?.count || 0;
        setAtLimit(!isAdmin && siteCount >= siteLimit);
        setCheckingLimit(false);
      } else {
        setAtLimit(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        const sessionUser = session?.user ?? null;
        setUser(sessionUser);
        setLoading(false);

        if (sessionUser) {
          setCheckingLimit(true);
          const [profileRes, countRes] = await Promise.all([
            supabase
              .from("profiles")
              .select("site_limit, role")
              .eq("id", sessionUser.id)
              .maybeSingle(),
            supabase
              .from("sites")
              .select("id", { count: "exact", head: true })
              .eq("owner", sessionUser.id),
          ]);
          if (!mounted) return;
          const profile = profileRes?.data || null;
          const isAdmin = (profile?.role || "USER") === "ADMIN";
          const siteLimit = isAdmin
            ? Number.POSITIVE_INFINITY
            : (profile?.site_limit ?? 5);
          const siteCount = countRes?.count || 0;
          setAtLimit(!isAdmin && siteCount >= siteLimit);
          setCheckingLimit(false);
        } else {
          setAtLimit(false);
          setCheckingLimit(false);
        }
      },
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="mt-4 flex flex-col gap-3 sm:mt-6 sm:flex-row">
      {!loading && !user ? (
        <>
          <Link
            href="/register"
            className="rounded-2xl bg-white px-5 py-2.5 text-center font-semibold text-red-600 shadow-lg shadow-red-900/20 hover:bg-red-50"
          >
            Register now
          </Link>
          <Link
            href="/login"
            className="rounded-2xl border border-[#BF283B] px-5 py-2.5 text-center font-semibold text-[#BF283B] hover:bg-white/10 "
          >
            Sign in
          </Link>
        </>
      ) : null}

      {!loading && user ? (
        checkingLimit ? (
          <span
            className="cursor-wait rounded-2xl bg-[#BF283B]/70 px-5 py-2.5 text-center font-semibold text-white shadow-lg shadow-red-900/10 opacity-80"
            aria-disabled="true"
          >
            Create Now
          </span>
        ) : atLimit ? (
          <span
            className="cursor-not-allowed rounded-2xl bg-[#BF283B]/45 px-5 py-2.5 text-center font-semibold text-white shadow-lg shadow-red-900/10 opacity-80"
            aria-disabled="true"
            title="You have reached your site creation limit"
          >
            Create Now
          </span>
        ) : (
          <Link
            href="/sites/new"
            className="rounded-2xl bg-[#BF283B] px-5 py-2.5 text-center font-semibold text-white shadow-lg shadow-red-900/20 hover:bg-[#a32131]"
          >
            Create Now
          </Link>
        )
      ) : null}
    </div>
  );
}
