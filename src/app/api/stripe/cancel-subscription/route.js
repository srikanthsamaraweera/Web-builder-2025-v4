import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripeServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
}

function objectId(value) {
  return typeof value === "string" ? value : value?.id || null;
}

function paidPeriodEnd(subscription) {
  const ends = (subscription?.items?.data || [])
    .map((item) => item?.current_period_end)
    .filter(Number.isFinite);
  if (Number.isFinite(subscription?.current_period_end)) {
    ends.push(subscription.current_period_end);
  }
  return ends.length ? Math.max(...ends) : null;
}

export async function POST(request) {
  try {
    if (!stripe) {
      return Response.json({ error: "stripe_not_configured" }, { status: 503 });
    }

    const token = getBearerToken(request);
    if (!token) {
      return Response.json({ error: "missing_token" }, { status: 401 });
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      return Response.json({ error: "invalid_token" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.stripe_customer_id || !profile?.stripe_subscription_id) {
      return Response.json({ error: "subscription_not_found" }, { status: 404 });
    }

    const subscription = await stripe.subscriptions.retrieve(
      profile.stripe_subscription_id,
      { expand: ["items.data.price"] },
    );
    if (objectId(subscription.customer) !== profile.stripe_customer_id) {
      return Response.json({ error: "subscription_mismatch" }, { status: 403 });
    }
    if (["canceled", "incomplete_expired"].includes(subscription.status)) {
      return Response.json({ error: "subscription_not_active" }, { status: 409 });
    }

    const trialEnd = Number.isFinite(subscription.trial_end)
      ? subscription.trial_end
      : null;
    const isTrialing = subscription.status === "trialing" && trialEnd;
    const updated = await stripe.subscriptions.update(subscription.id, isTrialing
      ? { cancel_at: trialEnd }
      : { cancel_at_period_end: true });

    const cancellationTimestamp = isTrialing
      ? trialEnd
      : updated.cancel_at || paidPeriodEnd(updated);
    const cancellationDate = Number.isFinite(cancellationTimestamp)
      ? new Date(cancellationTimestamp * 1000).toISOString()
      : null;

    const profileUpdate = {
      cancel_at_period_end: Boolean(updated.cancel_at_period_end),
      subscription_cancel_at: cancellationDate,
      stripe_synced_at: new Date().toISOString(),
    };
    if (cancellationDate) profileUpdate.paid_until = cancellationDate;

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user.id);
    if (updateError) throw updateError;

    return Response.json({
      scheduled: true,
      cancellationDate,
      duringTrial: Boolean(isTrialing),
    });
  } catch (error) {
    if (error?.code === "resource_missing") {
      return Response.json({ error: "subscription_not_found" }, { status: 404 });
    }
    console.error("Failed to cancel Stripe subscription", error);
    return Response.json({ error: "subscription_cancellation_failed" }, { status: 500 });
  }
}
