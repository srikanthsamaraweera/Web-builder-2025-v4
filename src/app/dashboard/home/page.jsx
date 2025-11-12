"use client";

export const dynamic = "force-static";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardHomePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!mounted) return;

      const currentUser = auth?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const [{ data: prof }, { data: rows }] = await Promise.all([
          supabase
            .from("profiles")
            .select("paid_until, plan_tier, site_limit, role")
            .eq("id", currentUser.id)
            .single(),
          supabase
            .from("sites")
            .select("id, title, slug, status, created_at, logo")
            .eq("owner", currentUser.id)
            .order("created_at", { ascending: false })
            .limit(6),
        ]);

        if (!mounted) return;

        setProfile(prof || null);
        setSites(rows || []);
      }

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return null;
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <section className="max-w-3xl text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold text-red-700">
            Sign in to manage your sites
          </h1>
          <p className="text-gray-700">
            You need to be signed in to view your dashboard. Use the links
            below to log in or create an account.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/login"
              className="rounded bg-red-600 text-white px-5 py-2.5 font-medium hover:bg-red-700"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded border border-red-300 text-red-700 px-5 py-2.5 font-medium hover:bg-red-50"
            >
              Start free trial
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const isAdmin = (profile?.role || "USER") === "ADMIN";
  const siteLimit = isAdmin ? Infinity : (profile?.site_limit ?? 5);
  const siteLimitDisplay = isAdmin ? "Unlimited" : String(siteLimit);
  const paidUntil = profile?.paid_until ? new Date(profile.paid_until) : null;
  const isExpired = isAdmin ? false : (!paidUntil || paidUntil <= new Date());
  const atLimit = isAdmin ? false : sites.length >= siteLimit;
  const resume = sites.find(
    (s) => s.status === "DRAFT" || s.status === "SUBMITTED"
  );

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-red-700">
            Welcome back
          </h1>
          <div className="mt-1 text-sm text-red-700/90 font-medium">
            {sites.length}/{siteLimitDisplay} created
            {profile?.plan_tier && (
              <span className="ml-2 inline-block rounded bg-red-50 text-red-700 border border-red-200 px-2 py-0.5">
                Plan: {profile.plan_tier}
              </span>
            )}
            {!isAdmin && paidUntil && (
              <span className="ml-2 text-xs text-gray-600">
                Expires on {paidUntil.toLocaleDateString()}
              </span>
            )}
            {isAdmin && (
              <span className="ml-2 text-xs text-gray-600">
                Admin: no limits
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {resume && (
            <Link
              href={`/sites/${resume.id}/edit`}
              className="rounded border border-red-300 text-red-700 px-4 py-2 font-medium hover:bg-red-50"
            >
              Resume editing
            </Link>
          )}
          <Link
            href={!isAdmin && (atLimit || isExpired) ? "#" : "/sites/new"}
            aria-disabled={!isAdmin && (atLimit || isExpired)}
            className={`rounded px-4 py-2 font-medium ${
              !isAdmin && (atLimit || isExpired)
                ? "bg-red-300 text-white cursor-not-allowed"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
            onClick={(e) => {
              if (!isAdmin && (atLimit || isExpired)) e.preventDefault();
            }}
            title={
              isAdmin
                ? "Admin access"
                : isExpired
                ? "Subscription expired"
                : atLimit
                ? "Site limit reached"
                : "Create a new site"
            }
          >
            Create Site
          </Link>
          <Link
            href="/dashboard/home"
            className="rounded border border-red-300 text-red-700 px-4 py-2 font-medium hover:bg-red-50"
          >
            Manage sites
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded border border-red-300 text-red-700 px-4 py-2 font-medium hover:bg-red-50"
            >
              Admin panel
            </Link>
          )}
        </div>
      </header>

      {!isAdmin && isExpired && (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-red-800">
          Your plan is inactive. Please renew to create or submit sites.
          {paidUntil && (
            <span className="ml-1">
              (Expired on {paidUntil.toLocaleDateString()})
            </span>
          )}
        </div>
      )}

      <section>
        <h2 className="font-semibold text-red-700 mb-3">Recent sites</h2>
        {sites.length === 0 ? (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800">
            You haven't created any sites yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-red-200 bg-white shadow-sm overflow-hidden"
              >
                <div className="h-28 bg-red-100 flex items-center justify-center">
                  {s.logo ? (
                    <Image
                      src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-assets/${s.logo}`}
                      alt="Logo"
                      width={160}
                      height={80}
                      className="max-h-20 object-contain"
                      sizes="160px"
                    />
                  ) : (
                    <div className="text-red-600 font-semibold">
                      {s.title?.slice(0, 1) || "S"}
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-1">
                  <div
                    className="font-semibold text-red-700 truncate"
                    title={s.title}
                  >
                    {s.title}
                  </div>
                  <div className="text-xs text-gray-600">/{s.slug}</div>
                  <div className="text-xs mt-1">
                    <span className="inline-block rounded bg-red-50 text-red-700 border border-red-200 px-2 py-0.5">
                      {s.status === "SUBMITTED"
                        ? "Submitted for approval"
                        : s.status === "APPROVED"
                        ? "Approved"
                        : s.status === "REJECTED"
                        ? "Rejected"
                        : "Draft"}
                    </span>
                  </div>
                  <div className="pt-3 flex items-center justify-between">
                    <Link
                      href={`/sites/${s.id}/edit`}
                      className="inline-flex items-center rounded bg-red-600 text-white px-3 py-1.5 font-medium hover:bg-red-700"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/sites/${s.id}/preview1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded border border-red-200 px-3 py-1.5 font-medium text-red-700 hover:bg-red-50"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M1.5 12s3.5-6 10.5-6 10.5 6 10.5 6-3.5 6-10.5 6S1.5 12 1.5 12Z" />
                        <circle cx="12" cy="12" r="2.5" />
                      </svg>
                      <span>Preview</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
