import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
const SITE_ASSETS_BUCKET = "site-assets";
const ALLOWED_STATUSES = new Set(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]);
const SITE_ID_RE = /^[a-zA-Z0-9_-]{1,100}$/;
const SLUG_RE = /^[a-z0-9-]{3,30}$/;
const ASSET_PATH_RE = /^[a-zA-Z0-9/_.,-]+$/;
const MAX_CONTENT_JSON_BYTES = 50000;

function isValidSiteId(value) {
  return typeof value === "string" && SITE_ID_RE.test(value);
}

function cleanOptionalString(value, maxLength) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (trimmed.length > maxLength) return undefined;
  return trimmed;
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isValidContentJson(value) {
  if (!isPlainObject(value)) return false;

  try {
    return JSON.stringify(value).length <= MAX_CONTENT_JSON_BYTES;
  } catch {
    return false;
  }
}

function isValidAssetPath(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 500 &&
    !value.includes("..") &&
    !value.startsWith("/") &&
    !value.endsWith("/") &&
    ASSET_PATH_RE.test(value)
  );
}

function isValidAssetList(value) {
  return Array.isArray(value) && value.length <= 20 && value.every(isValidAssetPath);
}

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
    if (!isValidSiteId(id)) return Response.json({ error: "invalid_id" }, { status: 400 });
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
    if (!isValidSiteId(id)) return Response.json({ error: "invalid_id" }, { status: 400 });
    if (!ALLOWED_STATUSES.has(status)) {
      return Response.json({ error: "invalid_status" }, { status: 400 });
    }

    const moderationComment = cleanOptionalString(comment ?? "", 2000);
    if (moderationComment === undefined) {
      return Response.json({ error: "invalid_comment" }, { status: 400 });
    }

    // Fetch current content_json
    const { data: row } = await supabaseAdmin.from("sites").select("content_json").eq("id", id).single();
    const current = row?.content_json || {};
    const newContent = {
      ...current,
      moderation_comment: status === "REJECTED" ? moderationComment : null,
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

export async function PUT(request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return Response.json({ error: "forbidden" }, { status: 403 });

    const body = await request.json();
    const {
      id,
      title,
      slug,
      description,
      content_json,
      status,
      logo,
      hero,
      gallery,
      nearest_city,
    } = body || {};

    if (!id) return Response.json({ error: "missing_id" }, { status: 400 });
    if (!isValidSiteId(id)) return Response.json({ error: "invalid_id" }, { status: 400 });

    const updatePayload = {};
    if (title !== undefined) {
      const value = cleanOptionalString(title, 120);
      if (value === undefined || value.length < 3) {
        return Response.json({ error: "invalid_title" }, { status: 400 });
      }
      updatePayload.title = value;
    }
    if (slug !== undefined) {
      const value = cleanOptionalString(slug, 30);
      if (value === undefined || !SLUG_RE.test(value)) {
        return Response.json({ error: "invalid_slug" }, { status: 400 });
      }
      updatePayload.slug = value;
    }
    if (description !== undefined) {
      const value = cleanOptionalString(description, 2000);
      if (value === undefined) {
        return Response.json({ error: "invalid_description" }, { status: 400 });
      }
      updatePayload.description = value;
    }
    if (content_json !== undefined) {
      if (!isValidContentJson(content_json)) {
        return Response.json({ error: "invalid_content_json" }, { status: 400 });
      }
      updatePayload.content_json = content_json;
    }
    if (logo !== undefined) {
      if (logo !== null && !isValidAssetPath(logo)) {
        return Response.json({ error: "invalid_logo" }, { status: 400 });
      }
      updatePayload.logo = logo;
    }
    if (hero !== undefined) {
      if (!isValidAssetList(hero)) {
        return Response.json({ error: "invalid_hero" }, { status: 400 });
      }
      updatePayload.hero = hero;
    }
    if (gallery !== undefined) {
      if (!isValidAssetList(gallery)) {
        return Response.json({ error: "invalid_gallery" }, { status: 400 });
      }
      updatePayload.gallery = gallery;
    }
    if (nearest_city !== undefined) {
      const value = cleanOptionalString(nearest_city, 120);
      if (value === undefined) {
        return Response.json({ error: "invalid_nearest_city" }, { status: 400 });
      }
      updatePayload.nearest_city = value;
    }
    if (status !== undefined) {
      if (!ALLOWED_STATUSES.has(status)) {
        return Response.json({ error: "invalid_status" }, { status: 400 });
      }
      updatePayload.status = status;
      updatePayload.approved_by = status === "APPROVED" ? admin.uid : null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return Response.json({ error: "empty_update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("sites")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    return Response.json({ ok: true, site: data });
  } catch (e) {
    return Response.json({ error: "update_failed" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return Response.json({ error: "forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "missing_id" }, { status: 400 });
    if (!isValidSiteId(id)) return Response.json({ error: "invalid_id" }, { status: 400 });

    const { data: site, error: siteError } = await supabaseAdmin
      .from("sites")
      .select("id, logo, hero, gallery")
      .eq("id", id)
      .single();
    if (siteError || !site) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const assetPaths = [
      site.logo,
      ...(Array.isArray(site.hero) ? site.hero : []),
      ...(Array.isArray(site.gallery) ? site.gallery : []),
    ].filter(Boolean);

    const { error: deleteError } = await supabaseAdmin
      .from("sites")
      .delete()
      .eq("id", id);
    if (deleteError) throw deleteError;

    if (assetPaths.length > 0) {
      try {
        await supabaseAdmin.storage.from(SITE_ASSETS_BUCKET).remove(assetPaths);
      } catch {}
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: "delete_failed" }, { status: 500 });
  }
}
