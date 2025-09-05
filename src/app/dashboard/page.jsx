"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        router.replace("/login");
      } else {
        setChecking(false);
      }
    })();
  }, [router]);

  if (checking) return null;

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-red-700">Dashboard</h1>
      <p className="text-gray-700">You are logged in. This is the dashboard.</p>
    </div>
  );
}

