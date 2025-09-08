"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AdminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (prof?.role !== "ADMIN") {
        router.replace("/dashboard");
        return;
      }
      setAllowed(true);
      // Load count of submitted sites
      const { count } = await supabase
        .from("sites")
        .select("id", { count: "exact", head: true })
        .eq("status", "SUBMITTED");
      setPendingCount(count || 0);
      setChecking(false);
    })();
  }, [router]);

  if (checking) return null;
  if (!allowed) return null;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-red-700 mb-3">Admin panel</h1>
      <div className="space-y-3">
        <p className="text-gray-700">Admin only</p>
        <a
          href="/admin/sites"
          className="inline-flex items-center rounded bg-red-600 text-white px-4 py-2 font-medium hover:bg-red-700"
        >
          Review submissions{pendingCount ? ` (${pendingCount})` : ""}
        </a>
      </div>
    </div>
  );
}

