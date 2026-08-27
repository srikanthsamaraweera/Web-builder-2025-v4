"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function SubscriptionSuccessActions() {
  const [hasSession, setHasSession] = useState(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession(Boolean(data.session));
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active) setHasSession(Boolean(session));
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (hasSession === null) {
    return (
      <p className="mt-8 text-sm text-gray-500" role="status">
        Checking your sign-in session…
      </p>
    );
  }

  if (hasSession) {
    return (
      <div className="mt-8 flex justify-center">
        <Link
          href="/dashboard/home"
          className="rounded bg-[#BF283B] px-5 py-2.5 font-medium text-white hover:bg-[#a32131]"
        >
          Go to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <p className="mb-4 text-sm text-gray-600">
        Your subscription is confirmed. Please sign in again to open your
        dashboard.
      </p>
      <Link
        href="/login?next=%2Fdashboard%2Fhome&subscription=success"
        className="inline-block rounded bg-[#BF283B] px-5 py-2.5 font-medium text-white hover:bg-[#a32131]"
      >
        Sign in to dashboard
      </Link>
    </div>
  );
}
