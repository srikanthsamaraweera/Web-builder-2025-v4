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
    const userEmail = userData.user.email || null;

    const { data: existing, error: selErr } = await supabaseAdmin
      .from("profiles")
      .select("id, paid_until, plan_tier, site_limit, email")
      .eq("id", userId)
      .maybeSingle();
    if (selErr) throw selErr;

    // Seed or update
    const trialUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    if (!existing) {
      const payload = {
        id: userId,
        role: "USER",
        paid_until: trialUntil,
        plan_tier: "BASIC",
        site_limit: 5,
        email: userEmail,
      };
      const { error: insErr } = await supabaseAdmin.from("profiles").insert(payload);
      if (insErr) throw insErr;
      return Response.json({ initialized: true, paid_until: trialUntil, email: userEmail });
    }

    const update = {};
    if (!existing.paid_until) update.paid_until = trialUntil;
    if (userEmail && existing.email !== userEmail) update.email = userEmail;

    if (Object.keys(update).length > 0) {
      const { error: updErr } = await supabaseAdmin
        .from("profiles")
        .update(update)
        .eq("id", userId);
      if (updErr) throw updErr;
      return Response.json({ initialized: true, paid_until: update.paid_until || existing.paid_until, email: update.email || existing.email });
    }

    return Response.json({ initialized: false, paid_until: existing.paid_until, email: existing.email });
  } catch (e) {
    return Response.json({ error: "init_failed" }, { status: 500 });
  }
}

