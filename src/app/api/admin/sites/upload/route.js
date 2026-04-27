import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const SITE_ASSETS_BUCKET = "site-assets";
const ALLOWED_KINDS = new Set(["logo", "hero", "gallery"]);
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const SITE_ID_RE = /^[a-zA-Z0-9_-]{1,100}$/;

function isValidSiteId(value) {
  return typeof value === "string" && SITE_ID_RE.test(value);
}

function safeFileName(value) {
  const name = String(value || "upload")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120);

  return name || "upload";
}

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

    if (!isValidSiteId(id)) {
      return Response.json({ error: "invalid_id" }, { status: 400 });
    }
    if (!ALLOWED_KINDS.has(kind)) {
      return Response.json({ error: "invalid_kind" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return Response.json({ error: "missing_file" }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return Response.json({ error: "invalid_file_type" }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return Response.json({ error: "invalid_file_size" }, { status: 400 });
    }

    const { data: site, error: siteError } = await supabaseAdmin
      .from("sites")
      .select("id, owner")
      .eq("id", id)
      .single();
    if (siteError || !site) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const safeName = safeFileName(file.name);
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
