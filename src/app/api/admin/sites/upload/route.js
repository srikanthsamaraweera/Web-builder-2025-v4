import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const SITE_ASSETS_BUCKET = "site-assets";
const ALLOWED_KINDS = new Set(["logo", "hero", "gallery"]);

async function requireAdmin(request) {
  const auth =
    request.headers.get("authorization") || request.headers.get("Authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) return { ok: false };
  const token = auth.slice(7);
  const { data: udata, error: uerr } = await supabaseAdmin.auth.getUser(token);
  if (uerr || !udata?.user) return { ok: false };
  const uid = udata.user.id;
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .single();
  if ((prof?.role || "USER") !== "ADMIN") return { ok: false };
  return { ok: true, uid };
}

export async function POST(request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return Response.json({ error: "forbidden" }, { status: 403 });

    const form = await request.formData();
    const id = String(form.get("id") || "");
    const kind = String(form.get("kind") || "");
    const file = form.get("file");

    if (!id || !ALLOWED_KINDS.has(kind) || !(file instanceof File)) {
      return Response.json({ error: "invalid_params" }, { status: 400 });
    }

    const { data: site, error: siteError } = await supabaseAdmin
      .from("sites")
      .select("id, owner")
      .eq("id", id)
      .single();
    if (siteError || !site) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const safeName = (file.name || "upload")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${site.owner}/${site.id}/${kind}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(SITE_ASSETS_BUCKET)
      .upload(path, file, {
        cacheControl: "31536000",
        upsert: false,
        contentType: file.type || undefined,
      });
    if (uploadError) throw uploadError;

    return Response.json({ ok: true, path });
  } catch (e) {
    return Response.json({ error: "upload_failed" }, { status: 500 });
  }
}
