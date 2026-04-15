import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
const SITE_ASSETS_BUCKET = "site-assets";

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

    const updatePayload = {};
    if (title !== undefined) updatePayload.title = title;
    if (slug !== undefined) updatePayload.slug = slug;
    if (description !== undefined) updatePayload.description = description;
    if (content_json !== undefined) updatePayload.content_json = content_json;
    if (logo !== undefined) updatePayload.logo = logo;
    if (hero !== undefined) updatePayload.hero = hero;
    if (gallery !== undefined) updatePayload.gallery = gallery;
    if (nearest_city !== undefined) updatePayload.nearest_city = nearest_city;
    if (status !== undefined) {
      updatePayload.status = status;
      updatePayload.approved_by = status === "APPROVED" ? admin.uid : null;
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
