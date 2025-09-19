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
    <div className="max-w-3xl mx-auto">
      <div className="flex gap-0.5 flex-row justify-center items-center mb-7">
<h1 className="text-2xl font-bold text-red-700">Admin panel</h1>
 <p className=" bg-blue-100 inline-block rounded-md border-blue-500 border-[1px] text-blue-500 pl-1 pr-1 pt-0.5 pb-0.5">Admin only</p>
      </div>
      
      <div className="space-y-3">
       
        <div className="grid grid-cols-2 justify-items-center content-center items-center w-auto">
 <div>
  <a
          href="/admin/sites"
          className="inline-flex items-center rounded bg-red-600 text-white px-4 py-2 font-medium hover:bg-red-700"
        >
          Review submissions{pendingCount ? ` (${pendingCount})` : ""}
        </a>
        </div>
      <div>
 <a
          href="/admin/redundant-images"
          className="inline-flex items-center rounded border border-red-300 text-red-700 px-4 py-2 font-medium hover:bg-red-50"
        >
          Redundant images
        </a>
      </div>
        </div>
       
       
      </div>
    </div>
  );
}

