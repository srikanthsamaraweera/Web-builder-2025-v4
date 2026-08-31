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
  const url = new URL(configuredUrl || request.nextUrl.origin);
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

    let customerId = profile.stripe_customer_id;
    if (customerId) {
      try {
        const existingCustomer = await stripe.customers.retrieve(customerId);
        if (existingCustomer.deleted) customerId = null;
      } catch (error) {
        if (error?.code === "resource_missing") {
          customerId = null;
        } else {
          throw error;
        }
      }
    }

    if (!customerId) {
      const matchingCustomers = await stripe.customers.search({
        query: `metadata['supabaseUserId']:'${user.id}'`,
        limit: 10,
      });
      const existingCustomer = matchingCustomers.data
        .filter((customer) => !customer.deleted)
        .sort((left, right) => right.created - left.created)[0];
      const customer = existingCustomer || await stripe.customers.create({
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
          stripe_subscription_id: null,
          stripe_price_id: null,
          subscription_status: null,
          cancel_at_period_end: false,
          subscription_cancel_at: null,
          stripe_synced_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (customerSaveError) throw customerSaveError;
    }

    const customerSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });
    const activeSubscription = customerSubscriptions.data.find((subscription) =>
      ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status),
    );
    if (activeSubscription) {
      const { error: syncError } = await supabaseAdmin
        .from("profiles")
        .update({
          stripe_subscription_id: activeSubscription.id,
          subscription_status: activeSubscription.status,
          stripe_synced_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (syncError) throw syncError;

      return Response.json(
        { error: "subscription_already_exists" },
        { status: 409 },
      );
    }

    if (profile.stripe_subscription_id || profile.subscription_status) {
      const { error: clearError } = await supabaseAdmin
        .from("profiles")
        .update({
          stripe_subscription_id: null,
          stripe_price_id: null,
          subscription_status: "canceled",
          cancel_at_period_end: false,
          subscription_cancel_at: null,
          site_limit: 0,
          paid_until: new Date().toISOString(),
          stripe_synced_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (clearError) throw clearError;
    }

    const appUrl = getAppUrl(request);
    const subscriptionData = {
      metadata: {
        supabaseUserId: user.id,
        planTier: selectedPlan.key,
      },
    };
    const hasPreviousSubscription = customerSubscriptions.data.length > 0;
    if (selectedPlan.trialDays > 0 && !hasPreviousSubscription) {
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
      success_url: `${appUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
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
