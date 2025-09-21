"use client";

export const dynamic = "force-static";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import LoadingOverlay from "@/components/LoadingOverlay";

export default function AdminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

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
        </div>
      </div>
    </div>
  );
}
