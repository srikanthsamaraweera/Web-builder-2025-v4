"use client";

export const dynamic = "force-static";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import LoadingOverlay from "@/components/LoadingOverlay";

const PAGE_SIZE = 20;

function AdminSitesPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const page = Math.max(1, parseInt(search?.get("page") || "1", 10));

  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sites, setSites] = useState([]);
  const [total, setTotal] = useState(0);
  const status = (search?.get("status") || "").toUpperCase();
  const ownerEmail = search?.get("ownerEmail") || "";
  const start = search?.get("start") || ""; // YYYY-MM-DD
  const end = search?.get("end") || ""; // YYYY-MM-DD

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getSession();
      const session = auth?.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      // verify admin via profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (prof?.role !== "ADMIN") {
        router.replace("/dashboard/home");
        return;
      }
      setAllowed(true);

      const params = new URLSearchParams();
      params.set("page", String(page));
      if (status) params.set("status", status);
      if (ownerEmail) params.set("ownerEmail", ownerEmail);
      if (start) params.set("start", start);
      if (end) params.set("end", end);
      const resp = await fetch(`/api/admin/sites/list?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!resp.ok) {
        setSites([]);
        setTotal(0);
        setChecking(false);
        return;
      }
      const json = await resp.json();
      setSites(json.rows || []);
      setTotal(json.total || 0);
      setChecking(false);
    })();
  }, [router, page, status, ownerEmail, start, end]);

  if (checking) return <LoadingOverlay message="Loading admin sites..." />;
  if (!allowed) return null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  function setParam(key, value) {
    const params = new URLSearchParams(search?.toString() || "");
    if (value) params.set(key, value); else params.delete(key);
    params.set("page", "1");
    router.push(`/admin/sites?${params.toString()}`);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-red-700">All sites</h1>
        <div className="text-sm text-gray-700">Page {page} of {totalPages}</div>
      </div>
      <div className="rounded border border-red-200 bg-white p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              className="w-full rounded border border-gray-300 px-3 py-2"
              value={status || ""}
              onChange={(e) => setParam("status", e.target.value)}
            >
              <option value="">All</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted for approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Not approved</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Owner email</label>
            <input
              type="email"
              placeholder="account email"
              className="w-full rounded border border-gray-300 px-3 py-2"
              defaultValue={ownerEmail}
              onBlur={(e) => setParam("ownerEmail", e.target.value.trim())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = (e.currentTarget.value || "").trim();
                  setParam("ownerEmail", v);
                }
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">From</label>
            <input
              type="date"
              className="w-full rounded border border-gray-300 px-3 py-2"
              defaultValue={start}
              onChange={(e) => setParam("start", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">To</label>
            <input
              type="date"
              className="w-full rounded border border-gray-300 px-3 py-2"
              defaultValue={end}
              onChange={(e) => setParam("end", e.target.value)}
            />
          </div>
        </div>
      </div>
      {sites.length === 0 ? (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800">
          No sites found.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map((s) => (
            <div key={s.id} className="rounded-lg border border-red-200 bg-white shadow-sm p-4 space-y-1">
              <div className="font-semibold text-red-700 truncate" title={s.title}>{s.title}</div>
              <div className="text-xs text-gray-600">/{s.slug}</div>
              <div className="text-xs mt-1">
                <span className="inline-block rounded bg-red-50 text-red-700 border border-red-200 px-2 py-0.5">
                  {s.status === 'SUBMITTED' ? 'Submitted for approval' : s.status === 'APPROVED' ? 'Approved' : s.status === 'REJECTED' ? 'Not approved' : 'Draft'}
                </span>
              </div>
              <div className="text-xs text-gray-600">
                Owner: {s.owner_email || "unknown"}
                {!s.owner_email && s.owner ? (
                  <>
                    {" "}
                    (<span title={s.owner}>{s.owner}</span>)
                  </>
                ) : null}
              </div>
              <div className="text-xs text-gray-600">Created {new Date(s.created_at).toLocaleString()}</div>
              <div className="pt-2 flex flex-wrap gap-2">
                <Link
                  href={`/admin/sites/${s.id}`}
                  className="inline-flex items-center rounded bg-red-600 text-white px-3 py-1.5 font-medium hover:bg-red-700"
                >
                  Review
                </Link>
                <Link
                  href={`/sites/${s.id}/preview1`}
                  className="inline-flex items-center rounded border border-red-600 text-red-600 px-3 py-1.5 font-medium hover:bg-red-50"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Preview
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between pt-2">
        <Link
          href={prevPage ? `/admin/sites?page=${prevPage}` : "#"}
          aria-disabled={!prevPage}
          className={`rounded px-4 py-2 font-medium ${prevPage ? "bg-red-600 text-white hover:bg-red-700" : "bg-red-300 text-white cursor-not-allowed"}`}
          onClick={(e) => { if (!prevPage) e.preventDefault(); }}
        >
          Previous
        </Link>
        <Link
          href={nextPage ? `/admin/sites?page=${nextPage}` : "#"}
          aria-disabled={!nextPage}
          className={`rounded px-4 py-2 font-medium ${nextPage ? "bg-red-600 text-white hover:bg-red-700" : "bg-red-300 text-white cursor-not-allowed"}`}
          onClick={(e) => { if (!nextPage) e.preventDefault(); }}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

export default function AdminSitesPage() {
  return (
    <Suspense fallback={<LoadingOverlay message="Loading admin sites…" />}>
      <AdminSitesPageInner />
    </Suspense>
  );
}
