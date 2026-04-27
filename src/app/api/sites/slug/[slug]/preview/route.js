import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const STATUS_APPROVED = "APPROVED";

function sanitizeSite(site, includeOwner) {
  if (!site) return null;
  const { owner, ...rest } = site;
  return includeOwner ? { owner, ...rest } : rest;
}

function isPaidUntilActive(value) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now();
}

export async function GET(request, { params }) {
  try {
    const routeParams = await params;
    const rawSlug = Array.isArray(routeParams?.slug) ? routeParams.slug[0] : routeParams?.slug;
    const slug = (rawSlug || "").trim();
    if (!slug) {
      return Response.json({ error: "missing_slug" }, { status: 400 });
    }

    const { data: site, error } = await supabaseAdmin
      .from("sites")
      .select(
        "id, owner, status, title, description, slug, content_json, logo, hero, gallery"
      )
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error("preview fetch failed", error);
      return Response.json({ error: "load_failed" }, { status: 500 });
    }

    if (!site) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const status = (site.status || "").toUpperCase();
    let ownerProfile = null;
    let ownerActive = false;

    if (site.owner) {
      const { data: ownerData, error: ownerErr } = await supabaseAdmin
        .from("profiles")
        .select("id, paid_until")
        .eq("id", site.owner)
        .maybeSingle();

      if (ownerErr) {
        console.error("preview owner profile fetch failed", ownerErr);
      } else if (ownerData) {
        ownerProfile = {
          id: ownerData.id ?? null,
          paid_until: ownerData.paid_until ?? null,
        };
        ownerActive = isPaidUntilActive(ownerData.paid_until);
      }
    }

    if (status === STATUS_APPROVED) {
      return Response.json({
        site: sanitizeSite(site, false),
        ownerActive,
      });
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

    return Response.json({
      site: sanitizeSite(site, true),
      ownerProfile,
      ownerActive,
    });
  } catch (err) {
    console.error("preview slug endpoint error", err);
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}

