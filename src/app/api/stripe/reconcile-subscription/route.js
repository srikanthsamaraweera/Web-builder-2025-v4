import { findSubscriptionPlanByPriceId } from "@/config/subscriptionPlans";
import { stripe } from "@/lib/stripeServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
}

function periodEndFor(subscription) {
  const values = (subscription?.items?.data || [])
    .map((item) => item.current_period_end)
    .filter(Number.isFinite);
  if (Number.isFinite(subscription?.trial_end)) values.push(subscription.trial_end);
  if (Number.isFinite(subscription?.current_period_end)) {
    values.push(subscription.current_period_end);
  }
  return values.length ? Math.max(...values) : null;
}

async function markDisconnected(profileId, { clearCustomer = false } = {}) {
  const update = {
    stripe_subscription_id: null,
    stripe_price_id: null,
    subscription_status: "canceled",
    plan_tier: null,
    site_limit: 0,
    paid_until: new Date().toISOString(),
    stripe_synced_at: new Date().toISOString(),
  };
  if (clearCustomer) update.stripe_customer_id = null;

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(update)
    .eq("id", profileId);
  if (error) throw error;
  return update;
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
      .select(
        "id, stripe_customer_id, stripe_subscription_id, subscription_status",
      )
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) {
      return Response.json({ error: "profile_not_found" }, { status: 404 });
    }
    if (!profile.stripe_customer_id) {
      return Response.json({ synchronized: true, status: profile.subscription_status });
    }

    try {
      const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
      if (customer.deleted) {
        const update = await markDisconnected(profile.id, { clearCustomer: true });
        return Response.json({ synchronized: true, status: update.subscription_status });
      }
    } catch (error) {
      if (error?.code === "resource_missing") {
        const update = await markDisconnected(profile.id, { clearCustomer: true });
        return Response.json({ synchronized: true, status: update.subscription_status });
      }
      throw error;
    }

    let subscription = null;
    if (profile.stripe_subscription_id) {
      try {
        subscription = await stripe.subscriptions.retrieve(
          profile.stripe_subscription_id,
          { expand: ["items.data.price"] },
        );
      } catch (error) {
        if (error?.code !== "resource_missing") throw error;
      }
    }

    if (!subscription) {
      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: "all",
        limit: 20,
      });
      subscription = subscriptions.data
        .filter((item) =>
          ["active", "trialing", "past_due", "unpaid", "paused"].includes(
            item.status,
          ),
        )
        .sort((left, right) => right.created - left.created)[0];
    }

    if (!subscription) {
      const update = await markDisconnected(profile.id);
      return Response.json({ synchronized: true, status: update.subscription_status });
    }

    if (["canceled", "incomplete_expired"].includes(subscription.status)) {
      const update = await markDisconnected(profile.id);
      return Response.json({ synchronized: true, status: update.subscription_status });
    }

    const priceId = subscription.items?.data?.[0]?.price?.id;
    const plan = findSubscriptionPlanByPriceId(priceId);
    if (!plan) {
      return Response.json({ error: "unrecognized_subscription_price" }, { status: 409 });
    }

    const update = {
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      subscription_status: subscription.status,
      plan_tier: plan.key,
      site_limit: plan.siteLimit,
      stripe_synced_at: new Date().toISOString(),
    };
    const periodEnd = periodEndFor(subscription);
    if (periodEnd) update.paid_until = new Date(periodEnd * 1000).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(update)
      .eq("id", profile.id);
    if (updateError) throw updateError;

    return Response.json({ synchronized: true, status: subscription.status });
  } catch (error) {
    console.error("Failed to reconcile Stripe subscription", error);
    return Response.json({ error: "subscription_reconciliation_failed" }, { status: 500 });
  }
}
