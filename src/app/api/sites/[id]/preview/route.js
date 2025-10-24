import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const STATUS_APPROVED = "APPROVED";

function sanitizeSite(site, includeOwner) {
  if (!site) return null;
  const { owner, ...rest } = site;
  return includeOwner ? { owner, ...rest } : rest;
}

export async function GET(request, { params }) {
  try {
    const routeParams = await params;
    const rawId = Array.isArray(routeParams?.id) ? routeParams.id[0] : routeParams?.id;
    const id = rawId ?? "";
    if (!id) {
      return Response.json({ error: "missing_id" }, { status: 400 });
    }

    const { data: site, error } = await supabaseAdmin
      .from("sites")
      .select(
        "id, owner, status, title, description, slug, content_json, logo, hero, gallery"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("preview fetch failed", error);
      return Response.json({ error: "load_failed" }, { status: 500 });
    }

    if (!site) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const status = (site.status || "").toUpperCase();

    if (status === STATUS_APPROVED) {
      return Response.json({ site: sanitizeSite(site, false) });
    }

    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const token = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    if (userData.user.id !== site.owner) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    return Response.json({ site: sanitizeSite(site, true) });
  } catch (err) {
    console.error("preview endpoint error", err);
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
