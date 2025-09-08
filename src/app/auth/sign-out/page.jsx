"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SignOutPage() {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("Signing you out…");

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const { error } = await supabase.auth.signOut({ scope: "global" });
        if (error) throw error;
      } catch (_) {
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {}
      } finally {
        if (!canceled) {
          setDone(true);
          setMessage("Signed you out. Please log in.");
          setTimeout(() => {
            try { router.replace("/login"); } catch {}
          }, 1200);
        }
      }
    })();
    return () => { canceled = true; };
  }, [router]);

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-red-700">Sign out</h1>
      <div className="rounded border border-red-200 bg-red-50 p-3 text-red-800" aria-live="polite">
        {message}
      </div>
      {done && (
        <p className="mt-3 text-sm">
          <a className="text-red-700 underline" href="/login">Go to sign in</a>
        </p>
      )}
    </div>
  );
}

