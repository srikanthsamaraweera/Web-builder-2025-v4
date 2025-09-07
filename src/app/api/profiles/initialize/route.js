import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request) {
  try {
    const auth = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!auth?.toLowerCase().startsWith("bearer ")) {
      return Response.json({ error: "missing_token" }, { status: 401 });
    }
    const token = auth.slice(7);

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return Response.json({ error: "invalid_token" }, { status: 401 });
    }
    const userId = userData.user.id;

    const { data: existing, error: selErr } = await supabaseAdmin
      .from("profiles")
      .select("id, paid_until, plan_tier, site_limit")
      .eq("id", userId)
      .maybeSingle();
    if (selErr) throw selErr;

    // Only seed trial if no paid_until set yet
    if (!existing) {
      const trialUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error: insErr } = await supabaseAdmin.from("profiles").insert({
        id: userId,
        role: "USER",
        paid_until: trialUntil,
        plan_tier: "BASIC",
        site_limit: 5,
      });
      if (insErr) throw insErr;
      return Response.json({ initialized: true, paid_until: trialUntil });
    }

    if (!existing.paid_until) {
      const trialUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error: updErr } = await supabaseAdmin
        .from("profiles")
        .update({ paid_until: trialUntil })
        .eq("id", userId);
      if (updErr) throw updErr;
      return Response.json({ initialized: true, paid_until: trialUntil });
    }

    return Response.json({ initialized: false, paid_until: existing.paid_until });
  } catch (e) {
    return Response.json({ error: "init_failed" }, { status: 500 });
  }
}

