"use client";

export const dynamic = "force-static";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import LoadingOverlay from "@/components/LoadingOverlay";

const PAGE_SIZE = 10;
const TABS = [
  { id: "pending", label: "Pending approval" },
  { id: "approved", label: "Approved sites" },
  { id: "rejected", label: "Not approved" },
  { id: "drafts", label: "Drafts" },
];
const STATUS_LABELS = {
  DRAFT: "Draft",
  SUBMITTED: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Not approved",
};

function randomConfirmationCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(8);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

function AdminSitesPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const requestedTab = (search?.get("tab") || "pending").toLowerCase();
  const tab = TABS.some((item) => item.id === requestedTab) ? requestedTab : "pending";
  const page = Math.max(1, Number.parseInt(search?.get("page") || "1", 10) || 1);
  const query = search?.get("q") || "";
  const ownerEmail = search?.get("ownerEmail") || "";
  const start = search?.get("start") || "";
  const end = search?.get("end") || "";
  const statusFilter = search?.get("status") || "";
  const sort = search?.get("sort") || "newest";

  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sites, setSites] = useState([]);
  const [total, setTotal] = useState(0);
  const [accessToken, setAccessToken] = useState("");
  const [loadError, setLoadError] = useState("");
  const [statusDialog, setStatusDialog] = useState(null);
  const [targetStatus, setTargetStatus] = useState("SUBMITTED");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [confirmationInput, setConfirmationInput] = useState("");
  const [statusComment, setStatusComment] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");

  const loadSites = useCallback(async (token) => {
    setChecking(true);
    setLoadError("");
    const params = new URLSearchParams({ tab, page: String(page), pageSize: String(PAGE_SIZE) });
    if (query) params.set("q", query);
    if (ownerEmail) params.set("ownerEmail", ownerEmail);
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (statusFilter) params.set("status", statusFilter);
    if (sort) params.set("sort", sort);
    const response = await fetch(`/api/admin/sites/list?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Unable to load moderation sites.");
    const payload = await response.json();
    setSites(payload.rows || []);
    setTotal(payload.total || 0);
    setChecking(false);
  }, [end, ownerEmail, page, query, sort, start, statusFilter, tab]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getSession();
        const session = auth?.session;
        if (!session) {
          router.replace("/login");
          return;
        }
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
        if (profile?.role !== "ADMIN") {
          router.replace("/dashboard/home");
          return;
        }
        if (cancelled) return;
        setAllowed(true);
        setAccessToken(session.access_token);
        await loadSites(session.access_token);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error.message || "Unable to load moderation sites.");
          setChecking(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [loadSites, router]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const assetImages = useCallback((site) => {
    const paths = [site.logo, ...(Array.isArray(site.hero) ? site.hero : []), ...(Array.isArray(site.gallery) ? site.gallery : [])];
    return paths
      .filter((path, index) => path && paths.indexOf(path) === index)
      .map((path) => ({ path, url: site.asset_urls?.[path] || "" }))
      .filter((image) => image.url);
  }, []);

  const openStatusDialog = (site) => {
    setStatusDialog(site);
    setTargetStatus(site.status || "DRAFT");
    setConfirmationCode(randomConfirmationCode());
    setConfirmationInput("");
    setStatusComment("");
    setStatusError("");
  };

  const closeStatusDialog = () => {
    if (savingStatus) return;
    setStatusDialog(null);
    setConfirmationInput("");
    setStatusError("");
  };

  const updateStatus = async () => {
    if (!statusDialog || confirmationInput.trim().toUpperCase() !== confirmationCode) {
      setStatusError("Enter the confirmation code exactly as shown.");
      return;
    }
    setSavingStatus(true);
    setStatusError("");
    try {
      const response = await fetch("/api/admin/sites/detail", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id: statusDialog.id, status: targetStatus, comment: statusComment }),
      });
      if (!response.ok) throw new Error("Unable to change approval status.");
      setStatusDialog(null);
      setConfirmationInput("");
      await loadSites(accessToken);
    } catch (error) {
      setStatusError(error.message || "Unable to change approval status.");
    } finally {
      setSavingStatus(false);
    }
  };

  const pageHref = useCallback((nextPage) => {
    const params = new URLSearchParams(search?.toString() || "");
    params.set("tab", tab);
    params.set("page", String(nextPage));
    return `/admin/sites?${params}`;
  }, [search, tab]);

  const applyFilters = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams({ tab, page: "1" });
    for (const key of ["q", "ownerEmail", "start", "end", "status", "sort"]) {
      const value = String(form.get(key) || "").trim();
      if (value) params.set(key, value);
    }
    router.push(`/admin/sites?${params}`);
  };

  const clearFilters = () => router.push(`/admin/sites?tab=${tab}&page=1`);
  const pageNumbers = useMemo(() => {
    const first = Math.max(1, Math.min(page - 2, totalPages - 4));
    return Array.from({ length: Math.min(5, totalPages) }, (_, index) => first + index);
  }, [page, totalPages]);

  if (checking) return <LoadingOverlay message="Loading moderation queue…" />;
  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-red-700">Website moderation</h1>
          <p className="mt-1 text-sm text-gray-600">Review website content and control directory approval.</p>
        </div>
        <div className="text-sm text-gray-600">{total} website{total === 1 ? "" : "s"}</div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4" role="tablist" aria-label="Moderation categories">
        {TABS.map((item) => (
          <Link key={item.id} href={`/admin/sites?tab=${item.id}&page=1`} role="tab" aria-selected={tab === item.id}
            className={`rounded-lg border px-4 py-3 text-center font-semibold transition ${tab === item.id ? "border-[#BF283B] bg-[#BF283B] text-white" : "border-gray-300 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50"}`}>
            {item.label}
          </Link>
        ))}
      </div>

      <form key={`${tab}-${query}-${ownerEmail}-${start}-${end}-${statusFilter}-${sort}`} onSubmit={applyFilters} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="text-sm font-semibold text-gray-700 xl:col-span-2">Search website
            <input name="q" defaultValue={query} maxLength={120} placeholder="Title, slug or description" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-semibold text-gray-700">Owner email
            <input name="ownerEmail" type="email" defaultValue={ownerEmail} placeholder="owner@example.com" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-semibold text-gray-700">Created from
            <input name="start" type="date" defaultValue={start} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-semibold text-gray-700">Created to
            <input name="end" type="date" defaultValue={end} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-semibold text-gray-700">Sort
            <select name="sort" defaultValue={sort} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal">
              <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option>
            </select>
          </label>
          <input type="hidden" name="status" value="" />
          <div className="flex items-end gap-2 xl:col-span-2">
            <button type="submit" className="rounded-lg bg-[#BF283B] px-4 py-2 font-semibold text-white hover:bg-[#a32131]">Apply filters</button>
            <button type="button" onClick={clearFilters} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50">Clear</button>
          </div>
        </div>
      </form>

      {loadError ? <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">{loadError}</p> : null}

      {sites.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-600">No websites in this tab.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-[1050px] w-full border-collapse text-left">
            <thead className="bg-gray-50 text-sm text-gray-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Website</th>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold">Images</th>
                <th className="px-4 py-3 font-semibold">Approval status</th>
                <th className="px-4 py-3 font-semibold">Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sites.map((site) => {
                const images = assetImages(site);
                return (
                  <tr key={site.id} className="align-top hover:bg-gray-50/70">
                    <td className="max-w-56 px-4 py-4">
                      <Link href={`/admin/sites/${site.id}`} className="font-semibold text-red-700 hover:underline">{site.title || "Untitled website"}</Link>
                      <p className="mt-1 truncate text-xs text-gray-500">/{site.slug}</p>
                      <p className="mt-2 break-all text-xs text-gray-500">{site.owner_email || "Unknown owner"}</p>
                    </td>
                    <td className="max-w-sm px-4 py-4 text-sm leading-6 text-gray-700"><p className="line-clamp-4">{site.description || "No description provided."}</p></td>
                    <td className="px-4 py-4">
                      {images.length ? (
                        <div className="flex max-w-72 flex-wrap gap-1.5">
                          {images.map((image, index) => (
                            <a key={image.path} href={image.url} target="_blank" rel="noopener noreferrer" title={`Open image ${index + 1}`}>
                              <Image src={image.url} alt={`${site.title || "Website"} image ${index + 1}`} width={52} height={52} className="h-[52px] w-[52px] rounded border border-gray-200 object-cover" />
                            </a>
                          ))}
                        </div>
                      ) : <span className="text-sm text-gray-500">No images</span>}
                    </td>
                    <td className="px-4 py-4">
                      <button type="button" onClick={() => openStatusDialog(site)} className="rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100">{STATUS_LABELS[site.status] || site.status}</button>
                    </td>
                    <td className="px-4 py-4">
                      <Link href={site.slug ? `/${site.slug}-site` : `/sites/${site.id}/preview1`} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-lg border border-red-600 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Preview website</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
        <Link href={page > 1 ? pageHref(page - 1) : "#"} aria-disabled={page <= 1} onClick={(event) => { if (page <= 1) event.preventDefault(); }} className={`rounded border px-3 py-2 text-sm font-medium ${page > 1 ? "border-gray-300 bg-white hover:bg-gray-50" : "cursor-not-allowed border-gray-200 text-gray-400"}`}>Previous</Link>
        {pageNumbers.map((number) => <Link key={number} href={pageHref(number)} aria-current={number === page ? "page" : undefined} className={`min-w-10 rounded border px-3 py-2 text-center text-sm font-medium ${number === page ? "border-[#BF283B] bg-[#BF283B] text-white" : "border-gray-300 bg-white hover:bg-gray-50"}`}>{number}</Link>)}
        <Link href={page < totalPages ? pageHref(page + 1) : "#"} aria-disabled={page >= totalPages} onClick={(event) => { if (page >= totalPages) event.preventDefault(); }} className={`rounded border px-3 py-2 text-sm font-medium ${page < totalPages ? "border-gray-300 bg-white hover:bg-gray-50" : "cursor-not-allowed border-gray-200 text-gray-400"}`}>Next</Link>
      </nav>

      {statusDialog ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/55 px-4" role="dialog" aria-modal="true" aria-labelledby="status-dialog-title">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <h2 id="status-dialog-title" className="text-xl font-bold text-gray-900">Change approval status</h2>
            <p className="mt-1 text-sm text-gray-600">{statusDialog.title}</p>
            <label className="mt-5 block text-sm font-semibold text-gray-800">New status
              <select value={targetStatus} onChange={(event) => setTargetStatus(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                <option value="DRAFT">Draft</option><option value="SUBMITTED">Pending approval</option><option value="APPROVED">Approved</option><option value="REJECTED">Not approved</option>
              </select>
            </label>
            <label className="mt-4 block text-sm font-semibold text-gray-800">Moderation note (optional)
              <textarea value={statusComment} onChange={(event) => setStatusComment(event.target.value)} maxLength={2000} className="mt-1 min-h-20 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Reason or instructions for the website owner" />
            </label>
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm text-amber-950">To prevent accidental changes, enter this confirmation code:</p>
              <p className="mt-2 select-all font-mono text-xl font-bold tracking-[0.2em] text-amber-950">{confirmationCode}</p>
            </div>
            <label className="mt-4 block text-sm font-semibold text-gray-800">Confirmation code
              <input value={confirmationInput} onChange={(event) => setConfirmationInput(event.target.value.toUpperCase())} autoComplete="off" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono uppercase tracking-wider" />
            </label>
            {statusError ? <p className="mt-3 text-sm text-red-700">{statusError}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={savingStatus} onClick={closeStatusDialog} className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">Cancel</button>
              <button type="button" disabled={savingStatus || confirmationInput.trim().toUpperCase() !== confirmationCode} onClick={updateStatus} className="rounded-lg bg-[#BF283B] px-4 py-2 font-semibold text-white hover:bg-[#a32131] disabled:opacity-50">{savingStatus ? "Updating…" : "Change status"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminSitesPage() {
  return <Suspense fallback={<LoadingOverlay message="Loading moderation queue…" />}><AdminSitesPageInner /></Suspense>;
}
