import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripeServer";
import { getSubscriptionPlan } from "@/config/subscriptionPlans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
]);

function getBearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
}

function getAppUrl(request) {
  const configuredUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  const candidate = configuredUrl || request.nextUrl.origin;
  const url = new URL(candidate);
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error("invalid_app_url");
  }
  return url.origin;
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

    const body = await request.json().catch(() => ({}));
    const requestedPlanKey = body?.plan || "BASIC";
    const selectedPlan = getSubscriptionPlan(requestedPlanKey);
    if (!selectedPlan) {
      return Response.json({ error: "invalid_or_unavailable_plan" }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, email, stripe_customer_id, stripe_subscription_id, subscription_status",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return Response.json({ error: "profile_not_found" }, { status: 404 });
    }

    if (
      profile.stripe_subscription_id &&
      ACTIVE_SUBSCRIPTION_STATUSES.has(profile.subscription_status)
    ) {
      return Response.json(
        { error: "subscription_already_exists" },
        { status: 409 },
      );
    }

    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || profile.email || undefined,
        metadata: {
          supabaseUserId: user.id,
        },
      });
      customerId = customer.id;

      const { error: customerSaveError } = await supabaseAdmin
        .from("profiles")
        .update({
          stripe_customer_id: customerId,
          stripe_synced_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (customerSaveError) throw customerSaveError;
    }

    const appUrl = getAppUrl(request);
    const subscriptionData = {
      metadata: {
        supabaseUserId: user.id,
        planTier: selectedPlan.key,
      },
    };
    if (selectedPlan.trialDays > 0) {
      subscriptionData.trial_period_days = selectedPlan.trialDays;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: selectedPlan.priceId, quantity: 1 }],
      metadata: {
        supabaseUserId: user.id,
        planTier: selectedPlan.key,
      },
      subscription_data: subscriptionData,
      success_url: `${appUrl}/dashboard/home?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/home?checkout=cancelled`,
    });

    if (!session.url) {
      throw new Error("checkout_url_missing");
    }

    return Response.json({
      url: session.url,
      plan: selectedPlan.key,
    });
  } catch (error) {
    console.error("Failed to create Stripe Checkout Session", error);
    return Response.json({ error: "checkout_session_failed" }, { status: 500 });
  }
}
