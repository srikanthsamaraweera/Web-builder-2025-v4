"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function TopBar() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState("");
  const [role, setRole] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
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
          .select("plan_tier, role, subscription_status")
          .eq("id", u.id)
          .single()
          .then(({ data: prof }) => {
            if (!mounted) return;
            setPlan(prof?.plan_tier || null);
            setSubscriptionStatus(
              (prof?.subscription_status || "").toLowerCase(),
            );
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
        setSubscriptionStatus("");
        setRole(null);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        window.setTimeout(() => {
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
            .select("plan_tier, role, subscription_status")
            .eq("id", u.id)
            .single()
            .then(({ data: prof }) => {
              if (!mounted) return;
              setPlan(prof?.plan_tier || null);
              setSubscriptionStatus(
                (prof?.subscription_status || "").toLowerCase(),
              );
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
          setSubscriptionStatus("");
          setRole(null);
        }
        }, 0);
      },
    );

    const refreshSubscriptionLabel = async () => {
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user;
      if (!mounted || !currentUser) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("plan_tier, role, subscription_status")
        .eq("id", currentUser.id)
        .maybeSingle();
      if (!mounted) return;
      setPlan(prof?.plan_tier || null);
      setSubscriptionStatus(
        (prof?.subscription_status || "").toLowerCase(),
      );
      setRole(prof?.role || null);
    };
    window.addEventListener(
      "subscription-profile-updated",
      refreshSubscriptionLabel,
    );
    return () => {
      mounted = false;
      window.removeEventListener(
        "subscription-profile-updated",
        refreshSubscriptionLabel,
      );
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const scrollThreshold = 96;

    const handleScroll = () => {
      setIsPinned(window.scrollY > scrollThreshold);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const isLoggedIn = !loading && !!user;
  const compactSubscriptionLabel =
    role === "ADMIN"
      ? null
      : subscriptionStatus === "trialing"
        ? `${plan || "Plan"} · Trial`
        : subscriptionStatus === "active"
          ? plan || "Active"
          : subscriptionStatus === "past_due" || subscriptionStatus === "unpaid"
            ? "Payment due"
            : subscriptionStatus === "paused"
              ? "Plan paused"
              : subscriptionStatus === "incomplete"
                ? "Payment pending"
                : subscriptionStatus === "unsupported_price"
                  ? "Plan issue"
                  : "No active plan";

  return (
    <>
      {isPinned && <div className="h-[73px]" aria-hidden="true" />}
      <header
        className={`w-full border-b border-red-200 bg-white text-[#BF283B] shadow-[0_8px_24px_-18px_rgba(0,0,0,0.35)] transition-all duration-200 ${
          isPinned
            ? "fixed inset-x-0 top-0 z-50 backdrop-blur-sm bg-white/95"
            : "relative"
        }`}
      >
        <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <a href="/" className="font-semibold tracking-wide">
            Lankan Web Directory
          </a>

          <div className="hidden items-center gap-3 md:flex">
            <nav
              className="mr-2 flex items-center gap-1"
              aria-label="Primary navigation"
            >
              <Link
                href="/"
                className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-red-50"
              >
                Home
              </Link>
              <Link
                href="/about"
                className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-red-50"
              >
                About
              </Link>
              <Link
                href="/contact"
                className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-red-50"
              >
                Contact
              </Link>
            </nav>
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
                  {compactSubscriptionLabel && (
                    <div className="text-xs text-[#BF283B]">
                      {compactSubscriptionLabel}
                    </div>
                  )}
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
                className="rounded px-3 py-1.5 bg-white text-[#BF283B] hover:bg-red-50 border border-[#BF283B] font-bold"
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
            aria-label={
              menuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sr-only">
              {menuOpen ? "Close menu" : "Open menu"}
            </span>
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
          <nav
            className="grid grid-cols-3 gap-2 border-b border-red-100 pb-3"
            aria-label="Mobile primary navigation"
          >
            <Link
              href="/"
              className="rounded-lg bg-white px-2 py-2 text-center text-sm font-medium text-[#BF283B] shadow-sm"
            >
              Home
            </Link>
            <Link
              href="/about"
              className="rounded-lg bg-white px-2 py-2 text-center text-sm font-medium text-[#BF283B] shadow-sm"
            >
              About
            </Link>
            <Link
              href="/contact"
              className="rounded-lg bg-white px-2 py-2 text-center text-sm font-medium text-[#BF283B] shadow-sm"
            >
              Contact
            </Link>
          </nav>
          {isLoggedIn ? (
            <>
              <div className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
                <div className="font-medium text-[#BF283B] break-all">
                  {user.email}
                </div>
                {compactSubscriptionLabel && (
                  <div className="text-xs text-[#BF283B]">
                    {compactSubscriptionLabel}
                  </div>
                )}
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
    </>
  );
}
