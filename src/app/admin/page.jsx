"use client";

export const dynamic = "force-static";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import LoadingOverlay from "@/components/LoadingOverlay";
import { getTimestampSuffix } from "@/lib/backupUtils";

const triggerFileDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const parseFilenameFromDisposition = (value) => {
  if (!value || typeof value !== "string") return null;
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(value);
  if (match) {
    const encoded = match[1];
    if (encoded) {
      try {
        return decodeURIComponent(encoded);
      } catch (error) {
        console.warn("Failed to decode filename from content disposition", error);
      }
    }
    if (match[2]) return match[2];
  }
  return null;
};

export default function AdminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [backingUp, setBackingUp] = useState(false);
  const [backupStatus, setBackupStatus] = useState("");
  const [backupError, setBackupError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (prof?.role !== "ADMIN") {
        router.replace("/dashboard");
        return;
      }
      setAllowed(true);
      const { count } = await supabase
        .from("sites")
        .select("id", { count: "exact", head: true })
        .eq("status", "SUBMITTED");
      setPendingCount(count || 0);
      setChecking(false);
    })();
  }, [router]);

  const handleBackup = useCallback(async () => {
    if (backingUp) return;
    setBackingUp(true);
    setBackupError("");
    setBackupStatus("Requesting backup...");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) {
        throw new Error("Unable to verify your session. Please refresh and sign in again.");
      }

      const response = await fetch("/api/admin/backup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const payload = await response.json();
          const message = typeof payload?.error === "string" ? payload.error : "Backup failed.";
          throw new Error(message);
        }
        const text = await response.text();
        throw new Error(text || "Backup failed.");
      }

      setBackupStatus("Preparing download...");
      const blob = await response.blob();
      let filename = parseFilenameFromDisposition(response.headers.get("content-disposition"));
      if (!filename) {
        filename = `site-backup-${getTimestampSuffix(new Date())}.zip`;
      }
      triggerFileDownload(blob, filename);
      setBackupStatus(`Backup ready. Download should start automatically (${filename}).`);
    } catch (error) {
      console.error("Backup failed", error);
      setBackupError(error.message || "Backup failed. See console for details.");
      setBackupStatus("");
    } finally {
      setBackingUp(false);
    }
  }, [backingUp]);

  if (checking) return <LoadingOverlay message="Loading admin panel..." />;
  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-7 flex items-center justify-center gap-2">
        <h1 className="text-2xl font-bold text-red-700">Admin panel</h1>
        <p className="rounded-md border border-blue-500 bg-blue-100 px-2 py-1 text-sm font-medium text-blue-500">
          Admin only
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href="/admin/sites"
            className="inline-flex items-center justify-center rounded bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
          >
            Review submissions{pendingCount ? ` (${pendingCount})` : ""}
          </a>

          <a
            href="/admin/abandoned-folders"
            className="inline-flex items-center justify-center rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-100"
          >
            Abandoned folders
          </a>

          <button
            type="button"
            onClick={handleBackup}
            disabled={backingUp}
            className="inline-flex items-center justify-center rounded border border-gray-300 px-4 py-2 font-medium text-white hover:bg-red-700 bg-red-600 disabled:cursor-not-allowed disabled:opacity-80"
          >
            {backingUp ? "Preparing backup..." : "Backup Site Data"}
          </button>

          {(backupStatus || backupError) && (
            <div className="sm:col-span-2 space-y-1">
              {backupStatus && (
                <p className="text-sm text-gray-600" aria-live="polite">{backupStatus}</p>
              )}
              {backupError && (
                <p className="text-sm text-red-600" aria-live="polite">{backupError}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
