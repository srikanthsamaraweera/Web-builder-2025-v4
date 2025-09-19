"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import LoadingOverlay from "@/components/LoadingOverlay";

const BUCKET = "site-assets";
const PAGE_SIZE = 50;

const normalizePath = (value) => {
  if (!value || typeof value !== "string") return "";
  let path = value.trim();
  if (!path) return "";
  path = path.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\//, "");
  path = path.replace(new RegExp(`^${BUCKET}\/`), "");
  path = path.replace(/^\/+/, "");
  return path;
};

const parseArrayField = (input) => {
  const results = [];
  if (!input) return results;
  const push = (candidate) => {
    const normalized = normalizePath(candidate);
    if (normalized) results.push(normalized);
  };

  if (Array.isArray(input)) {
    input.forEach((item) => push(item));
    return results;
  }

  if (typeof input === "string") {
    const raw = input.trim();
    if (!raw) return results;

    const tryJson = () => {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => push(item));
          return true;
        }
        if (typeof parsed === "string") {
          push(parsed);
          return true;
        }
      } catch (err) {
        return false;
      }
      return false;
    };

    if (tryJson()) return results;

    let candidate = raw;
    if (candidate.startsWith("\"") && candidate.endsWith("\"")) {
      candidate = candidate.slice(1, -1);
    }
    if (candidate.startsWith("{") && candidate.endsWith("}")) {
      const inner = candidate.slice(1, -1);
      const matches = [...inner.matchAll(/"((?:\\.|[^"\\])*)"|([^,]+)/g)];
      matches.forEach((match) => {
        const value = (match[1] ?? match[2] ?? "").replace(/\\"/g, '"');
        push(value);
      });
      return results;
    }

    push(candidate);
  }

  return results;
};

