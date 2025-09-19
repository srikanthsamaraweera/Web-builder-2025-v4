"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import LoadingOverlay from "@/components/LoadingOverlay";

const BUCKET = "site-assets";
const PAGE_SIZE = 50;

const normalizePath = (value) =>
  typeof value === "string"
    ? value.replace(/^\/+/, "").replace(/^site-assets\//, "").trim()
    : "";

const registerPath = (setRef, rawPath) => {
  const normalized = normalizePath(rawPath);
  if (normalized) setRef.add(normalized);
};

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  const precision = size < 10 && idx > 0 ? 1 : 0;
  return `${size.toFixed(precision)} ${units[idx]}`;
};

export default function RedundantImagesPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(0);

  const totalPages = useMemo(() => (files.length ? Math.ceil(files.length / PAGE_SIZE) : 1), [files.length]);
  const currentPageItems = useMemo(() => {
    if (!files.length) return [];
    const start = page * PAGE_SIZE;
    return files.slice(start, start + PAGE_SIZE);
  }, [files, page]);

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      if (!currentPageItems.length) return prev;
      const next = new Set(prev);
      const allOnPage = currentPageItems.every((item) => next.has(item.path));
      if (allOnPage) {
        currentPageItems.forEach((item) => next.delete(item.path));
      } else {
        currentPageItems.forEach((item) => next.add(item.path));
      }
      return next;
    });
  }, [currentPageItems]);

  const toggleSelection = useCallback((path) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const loadRedundant = useCallback(async () => {
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const usedPaths = new Set();
      const { data: sites, error: sitesErr } = await supabase
        .from("sites")
        .select("logo, hero, gallery");
      if (sitesErr) throw sitesErr;
      for (const site of sites || []) {
        registerPath(usedPaths, site?.logo);
        if (Array.isArray(site?.hero)) {
          for (const entry of site.hero) registerPath(usedPaths, entry);
        }
        if (Array.isArray(site?.gallery)) {
          for (const entry of site.gallery) registerPath(usedPaths, entry);
        }
      }

      const objects = [];
      const stack = [""];
      const pageSize = 1000;
      while (stack.length) {
        const folder = stack.pop();
        let page = 0;
        for (;;) {
          const { data: entries, error: listErr } = await supabase
            .storage
            .from(BUCKET)
            .list(folder, { limit: pageSize, offset: page * pageSize, sortBy: { column: "name", order: "asc" } });
          if (listErr) throw listErr;
          if (!entries || !entries.length) break;
          for (const entry of entries) {
            if (!entry?.name || entry.name === ".emptyFolderPlaceholder") continue;
            const fullPath = folder ? `${folder}/${entry.name}` : entry.name;
            const metadata = entry.metadata || {};
            if (metadata && typeof metadata.size === "number") {
              const normalized = normalizePath(fullPath);
              if (!usedPaths.has(normalized)) {
                const updatedAtRaw = entry.updated_at || entry.created_at || null;
                const timestamp = updatedAtRaw ? Date.parse(updatedAtRaw) || 0 : 0;
                objects.push({
                  path: normalized,
                  size: metadata.size,
                  updatedAt: updatedAtRaw,
                  timestamp,
                });
              }
            } else {
              // Folder
              stack.push(fullPath);
            }
          }
          if (entries.length < pageSize) break;
          page += 1;
        }
      }
      objects.sort((a, b) => {
        if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
        return a.path.localeCompare(b.path);
      });
      setFiles(objects);
      setSelected(new Set());
      setPage(0);
      if (!objects.length) {
        setInfo("No redundant images found.");
      }
    } catch (err) {
      setError(err.message || "Failed to load redundant images.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!selected.size) return;
    setDeleting(true);
    setError("");
    setInfo("");
    const targets = Array.from(selected);
    try {
      const { error: removeErr } = await supabase.storage.from(BUCKET).remove(targets);
      if (removeErr) throw removeErr;
      setFiles((prev) => prev.filter((item) => !selected.has(item.path)));
      setSelected(new Set());
      setInfo(`${targets.length} image${targets.length > 1 ? "s" : ""} deleted.`);
    } catch (err) {
      setError(err.message || "Failed to delete selected images.");
    } finally {
      setDeleting(false);
    }
  }, [selected]);

  useEffect(() => {
    const lastPageIndex = totalPages - 1;
    if (page > lastPageIndex) {
      setPage(lastPageIndex);
    }
  }, [page, totalPages]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (!session) {
          router.replace("/login");
          return;
        }
        const { data: prof, error: profileErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profileErr) throw profileErr;
        if (prof?.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }
        if (canceled) return;
        setAllowed(true);
        await loadRedundant();
      } catch (err) {
        if (!canceled) setError(err.message || "Failed to verify access.");
      } finally {
        if (!canceled) setChecking(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [router, loadRedundant]);

  const allSelected = useMemo(
    () => currentPageItems.length > 0 && currentPageItems.every((item) => selected.has(item.path)),
    [currentPageItems, selected]
  );

  const anySelected = selected.size > 0;

  if (checking) return <LoadingOverlay message="Loading redundant images..." />;
  if (!allowed) return null;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-red-700">Redundant images</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadRedundant}
            disabled={loading || deleting}
            className="rounded border px-3 py-1.5 text-sm font-medium hover:bg-red-50 disabled:opacity-60"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded border px-3 py-1.5 text-sm"
          >
            Back
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</p>
      )}
      {info && !error && (
        <p className="mb-3 rounded border border-green-300 bg-green-50 p-2 text-sm text-green-700">{info}</p>
      )}

      <div className="mb-3 flex items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            disabled={!currentPageItems.length || loading || deleting}
          />
          Select all
        </label>
        <button
          type="button"
          onClick={handleDelete}
          disabled={!anySelected || deleting}
          className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {deleting ? "Deleting..." : `Delete selected (${selected.size})`}
        </button>
        <span className="text-xs text-gray-500">{files.length} image{files.length === 1 ? "" : "s"} available</span>
      </div>

      <div className="rounded border border-gray-200">
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-600">Scanning storage...</div>
        ) : files.length ? (
          <ul className="divide-y divide-gray-200">
            {currentPageItems.map((item) => (
              <li key={item.path} className="flex items-center justify-between px-4 py-3 text-sm">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(item.path)}
                    onChange={() => toggleSelection(item.path)}
                  />
                  <span className="font-mono text-xs sm:text-sm text-gray-800">{item.path}</span>
                </label>
                <div className="flex items-center gap-4 text-xs sm:text-sm text-gray-600">
                  <span>{formatBytes(item.size)}</span>
                  <span>
                    {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-6 text-center text-sm text-gray-600">No redundant images detected.</div>
        )}
      </div>

      {files.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
          <span>
            Page {page + 1} of {totalPages} (showing {currentPageItems.length} of {files.length})
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              disabled={page === 0 || loading}
              className="rounded border px-3 py-1 text-sm disabled:opacity-60"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="rounded border px-3 py-1 text-sm disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
