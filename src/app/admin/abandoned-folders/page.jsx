"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import LoadingOverlay from "@/components/LoadingOverlay";

const BUCKET = "site-assets";
const PLACEHOLDER = ".emptyFolderPlaceholder";
const ASSET_FOLDERS = new Set(["hero", "gallery", "logo", "logos", "favicon"]);

const isAssetFolder = (value) => {
  if (!value || typeof value !== "string") return false;
  return ASSET_FOLDERS.has(value.toLowerCase());
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

export default function AbandonedFoldersPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [folders, setFolders] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    storageFolders: 0,
    matched: 0,
    missing: 0,
    totalSites: 0,
  });
  const [sort, setSort] = useState({ field: "path", direction: "asc" });
  const mountedRef = useRef(true);
  const selectAllRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSetState = useCallback((setter, value) => {
    if (mountedRef.current) setter(value);
  }, []);

  const listStorage = useCallback(async (prefix) => {
    const entries = [];
    const limit = 1000;
    let offset = 0;
    for (;;) {
      const { data, error: listError } = await supabase.storage.from(BUCKET).list(prefix, {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (listError) throw listError;
      if (!data || data.length === 0) break;
      entries.push(...data);
      if (data.length < limit) break;
      offset += limit;
    }
    return entries;
  }, []);

  const fetchFolders = useCallback(async () => {
    safeSetState(setLoading, true);
    safeSetState(setError, "");
    try {
      const response = await fetch("/api/admin/site-ids", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load site list");
      }
      const siteRows = Array.isArray(payload?.sites) ? payload.sites : [];

      const siteMap = new Map();
      siteRows.forEach((row) => {
        const rawId = row?.id;
        if (rawId === undefined || rawId === null) return;
        const id = String(rawId).trim();
        if (!id) return;
        siteMap.set(id, {
          id,
          owner: row?.owner ? String(row.owner).trim() : "",
        });
      });

      const collected = [];
      const seenPaths = new Set();

      const register = ({ ownerId, folderName, path, updatedAt }) => {
        const name = (folderName || "").trim();
        if (!name) return;

        const storagePath = (path || name).replace(/^[\\/]+/, "").replace(/[\\/]+$/, "");
        if (!storagePath || seenPaths.has(storagePath)) return;
        seenPaths.add(storagePath);

        const match = siteMap.get(name);
        collected.push({
          path: storagePath,
          folderName: name,
          storageOwner: ownerId || "",
          dbSiteId: match?.id || "",
          dbOwnerId: match?.owner || "",
          status: match ? "In database" : "Missing",
          updatedAt: updatedAt || null,
        });
      };

      const rootEntries = await listStorage("");
      for (const rootEntry of rootEntries) {
        if (!rootEntry?.name || rootEntry.name === PLACEHOLDER) continue;
        if (rootEntry.id) continue;

        const rootName = rootEntry.name.trim();
        if (!rootName || isAssetFolder(rootName)) continue;

        const rootUpdated = rootEntry.updated_at || rootEntry.created_at || null;
        const rootMatch = siteMap.get(rootName);

        if (rootMatch) {
          register({
            ownerId: rootMatch.owner || rootName,
            folderName: rootName,
            path: rootName,
            updatedAt: rootUpdated,
          });
          continue;
        }

        const nestedEntries = await listStorage(rootName);
        let addedNested = false;

        for (const nestedEntry of nestedEntries) {
          if (!nestedEntry?.name || nestedEntry.name === PLACEHOLDER) continue;
          if (nestedEntry.id) continue;

          const nestedName = nestedEntry.name.trim();
          if (!nestedName || isAssetFolder(nestedName)) continue;

          const nestedUpdated =
            nestedEntry.updated_at ||
            nestedEntry.created_at ||
            rootUpdated ||
            null;

          register({
            ownerId: rootName,
            folderName: nestedName,
            path: `${rootName}/${nestedName}`,
            updatedAt: nestedUpdated,
          });
          addedNested = true;
        }

        if (!addedNested) {
          register({
            ownerId: rootName,
            folderName: rootName,
            path: rootName,
            updatedAt: rootUpdated,
          });
        }
      }

      collected.sort((a, b) => {
        if (a.storageOwner && b.storageOwner && a.storageOwner !== b.storageOwner) {
          const ownerCompare = a.storageOwner.localeCompare(b.storageOwner);
          if (ownerCompare !== 0) return ownerCompare;
        }
        if (a.folderName !== b.folderName) return a.folderName.localeCompare(b.folderName);
        return a.path.localeCompare(b.path);
      });

      const matchedCount = collected.filter((item) => item.dbSiteId).length;
      const missingCount = collected.length - matchedCount;

      safeSetState(setFolders, collected);
      safeSetState(setStats, {
        storageFolders: collected.length,
        matched: matchedCount,
        missing: missingCount,
        totalSites: siteMap.size,
      });
      safeSetState(setSelected, new Set());
    } catch (err) {
      const message = err?.message || "Failed to scan storage";
      safeSetState(setError, message);
    } finally {
      safeSetState(setLoading, false);
    }
  }, [listStorage, safeSetState]);

  const listAllFiles = useCallback(async (prefix) => {
    const targets = [];
    const stack = [prefix];
    while (stack.length) {
      const current = stack.pop();
      const entries = await listStorage(current);
      for (const entry of entries) {
        if (!entry?.name) continue;
        const resolved = current ? `${current}/${entry.name}` : entry.name;
        if (entry.id) {
          targets.push(resolved);
        } else {
          stack.push(resolved);
        }
      }
    }
    return targets;
  }, [listStorage]);

  const sortedFolders = useMemo(() => {
    const missingOnly = folders.filter((item) => !item.dbSiteId);
    const copy = [...missingOnly];
    const { field, direction } = sort;
    const multiplier = direction === "asc" ? 1 : -1;

    const getValue = (item) => {
      switch (field) {
        case "folderName":
          return item.folderName || "";
        case "dbSiteId":
          return item.dbSiteId || "";
        case "dbOwnerId":
          return item.dbOwnerId || "";
        case "status":
          return item.status || "";
        case "updatedAt":
          return item.updatedAt || "";
        case "path":
        default:
          return item.path || "";
      }
    };

    copy.sort((a, b) => {
      const rawA = getValue(a);
      const rawB = getValue(b);

      if (field === "updatedAt") {
        const timeA = rawA ? new Date(rawA).getTime() : 0;
        const timeB = rawB ? new Date(rawB).getTime() : 0;
        if (timeA === timeB) {
          return (a.path || "").localeCompare(b.path || "");
        }
        return (timeA - timeB) * multiplier;
      }

      const valueA = String(rawA || "").toLowerCase();
      const valueB = String(rawB || "").toLowerCase();
      const result = valueA.localeCompare(valueB);
      if (result !== 0) return result * multiplier;
      return (a.path || "").localeCompare(b.path || "");
    });

    return copy;
  }, [folders, sort]);

  const handleSort = useCallback((field) => {
    setSort((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { field, direction: "asc" };
    });
  }, []);

  const sortIndicator = (field) =>
    sort.field === field ? (sort.direction === "asc" ? "↑" : "↓") : "";

  const ariaSort = (field) =>
    sort.field === field ? (sort.direction === "asc" ? "ascending" : "descending") : "none";

  const sortClass = (field) =>
    sort.field === field ? "text-red-700" : "text-gray-600";

  const sortButtonClasses = "flex items-center gap-1 text-xs font-semibold uppercase tracking-wide";

  const displayedSelectedCount = useMemo(
    () => sortedFolders.reduce((count, item) => (selected.has(item.path) ? count + 1 : count), 0),
    [selected, sortedFolders]
  );

  const allDisplayedSelected = sortedFolders.length > 0 && displayedSelectedCount === sortedFolders.length;
  const hasSelection = selected.size > 0;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        displayedSelectedCount > 0 && displayedSelectedCount < sortedFolders.length;
    }
  }, [displayedSelectedCount, sortedFolders.length]);

  const toggleSelect = useCallback((path) => {
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

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allDisplayedSelected) {
        sortedFolders.forEach((item) => {
          next.delete(item.path);
        });
      } else {
        sortedFolders.forEach((item) => {
          next.add(item.path);
        });
      }
      return next;
    });
  }, [allDisplayedSelected, sortedFolders]);

  const handleDeleteSelected = useCallback(async () => {
    const targets = Array.from(selected);
    if (!targets.length) return;
    if (!window.confirm(`Delete ${targets.length} folder${targets.length > 1 ? "s" : ""}? This cannot be undone.`)) {
      return;
    }

    safeSetState(setDeleting, true);
    safeSetState(setError, "");
    try {
      for (const folderPath of targets) {
        const files = await listAllFiles(folderPath);
        if (!files.length) continue;
        const chunkSize = 1000;
        for (let i = 0; i < files.length; i += chunkSize) {
          const chunk = files.slice(i, i + chunkSize);
          const { error: removeError } = await supabase.storage.from(BUCKET).remove(chunk);
          if (removeError) throw removeError;
        }
      }
      safeSetState(setSelected, new Set());
      await fetchFolders();
    } catch (err) {
      const message = err?.message || "Failed to delete selected folders";
      safeSetState(setError, message);
    } finally {
      safeSetState(setDeleting, false);
    }
  }, [fetchFolders, listAllFiles, safeSetState, selected]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session) {
        if (!canceled) router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (profile?.role !== "ADMIN") {
        if (!canceled) router.replace("/dashboard");
        return;
      }
      if (!canceled) {
        safeSetState(setAllowed, true);
        await fetchFolders();
      }
    })().finally(() => {
      if (!canceled) safeSetState(setChecking, false);
    });
    return () => {
      canceled = true;
    };
  }, [fetchFolders, router, safeSetState]);

  if (checking) return <LoadingOverlay message="Checking admin permissions..." />;
  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-red-700">Storage Site Folders</h1>
          <p className="text-sm text-gray-600">
            Buckets paths in {BUCKET} with their matching site IDs (blank when no database record is found).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDeleteSelected}
            className="inline-flex items-center rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            disabled={!hasSelection || loading || deleting}
          >
            {deleting ? "Deleting..." : "Delete selected"}
          </button>
          {hasSelection && (
            <span className="text-xs text-gray-600">{selected.size} selected</span>
          )}
          <button
            type="button"
            onClick={fetchFolders}
            className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            disabled={loading || deleting}
          >
            {loading ? "Scanning..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded border px-4 py-2 text-sm"
            disabled={loading || deleting}
          >
            Back
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-4 grid gap-2 rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="block text-xs uppercase text-gray-500">Storage folders scanned</span>
          {stats.storageFolders}
        </div>
        <div>
          <span className="block text-xs uppercase text-gray-500">Matched in database</span>
          {stats.matched}
        </div>
        <div>
          <span className="block text-xs uppercase text-gray-500">Missing from database</span>
          {stats.missing}
        </div>
        <div>
          <span className="block text-xs uppercase text-gray-500">Total site records</span>
          {stats.totalSites}
        </div>
      </div>

      <div className="rounded border border-gray-200">
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-600">Scanning storage...</div>
        ) : sortedFolders.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="h-4 w-4"
                      checked={allDisplayedSelected}
                      onChange={toggleSelectAll}
                      disabled={sortedFolders.length === 0 || loading || deleting}
                    />
                  </th>
                  <th className="px-3 py-2" aria-sort={ariaSort("path")}>
                    <button
                      type="button"
                      onClick={() => handleSort("path")}
                      className={`${sortButtonClasses} ${sortClass("path")}`}
                    >
                      <span>Storage path</span>
                      <span className="text-[10px] leading-none">{sortIndicator("path")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2" aria-sort={ariaSort("folderName")}>
                    <button
                      type="button"
                      onClick={() => handleSort("folderName")}
                      className={`${sortButtonClasses} ${sortClass("folderName")}`}
                    >
                      <span>Folder name</span>
                      <span className="text-[10px] leading-none">{sortIndicator("folderName")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2" aria-sort={ariaSort("dbSiteId")}>
                    <button
                      type="button"
                      onClick={() => handleSort("dbSiteId")}
                      className={`${sortButtonClasses} ${sortClass("dbSiteId")}`}
                    >
                      <span>DB site ID</span>
                      <span className="text-[10px] leading-none">{sortIndicator("dbSiteId")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2" aria-sort={ariaSort("dbOwnerId")}>
                    <button
                      type="button"
                      onClick={() => handleSort("dbOwnerId")}
                      className={`${sortButtonClasses} ${sortClass("dbOwnerId")}`}
                    >
                      <span>DB owner ID</span>
                      <span className="text-[10px] leading-none">{sortIndicator("dbOwnerId")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2" aria-sort={ariaSort("status")}>
                    <button
                      type="button"
                      onClick={() => handleSort("status")}
                      className={`${sortButtonClasses} ${sortClass("status")}`}
                    >
                      <span>Status</span>
                      <span className="text-[10px] leading-none">{sortIndicator("status")}</span>
                    </button>
                  </th>
                  <th className="px-3 py-2" aria-sort={ariaSort("updatedAt")}>
                    <button
                      type="button"
                      onClick={() => handleSort("updatedAt")}
                      className={`${sortButtonClasses} ${sortClass("updatedAt")}`}
                    >
                      <span>Last modified</span>
                      <span className="text-[10px] leading-none">{sortIndicator("updatedAt")}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {sortedFolders.map((item) => (
                  <tr key={item.path}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selected.has(item.path)}
                        onChange={() => toggleSelect(item.path)}
                        disabled={loading || deleting}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{item.path}</td>
                    <td className="px-3 py-2 font-mono text-xs">{item.folderName}</td>
                    <td className="px-3 py-2 font-mono text-xs">{item.dbSiteId}</td>
                    <td className="px-3 py-2 font-mono text-xs">{item.dbOwnerId}</td>
                    <td className="px-3 py-2 text-xs">{item.status}</td>
                    <td className="px-3 py-2 text-xs">{formatDate(item.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-gray-600">No abandoned folders detected.</div>
        )}
      </div>
    </div>
  );
}