const formatBytes = (bytes) => {
  const value = typeof bytes === "number" ? bytes : Number(bytes || 0);
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  const precision = size < 10 && index > 0 ? 1 : 0;
  return `${size.toFixed(precision)} ${units[index]}`;
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

const describePath = (path) => {
  const segments = path.split("/").filter(Boolean);
  const ownerId = segments[0] || "";
  const siteId = segments[1] || "";
  const collection = segments[2] || "";
  const fileName = segments.length > 3 ? segments.slice(3).join("/") : segments[segments.length - 1] || "";
  return { ownerId, siteId, collection, fileName };
};

export default function RedundantImagesV2Page() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ referenced: 0, storage: 0, redundant: 0 });
  const [page, setPage] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const withSafeState = (setter) => (value) => {
    if (mountedRef.current) setter(value);
  };

  const setSafeAllowed = withSafeState(setAllowed);
  const setSafeChecking = withSafeState(setChecking);
  const setSafeLoading = withSafeState(setLoading);
  const setSafeEntries = withSafeState(setEntries);
  const setSafeError = withSafeState(setError);
  const setSafeStats = withSafeState(setStats);
  const setSafePage = withSafeState(setPage);

  const fetchRedundantImages = useCallback(async () => {
    setSafeLoading(true);
    setSafeError("");
    try {
      const usedPaths = new Set();
      const { data: sites, error: sitesError } = await supabase
        .from("sites")
        .select("logo, hero, gallery");
      if (sitesError) throw sitesError;
      (sites || []).forEach((site) => {
        parseArrayField(site?.logo).forEach((path) => usedPaths.add(path));
        parseArrayField(site?.hero).forEach((path) => usedPaths.add(path));
        parseArrayField(site?.gallery).forEach((path) => usedPaths.add(path));
      });

      const stack = [""];
      const limit = 1000;
      const redundant = [];
      let storageFileCount = 0;

      while (stack.length) {
        const folder = stack.pop();
        let offset = 0;
        for (;;) {
          const { data: list, error: listError } = await supabase
            .storage
            .from(BUCKET)
            .list(folder, {
              limit,
              offset,
              sortBy: { column: "name", order: "asc" },
            });
          if (listError) throw listError;
          if (!list || list.length === 0) break;

          for (const entry of list) {
            if (!entry?.name || entry.name === ".emptyFolderPlaceholder") continue;
            const relative = folder ? `${folder}/${entry.name}` : entry.name;
            if (!entry.id) {
              stack.push(relative);
              continue;
            }

            storageFileCount += 1;
            const normalized = normalizePath(relative);
            if (!normalized || usedPaths.has(normalized)) continue;

            const { ownerId, siteId, collection, fileName } = describePath(normalized);
            const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(normalized);
            redundant.push({
              path: normalized,
              ownerId,
              siteId,
              collection,
              fileName,
              size: entry.metadata?.size ?? null,
              updatedAt: entry.updated_at || entry.created_at || null,
              publicUrl: publicUrlData?.publicUrl || null,
            });
          }

          if (list.length < limit) break;
          offset += limit;
        }
      }

      redundant.sort((a, b) => a.path.localeCompare(b.path));

      setSafeEntries(redundant);
      setSafeStats({ referenced: usedPaths.size, storage: storageFileCount, redundant: redundant.length });
      setSafePage(0);
    } catch (err) {
      const message = err?.message || "Failed to load redundant images";
      setSafeError(message);
    } finally {
      setSafeLoading(false);
    }
  }, []);

  useEffect(() => {
    let canceled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (profileError) {
        if (!canceled) setSafeError(profileError.message || "Failed to verify access");
        return;
      }
      if (profile?.role !== "ADMIN") {
        router.replace("/dashboard");
        return;
      }
      if (!canceled) {
        setSafeAllowed(true);
        await fetchRedundantImages();
      }
    })().finally(() => {
      if (!canceled) setSafeChecking(false);
    });
    return () => {
      canceled = true;
    };
  }, [router, fetchRedundantImages]);

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const currentSlice = entries.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  if (checking) return <LoadingOverlay message="Verifying admin access..." />;
  if (!allowed) return null;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-red-700">Redundant Images v2</h1>
          <p className="text-sm text-gray-600">
            Files stored in {BUCKET} that are not referenced by any site hero, gallery, or logo field.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchRedundantImages}
            className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Scanning..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded border px-4 py-2 text-sm"
          >
            Back
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-4 grid gap-2 rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 sm:grid-cols-3">
        <div>
          <span className="block text-xs uppercase text-gray-500">Referenced</span>
          {stats.referenced}
        </div>
        <div>
          <span className="block text-xs uppercase text-gray-500">Storage Files</span>
          {stats.storage}
        </div>
        <div>
          <span className="block text-xs uppercase text-gray-500">Redundant</span>
          {stats.redundant}
        </div>
      </div>

      <div className="rounded border border-gray-200">
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-600">Scanning storage...</div>
        ) : currentSlice.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Owner ID</th>
                  <th className="px-3 py-2">Site ID</th>
                  <th className="px-3 py-2">Folder</th>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Last Modified</th>
                  <th className="px-3 py-2">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {currentSlice.map((item) => (
                  <tr key={item.path}>
                    <td className="px-3 py-2 font-mono text-xs">{item.ownerId}</td>
                    <td className="px-3 py-2 font-mono text-xs">{item.siteId}</td>
                    <td className="px-3 py-2 text-xs capitalize">{item.collection || ""}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs text-gray-800">{item.fileName}</span>
                        <span className="font-mono text-[11px] text-gray-500">{item.path}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">{formatBytes(item.size)}</td>
                    <td className="px-3 py-2 text-xs">{formatDate(item.updatedAt)}</td>
                    <td className="px-3 py-2 text-xs">
                      {item.publicUrl ? (
                        <a
                          href={item.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-red-600 hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-gray-600">No redundant images detected.</div>
        )}
      </div>

      {entries.length > PAGE_SIZE && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
          <span>
            Page {currentPage + 1} of {totalPages} (showing {currentSlice.length} of {entries.length})
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSafePage(Math.max(0, currentPage - 1))}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              disabled={currentPage === 0 || loading}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setSafePage(Math.min(totalPages - 1, currentPage + 1))}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              disabled={currentPage >= totalPages - 1 || loading}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
