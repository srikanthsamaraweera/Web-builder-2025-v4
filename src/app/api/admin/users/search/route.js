import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

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
    const admin = await requireAdmin(request);
    if (!admin.ok) return Response.json({ error: "forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim();
    if (!email) {
      return Response.json({ users: [] }, { status: 200 });
    }

    // Use service role to look up users by email (partial, case-insensitive)
    const { data, error } = await supabaseAdmin
      .schema("auth")
      .from("users")
      .select("id, email")
      .ilike("email", `%${email}%`)
      .limit(20);
    if (error) throw error;
    return Response.json({ users: data ?? [] });
  } catch (e) {
    return Response.json({ users: [], error: "search_failed" }, { status: 500 });
  }
}
