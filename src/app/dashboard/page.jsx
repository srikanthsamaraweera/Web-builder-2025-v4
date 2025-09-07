"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import ChangePasswordCard from "@/components/ChangePasswordCard";
import Modal from "@/components/Modal";

export default function DashboardPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [openSecurity, setOpenSecurity] = useState(false);
  const [sites, setSites] = useState([]);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        router.replace("/login");
      } else {
        // Ensure trial initialization (1 month) if not set yet
        try {
          if (session?.access_token) {
            await fetch("/api/profiles/initialize", {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
          }
        } catch {}
        // Load user's sites
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          // profile for limits and billing state
          const { data: prof } = await supabase
            .from("profiles")
            .select("paid_until, plan_tier, site_limit")
            .eq("id", user.id)
            .single();
          setProfile(prof || null);
          const { data: rows } = await supabase
            .from("sites")
            .select("id, title, slug, status, created_at, logo, hero")
            .eq("owner", user.id)
            .order("created_at", { ascending: false });
          setSites(rows || []);
        }
        setChecking(false);
      }
    })();
  }, [router]);

  if (checking) return null;

  const siteLimit = profile?.site_limit ?? 5;
  const remaining = Math.max(0, siteLimit - (sites?.length || 0));
  const paidUntil = profile?.paid_until ? new Date(profile.paid_until) : null;
  const isExpired = !paidUntil || paidUntil <= new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-red-700">Dashboard</h1>
          <p className="text-gray-700">You are logged in. This is the dashboard.</p>
          <div className="mt-1 text-sm text-red-700/90 font-medium">
            {sites.length}/{siteLimit} created
            {profile?.plan_tier && (
              <span className="ml-2 inline-block rounded bg-red-50 text-red-700 border border-red-200 px-2 py-0.5">
                Plan: {profile.plan_tier}
              </span>
            )}
            {paidUntil && (
              <span className="ml-2 text-xs text-gray-600">Expires on {paidUntil.toLocaleDateString()}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={sites.length >= siteLimit || isExpired ? "#" : "/sites/new"}
            aria-disabled={sites.length >= siteLimit || isExpired}
            className={`rounded px-4 py-2 font-medium ${
              sites.length >= siteLimit || isExpired
                ? "bg-red-300 text-white cursor-not-allowed"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
            onClick={(e) => {
              if (sites.length >= siteLimit || isExpired) e.preventDefault();
            }}
            title={
              isExpired
                ? "Subscription expired"
                : sites.length >= siteLimit
                ? "Site limit reached"
                : "Create a new site"
            }
          >
            Create Site
          </a>
          <button
          onClick={() => setOpenSecurity(true)}
          className="rounded bg-red-600 text-white px-4 py-2 font-medium hover:bg-red-700"
        >
          Security
          </button>
        </div>
      </div>

      {isExpired && (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-red-800">
          Your plan is inactive. Please renew to create or submit sites.
          {paidUntil && (
            <span className="ml-1">(Expired on {paidUntil.toLocaleDateString()})</span>
          )}
        </div>
      )}

      <section className="mt-4">
        {sites.length === 0 ? (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800">
            You have not created any sites yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map((s) => (
              <div key={s.id} className="rounded-lg border border-red-200 bg-white shadow-sm overflow-hidden">
                <div className="h-28 bg-red-100 flex items-center justify-center">
                  {s.logo ? (
                    <img
                      src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-assets/${s.logo}`}
                      alt="Logo"
                      className="max-h-20 object-contain"
                    />
                  ) : (
                    <div className="text-red-600 font-semibold">{s.title?.slice(0, 1) || "S"}</div>
                  )}
                </div>
                <div className="p-4 space-y-1">
                  <div className="font-semibold text-red-700 truncate" title={s.title}>{s.title}</div>
                  <div className="text-xs text-gray-600">/{s.slug}</div>
                  <div className="text-xs mt-1">
                    <span className="inline-block rounded bg-red-50 text-red-700 border border-red-200 px-2 py-0.5">
                      {s.status === 'SUBMITTED' ? 'Submitted for approval' : s.status === 'APPROVED' ? 'Approved' : s.status === 'REJECTED' ? 'Rejected' : 'Draft'}
                    </span>
                  </div>
                  <div className="pt-2">
                    <a
                      href={`/sites/${s.id}/edit`}
                      className="inline-flex items-center rounded bg-red-600 text-white px-3 py-1.5 font-medium hover:bg-red-700"
                    >
                      Edit
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={openSecurity}
        onClose={() => setOpenSecurity(false)}
        title="Security"
      >
        <ChangePasswordCard />
      </Modal>
    </div>
  );
}
