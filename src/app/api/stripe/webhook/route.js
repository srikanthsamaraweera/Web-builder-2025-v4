import { findSubscriptionPlanByPriceId } from "@/config/subscriptionPlans";
import { stripe } from "@/lib/stripeServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function objectId(value) {
  if (typeof value === "string") return value;
  return value?.id || null;
}

function unixDate(value) {
  return Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

function getSubscriptionPeriodEnd(subscription) {
  if (
    subscription?.status === "trialing" &&
    Number.isFinite(subscription?.trial_end)
  ) {
    return subscription.trial_end;
  }
  const itemPeriodEnds = (subscription?.items?.data || [])
    .map((item) => item?.current_period_end)
    .filter(Number.isFinite);
  const candidates = [
    ...itemPeriodEnds,
    subscription?.current_period_end,
  ].filter(Number.isFinite);
  return candidates.length ? Math.max(...candidates) : null;
}

function getSubscriptionPriceId(subscription) {
  return objectId(subscription?.items?.data?.[0]?.price);
}

function canceledAt(subscription) {
  const timestamp = Number.isFinite(subscription?.ended_at)
    ? subscription.ended_at
    : Number.isFinite(subscription?.canceled_at)
      ? subscription.canceled_at
      : Math.floor(Date.now() / 1000);
  return unixDate(timestamp);
}

function getInvoiceSubscriptionId(invoice) {
  return (
    objectId(invoice?.subscription) ||
    objectId(invoice?.parent?.subscription_details?.subscription) ||
    null
  );
}

function getInvoicePaymentIntentId(invoice) {
  const legacyPaymentIntent = objectId(invoice?.payment_intent);
  if (legacyPaymentIntent) return legacyPaymentIntent;

  const payment = invoice?.payments?.data?.[0]?.payment;
  return payment?.type === "payment_intent"
    ? objectId(payment.payment_intent)
    : null;
}

function getInvoicePeriod(invoice) {
  const periods = (invoice?.lines?.data || [])
    .map((line) => line?.period)
    .filter(
      (period) =>
        Number.isFinite(period?.start) && Number.isFinite(period?.end),
    );
  if (!periods.length) return { start: null, end: null };
  return {
    start: Math.min(...periods.map((period) => period.start)),
    end: Math.max(...periods.map((period) => period.end)),
  };
}

async function findProfile({ userId, customerId }) {
  if (userId) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, stripe_customer_id, stripe_subscription_id")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (customerId) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, stripe_customer_id, stripe_subscription_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  return null;
}

async function handleDeletedCustomer(customer) {
  const customerId = objectId(customer);
  if (!customerId) return;

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
      subscription_status: "canceled",
      cancel_at_period_end: false,
      subscription_cancel_at: null,
      site_limit: 0,
      paid_until: new Date().toISOString(),
      stripe_synced_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);
  if (error) throw error;
}

async function syncSubscription(subscription, fallbackUserId = null) {
  const customerId = objectId(subscription?.customer);
  const subscriptionId = objectId(subscription);
  const userId = subscription?.metadata?.supabaseUserId || fallbackUserId;
  const profile = await findProfile({ userId, customerId });

  if (!profile) {
    console.warn("Stripe subscription has no matching profile", {
      subscriptionId,
      customerId,
    });
    return null;
  }

  if (
    profile.stripe_subscription_id &&
    profile.stripe_subscription_id !== subscriptionId &&
    ["canceled", "incomplete_expired"].includes(subscription?.status)
  ) {
    return profile;
  }

  if (["canceled", "incomplete_expired"].includes(subscription?.status)) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        stripe_customer_id: customerId || profile.stripe_customer_id,
        stripe_subscription_id: null,
        stripe_price_id: null,
        subscription_status: subscription.status,
        cancel_at_period_end: false,
        subscription_cancel_at: null,
        site_limit: 0,
        paid_until: canceledAt(subscription),
        stripe_synced_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
    if (error) throw error;
    return profile;
  }

  const priceId = getSubscriptionPriceId(subscription);
  const plan = findSubscriptionPlanByPriceId(priceId);
  if (!plan) {
    console.warn("Stripe subscription uses an unrecognized Price", {
      subscriptionId,
      priceId,
    });
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        stripe_customer_id: customerId || profile.stripe_customer_id,
        stripe_subscription_id: subscriptionId,
        stripe_price_id: priceId,
        subscription_status: "unsupported_price",
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        subscription_cancel_at: unixDate(subscription.cancel_at),
        site_limit: 0,
        paid_until: new Date().toISOString(),
        stripe_synced_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
    if (error) throw error;
    return profile;
  }

  const periodEnd = getSubscriptionPeriodEnd(subscription);
  const update = {
    stripe_customer_id: customerId || profile.stripe_customer_id,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: priceId,
    subscription_status: subscription.status || "unknown",
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    subscription_cancel_at: unixDate(subscription.cancel_at),
    plan_tier: plan.key,
    site_limit: plan.siteLimit,
    stripe_synced_at: new Date().toISOString(),
  };
  if (periodEnd) update.paid_until = unixDate(periodEnd);

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(update)
    .eq("id", profile.id);
  if (error) throw error;

  return profile;
}

async function retrieveAndSyncSubscription(subscriptionId, userId = null) {
  if (!subscriptionId) return null;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  return syncSubscription(subscription, userId);
}

async function saveInvoice(invoice, fallbackStatus) {
  const customerId = objectId(invoice?.customer);
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  const profile = await findProfile({ customerId });

  if (!profile) {
    console.warn("Stripe invoice has no matching profile", {
      invoiceId: invoice?.id,
      customerId,
    });
    return;
  }

  const period = getInvoicePeriod(invoice);
  const payment = {
    user_id: profile.id,
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: getInvoicePaymentIntentId(invoice),
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    amount_paid: invoice.amount_paid || 0,
    currency: (invoice.currency || "lkr").toLowerCase(),
    status: invoice.status || fallbackStatus,
    paid_at: unixDate(invoice?.status_transitions?.paid_at),
    period_start: unixDate(period.start),
    period_end: unixDate(period.end),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("subscription_payments")
    .upsert(payment, { onConflict: "stripe_invoice_id" });
  if (error) throw error;

  await retrieveAndSyncSubscription(subscriptionId);
}

async function processEvent(event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const subscriptionId = objectId(session.subscription);
      const userId =
        session.metadata?.supabaseUserId || session.client_reference_id;
      await retrieveAndSyncSubscription(subscriptionId, userId);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object);
      return;
    case "customer.deleted":
      await handleDeletedCustomer(event.data.object);
      return;
    case "invoice.paid":
      await saveInvoice(event.data.object, "paid");
      return;
    case "invoice.payment_failed":
      await saveInvoice(event.data.object, "payment_failed");
      return;
    default:
      return;
  }
}

export async function POST(request) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "stripe_webhook_not_configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "missing_signature" }, { status: 400 });
  }

  let event;
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.warn("Stripe webhook signature verification failed", error);
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    const { data: existingEvent, error: lookupError } = await supabaseAdmin
      .from("stripe_webhook_events")
      .select("id")
      .eq("id", event.id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existingEvent) {
      return Response.json({ received: true, duplicate: true });
    }

    await processEvent(event);

    const { error: recordError } = await supabaseAdmin
      .from("stripe_webhook_events")
      .insert({ id: event.id, event_type: event.type });
    if (recordError && recordError.code !== "23505") throw recordError;

    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", {
      eventId: event.id,
      eventType: event.type,
      error,
    });
    return Response.json({ error: "webhook_processing_failed" }, { status: 500 });
  }
}
