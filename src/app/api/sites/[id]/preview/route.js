import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

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

    let ownerProfile = null;
    let ownerActive = false;
    let unavailableReason = "publishing_inactive";

    if (site.owner) {
      const { data: ownerData, error: ownerErr } = await supabaseAdmin
        .from("profiles")
        .select("id, paid_until, subscription_status, role, trial_used_at")
        .eq("id", site.owner)
        .maybeSingle();

      if (ownerErr) {
        console.error("preview owner profile fetch failed", ownerErr);
      } else if (ownerData) {
        ownerProfile = {
          id: ownerData.id ?? null,
          paid_until: ownerData.paid_until ?? null,
          trial_used_at: ownerData.trial_used_at ?? null,
        };
        ownerActive =
          String(ownerData.role || "").trim().toUpperCase() === "ADMIN" ||
          (["active", "trialing", "past_due"].includes(
            String(ownerData.subscription_status || "").toLowerCase(),
          ) && isPaidUntilActive(ownerData.paid_until));
        unavailableReason =
          !ownerData.subscription_status && !ownerData.trial_used_at
            ? "publishing_not_started"
            : "publishing_inactive";
      }
    }

    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const token = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : null;
    let isSiteOwner = false;

    if (token && site.owner) {
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
      isSiteOwner = !userErr && userData?.user?.id === site.owner;
    }

    if (ownerActive) {
      return Response.json({
        site: sanitizeSite(site, isSiteOwner),
        ownerActive,
        ownerProfile: isSiteOwner ? ownerProfile : null,
        isSiteOwner,
      });
    }

    if (!token || !isSiteOwner) {
      return Response.json(
        { error: "forbidden", reason: unavailableReason },
        { status: 403 },
      );
    }

    return Response.json({
      site: sanitizeSite(site, true),
      ownerProfile,
      ownerActive,
      isSiteOwner,
    });
  } catch (err) {
    console.error("preview endpoint error", err);
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
