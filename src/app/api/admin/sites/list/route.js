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
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
    const status = (searchParams.get("status") || "").toUpperCase();
    const ownerEmail = searchParams.get("ownerEmail") || "";
    const start = searchParams.get("start") || "";
    const end = searchParams.get("end") || "";

    // Resolve owner email to owner IDs if provided
    let ownerIds = null;
    if (ownerEmail) {
      const { data: ownersByEmail } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", `%${ownerEmail}%`)
        .limit(200);
      ownerIds = (ownersByEmail || []).map((o) => o.id);
      if (ownerIds.length === 0) {
        return Response.json({ page, pageSize, total: 0, rows: [] });
      }
    }

    // Count
    let cq = supabaseAdmin.from("sites").select("id", { count: "exact", head: true });
    if (status && ["DRAFT","SUBMITTED","APPROVED","REJECTED"].includes(status)) cq = cq.eq("status", status);
    if (ownerIds) cq = cq.in("owner", ownerIds);
    if (start) cq = cq.gte("created_at", new Date(`${start}T00:00:00`).toISOString());
    if (end) cq = cq.lte("created_at", new Date(`${end}T23:59:59.999`).toISOString());
    const { count } = await cq;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let dq = supabaseAdmin
      .from("sites")
      .select("id, title, slug, created_at, owner, status")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (status && ["DRAFT","SUBMITTED","APPROVED","REJECTED"].includes(status)) dq = dq.eq("status", status);
    if (ownerIds) dq = dq.in("owner", ownerIds);
    if (start) dq = dq.gte("created_at", new Date(`${start}T00:00:00`).toISOString());
    if (end) dq = dq.lte("created_at", new Date(`${end}T23:59:59.999`).toISOString());
    const { data: rows, error } = await dq;
    if (error) throw error;

    // Enrich with owner email
    let enriched = rows || [];
    if (enriched.length > 0) {
      const ownerIds = Array.from(new Set(enriched.map((r) => r.owner).filter(Boolean)));
      if (ownerIds.length > 0) {
        // Prefer email from profiles
        const { data: profilesEmails } = await supabaseAdmin
          .from("profiles")
          .select("id, email")
          .in("id", ownerIds);
        const pmap = new Map((profilesEmails || []).map((p) => [p.id, p.email]));
        // Fallback to auth.users only for missing emails
        const missing = ownerIds.filter((id) => !pmap.get(id));
        let amap = new Map();
        if (missing.length > 0) {
          const { data: owners } = await supabaseAdmin
            .schema("auth")
            .from("users")
            .select("id, email")
            .in("id", missing);
          amap = new Map((owners || []).map((o) => [o.id, o.email]));
        }
        enriched = enriched.map((r) => ({
          ...r,
          owner_email: pmap.get(r.owner) || amap.get(r.owner) || null,
        }));
      }
    }

    return Response.json({ page, pageSize, total: count || 0, rows: enriched });
  } catch (e) {
    return Response.json({ error: "list_failed" }, { status: 500 });
  }
}
