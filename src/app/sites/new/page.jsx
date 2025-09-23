"use client";

export const dynamic = "force-static";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import LoadingOverlay from "@/components/LoadingOverlay";

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

async function checkSlugAvailable(slug) {
  if (!slug) return false;
  const res = await fetch(`/api/sites/slug-available?slug=${encodeURIComponent(slug)}`);
  if (!res.ok) return false;
  const data = await res.json();
  return !!data.available;
}

export default function NewSitePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [slug, setSlug] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(null); // null=idle, true/false
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [count, setCount] = useState(0);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    setSlug(slugify(slugInput));
  }, [slugInput]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session || null;
        if (!session) {
          router.replace("/login");
          return;
        }
        try {
          if (session?.access_token) {
            await fetch("/api/profiles/initialize", {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
          }
        } catch {}
        const userId = session.user.id;
        const [profileRes, countRes] = await Promise.all([
          supabase.from("profiles").select("paid_until, site_limit, role").eq("id", userId).maybeSingle(),
          supabase.from("sites").select("id", { count: "exact", head: true }).eq("owner", userId),
        ]);
        if (profileRes?.error) {
          console.warn("Failed to load profile", profileRes.error);
        }
        setProfile(profileRes?.data || null);
        setCount(countRes?.count || 0);
      } finally {
        setCheckingAuth(false);
      }
    })();
  }, [router]);

  const isAdmin = (profile?.role || "USER") === "ADMIN";
  const siteLimit = isAdmin ? Number.POSITIVE_INFINITY : (profile?.site_limit ?? 5);
  const paidUntil = profile?.paid_until ? new Date(profile.paid_until) : null;
  const isExpired = isAdmin ? false : (profile ? (!paidUntil || paidUntil <= new Date()) : false);
  const atLimit = isAdmin ? false : (count >= siteLimit);

  useEffect(() => {
    let active = true;
    if (!slug || !/^[a-z0-9-]{3,30}$/.test(slug)) {
      setAvailable(null);
      return;
    }
    setChecking(true);
    const t = setTimeout(async () => {
      const ok = await checkSlugAvailable(slug);
      if (!active) return;
      setAvailable(ok);
      setChecking(false);
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [slug]);

  const canCreate = useMemo(() => {
    return (
      title.trim().length >= 3 &&
      /^[a-z0-9-]{3,30}$/.test(slug) &&
      available === true &&
      !!profile &&
      !loading && !isExpired && !atLimit
    );
  }, [title, slug, available, loading, isExpired, atLimit, profile]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session || null;
      if (!session) throw new Error("You must be signed in.");
      const user = session.user;

      if (!isAdmin && isExpired) throw new Error("Your plan is inactive. Please renew.");
      if (!isAdmin && atLimit) throw new Error("You have reached your site limit.");

      // Insert site with owner = user.id
      const { data: created, error: insErr } = await supabase
        .from("sites")
        .insert({ owner: user.id, slug, title })
        .select("id")
        .single();
      if (insErr) throw insErr;

      router.push(`/sites/${created.id}/edit`);
    } catch (err) {
      setError(err.message || "Unable to create site");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) return <LoadingOverlay message="Preparing create page..." />;

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-red-700">Create a new site</h1>
      <div className="mb-3 text-sm text-red-700/90 font-medium">{count}/{isAdmin ? "∞" : siteLimit} created</div>
      {profile && (!isAdmin && isExpired) && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-800">
          Your plan is inactive. Please renew to create sites.
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Slug</label>
          <input
            type="text"
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value)}
            placeholder="my-awesome-site"
            required
          />
          <div className="mt-1 text-xs">
            {slug && !/^[a-z0-9-]{3,30}$/.test(slug) && (
              <span className="text-red-600">Use 3–30 lowercase letters, digits, hyphens.</span>
            )}
            {checking && <span className="text-gray-500"> Checking availability…</span>}
            {!checking && available === true && (
              <span className="text-green-700">Slug is available.</span>
            )}
            {!checking && available === false && (
              <span className="text-red-600">Slug is taken.</span>
            )}
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canCreate}
            className="rounded bg-red-600 text-white px-4 py-2 font-medium hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

