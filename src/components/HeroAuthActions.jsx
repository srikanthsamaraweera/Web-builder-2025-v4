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
      (_event, session) => {
        window.setTimeout(async () => {
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
        }, 0);
      },
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="mt-7 flex w-full flex-col gap-3 min-[420px]:w-auto min-[420px]:flex-row">
      {!loading && !user ? (
        <>
          <Link
            href="/register"
            className="rounded-xl bg-[#BF283B] px-5 py-3 text-center font-semibold text-white shadow-lg shadow-red-900/10 transition hover:-translate-y-0.5 hover:bg-[#a32131]"
          >
            Register now
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-stone-300 bg-white px-5 py-3 text-center font-semibold text-stone-700 transition hover:border-[#BF283B] hover:text-[#BF283B]"
          >
            Sign in
          </Link>
        </>
      ) : null}

      {!loading && user ? (
        checkingLimit ? (
          <span
            className="cursor-wait rounded-xl bg-[#BF283B]/70 px-5 py-3 text-center font-semibold text-white shadow-lg shadow-red-900/10 opacity-80"
            aria-disabled="true"
          >
            Create Now
          </span>
        ) : atLimit ? (
          <span
            className="cursor-not-allowed rounded-xl bg-[#BF283B]/45 px-5 py-3 text-center font-semibold text-white shadow-lg shadow-red-900/10 opacity-80"
            aria-disabled="true"
            title="You have reached your site creation limit"
          >
            Create Now
          </span>
        ) : (
          <Link
            href="/sites/new"
            className="rounded-xl bg-[#BF283B] px-5 py-3 text-center font-semibold text-white shadow-lg shadow-red-900/10 transition hover:-translate-y-0.5 hover:bg-[#a32131]"
          >
            Create Now
          </Link>
        )
      ) : null}
    </div>
  );
}
