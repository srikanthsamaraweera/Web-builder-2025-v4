import { supabaseAdmin } from "@/lib/supabaseAdmin";

function hasActivePublishing(profile) {
  if (String(profile?.role || "").trim().toUpperCase() === "ADMIN") {
    return true;
  }
  if (
    !["active", "trialing", "past_due"].includes(
      String(profile?.subscription_status || "").toLowerCase(),
    )
  ) {
    return false;
  }
  const paidUntil = new Date(profile?.paid_until || "").getTime();
  return Number.isFinite(paidUntil) && paidUntil > Date.now();
}

export async function POST(request, { params }) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.toLowerCase().startsWith("bearer ")
      ? authorization.slice(7)
      : "";
    if (!token) {
      return Response.json({ error: "sign_in_required" }, { status: 401 });
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      return Response.json({ error: "sign_in_required" }, { status: 401 });
    }

    const routeParams = await params;
    const rawId = Array.isArray(routeParams?.id)
      ? routeParams.id[0]
      : routeParams?.id;
    if (!rawId) {
      return Response.json({ error: "missing_site_id" }, { status: 400 });
    }

    const [{ data: profile, error: profileError }, { data: site, error: siteError }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("role, subscription_status, paid_until")
          .eq("id", user.id)
          .maybeSingle(),
        supabaseAdmin
          .from("sites")
          .select("id, owner, status")
          .eq("id", rawId)
          .maybeSingle(),
      ]);

    if (profileError || siteError) {
      console.error("directory listing request failed to load data", profileError || siteError);
      return Response.json({ error: "load_failed" }, { status: 500 });
    }
    if (!site || site.owner !== user.id) {
      return Response.json({ error: "site_not_found" }, { status: 404 });
    }
    if (!hasActivePublishing(profile)) {
      return Response.json({ error: "publishing_not_active" }, { status: 403 });
    }

    if (site.status === "APPROVED" || site.status === "SUBMITTED") {
      return Response.json({ status: site.status });
    }

    const { error: updateError } = await supabaseAdmin
      .from("sites")
      .update({ status: "SUBMITTED" })
      .eq("id", site.id)
      .eq("owner", user.id);

    if (updateError) {
      console.error("directory listing request failed to save", updateError);
      return Response.json({ error: "save_failed" }, { status: 500 });
    }

    return Response.json({ status: "SUBMITTED" });
  } catch (error) {
    console.error("directory listing request error", error);
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
