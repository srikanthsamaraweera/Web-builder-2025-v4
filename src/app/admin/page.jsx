"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AdminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

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
      setChecking(false);
    })();
  }, [router]);

  if (checking) return null;
  if (!allowed) return null;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-red-700 mb-3">Admin panel</h1>
      <p className="text-gray-700">Admin only</p>
    </div>
  );
}

