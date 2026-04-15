"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function TopBar() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [role, setRole] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

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
        if (
          typeof window !== "undefined" &&
          window.localStorage?.getItem("DEBUG_UI") === "1"
        ) {
          console.debug("[TopBar] getSession()", {
            user: u?.id,
            email: u?.email,
          });
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
              if (
                typeof window !== "undefined" &&
                window.localStorage?.getItem("DEBUG_UI") === "1"
              ) {
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

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        try {
          if (
            typeof window !== "undefined" &&
            window.localStorage?.getItem("DEBUG_UI") === "1"
          ) {
            console.debug("[TopBar] onAuthStateChange", {
              event: _event,
              user: u?.id,
            });
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
                if (
                  typeof window !== "undefined" &&
                  window.localStorage?.getItem("DEBUG_UI") === "1"
                ) {
                  console.debug("[TopBar] profile (auth change)", prof);
                }
              } catch {}
            })
            .catch(() => {});
        } else {
          setPlan(null);
          setRole(null);
        }
      },
    );
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isLoggedIn = !loading && !!user;

  return (
    <header className="w-full border-b border-red-200 bg-white text-[#BF283B]">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <a href="/" className="font-semibold tracking-wide">
            Lankan Web Directory
          </a>

          <div className="hidden items-center gap-3 md:flex">
            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard/home"
                  className="rounded px-3 py-1.5 bg-[#BF283B] text-white hover:bg-[#a32131] border border-white/20"
                >
                  Dashboard
                </Link>
                {role === "ADMIN" && (
                  <Link
                    href="/admin"
                    className="rounded px-3 py-1.5 bg-[#BF283B] text-white hover:bg-[#a32131] border-white/20"
                    prefetch
                  >
                    Admin panel
                  </Link>
                )}
                <div className="text-sm">
                  <div className="font-medium text-[#BF283B]">{user.email}</div>
                  {plan && <div className="text-[#BF283B]">Plan: {plan}</div>}
                </div>
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

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-red-200 p-2 text-[#BF283B] md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-topbar-menu"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {menuOpen ? (
                <>
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </>
              ) : (
                <>
                  <path d="M3 6h18" />
                  <path d="M3 12h18" />
                  <path d="M3 18h18" />
                </>
              )}
            </svg>
          </button>
        </div>

        <div
          id="mobile-topbar-menu"
          className={`${menuOpen ? "mt-3 flex" : "hidden"} flex-col gap-3 rounded-2xl border border-red-100 bg-red-50/60 p-4 md:hidden`}
        >
          {isLoggedIn ? (
            <>
              <div className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
                <div className="font-medium text-[#BF283B] break-all">{user.email}</div>
                {plan && <div className="text-[#BF283B]">Plan: {plan}</div>}
              </div>
              <Link
                href="/dashboard/home"
                className="rounded-xl bg-[#BF283B] px-4 py-2.5 text-center font-semibold text-white hover:bg-[#a32131]"
              >
                Dashboard
              </Link>
              {role === "ADMIN" && (
                <Link
                  href="/admin"
                  className="rounded-xl bg-[#BF283B] px-4 py-2.5 text-center font-semibold text-white hover:bg-[#a32131]"
                  prefetch
                >
                  Admin panel
                </Link>
              )}
              <a
                href="/auth/sign-out"
                className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-center font-semibold text-red-700 hover:bg-red-50"
              >
                Sign out
              </a>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-center font-semibold text-red-700 hover:bg-red-50"
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
