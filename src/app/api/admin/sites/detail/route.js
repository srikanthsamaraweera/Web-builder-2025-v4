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
  return { ok: true, uid };
}

export async function GET(request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return Response.json({ error: "forbidden" }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "missing_id" }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("sites").select("*").eq("id", id).single();
    if (error) throw error;
    return Response.json({ site: data });
  } catch (e) {
    return Response.json({ error: "get_failed" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return Response.json({ error: "forbidden" }, { status: 403 });
    const body = await request.json();
    const { id, status, comment } = body || {};
    if (!id || !status) return Response.json({ error: "missing_params" }, { status: 400 });
    // Fetch current content_json
    const { data: row } = await supabaseAdmin.from("sites").select("content_json").eq("id", id).single();
    const current = row?.content_json || {};
    const newContent = {
      ...current,
      moderation_comment: status === "REJECTED" ? (comment || "") : null,
    };
    const { error } = await supabaseAdmin
      .from("sites")
      .update({
        status,
        approved_by: status === "APPROVED" ? admin.uid : null,
        content_json: newContent,
      })
      .eq("id", id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: "update_failed" }, { status: 500 });
  }
}
