import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireAdmin(request) {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) return { ok: false };
  const token = auth.slice(7);
  const { data: udata, error: uerr } = await supabaseAdmin.auth.getUser(token);
  if (uerr || !udata?.user) return { ok: false };
  const uid = udata.user.id;
  const { data: prof } = await supabaseAdmin.from("profiles").select("role").eq("id", uid).single();
  if ((prof?.role || "USER") !== "ADMIN") return { ok: false };
  return { ok: true };
}

export async function GET(request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Supabase admin client is not configured" },
        { status: 500 }
      );
    }

    const admin = await requireAdmin(request);
    if (!admin.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("sites")
      .select("id, owner");

    if (error) {
      console.error("Failed to fetch site ids", error);
      return NextResponse.json({ error: "site_ids_failed" }, { status: 500 });
    }

    return NextResponse.json({ sites: data ?? [] });
  } catch (err) {
    console.error("Unexpected error fetching site ids", err);
    return NextResponse.json(
      { error: "Unexpected error fetching site ids" },
      { status: 500 }
    );
  }
}
