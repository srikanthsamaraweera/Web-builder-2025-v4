"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import ChangePasswordCard from "@/components/ChangePasswordCard";
import Modal from "@/components/Modal";

export default function DashboardPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [openSecurity, setOpenSecurity] = useState(false);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-red-700">Dashboard</h1>
          <p className="text-gray-700">You are logged in. This is the dashboard.</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/sites/new"
            className="rounded bg-red-600 text-white px-4 py-2 font-medium hover:bg-red-700"
          >
            Create Site
          </a>
          <button
          onClick={() => setOpenSecurity(true)}
          className="rounded bg-red-600 text-white px-4 py-2 font-medium hover:bg-red-700"
        >
          Security
          </button>
        </div>
      </div>

      <Modal
        open={openSecurity}
        onClose={() => setOpenSecurity(false)}
        title="Security"
      >
        <ChangePasswordCard />
      </Modal>
    </div>
  );
}
