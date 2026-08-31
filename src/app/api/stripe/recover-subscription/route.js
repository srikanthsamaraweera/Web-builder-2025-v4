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

function getAppUrl(request) {
  const configuredUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  const url = new URL(configuredUrl || request.nextUrl.origin);
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error("invalid_app_url");
  }
  return url.origin;
}

function objectId(value) {
  return typeof value === "string" ? value : value?.id || null;
}

async function paymentMethodPortal(customerId, returnUrl) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
    flow_data: {
      type: "payment_method_update",
      after_completion: {
        type: "redirect",
        redirect: { return_url: `${returnUrl}?billing=payment-method-updated` },
      },
    },
  });
  return session.url;
}

async function hostedInvoiceUrl(subscription) {
  const invoiceId = objectId(subscription?.latest_invoice);
  if (!invoiceId) return null;
  const invoice = await stripe.invoices.retrieve(invoiceId);
  if (invoice.status === "paid" || invoice.status === "void") return null;
  return invoice.hosted_invoice_url || null;
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

    let subscription = await stripe.subscriptions.retrieve(
      profile.stripe_subscription_id,
      { expand: ["default_payment_method", "latest_invoice"] },
    );
    if (objectId(subscription.customer) !== profile.stripe_customer_id) {
      return Response.json({ error: "subscription_mismatch" }, { status: 403 });
    }

    const returnUrl = `${getAppUrl(request)}/dashboard/home`;
    if (subscription.status === "paused") {
      const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
      if (customer.deleted) {
        return Response.json({ error: "stripe_customer_not_found" }, { status: 409 });
      }
      const paymentMethodId =
        objectId(subscription.default_payment_method) ||
        objectId(customer.invoice_settings?.default_payment_method) ||
        objectId(customer.default_source);
      if (!paymentMethodId) {
        return Response.json({
          action: "add_payment_method",
          url: await paymentMethodPortal(profile.stripe_customer_id, returnUrl),
        });
      }

      subscription = await stripe.subscriptions.resume(subscription.id, {
        billing_cycle_anchor: "now",
      });
      const invoiceUrl = await hostedInvoiceUrl(subscription);
      if (invoiceUrl) {
        return Response.json({ action: "pay_invoice", url: invoiceUrl });
      }
      return Response.json({ action: "resumed", status: subscription.status });
    }

    if (["past_due", "unpaid", "incomplete"].includes(subscription.status)) {
      const invoiceUrl = await hostedInvoiceUrl(subscription);
      if (invoiceUrl) {
        return Response.json({ action: "pay_invoice", url: invoiceUrl });
      }
      return Response.json({
        action: "update_payment_method",
        url: await paymentMethodPortal(profile.stripe_customer_id, returnUrl),
      });
    }

    return Response.json(
      { error: "subscription_does_not_need_recovery" },
      { status: 409 },
    );
  } catch (error) {
    if (error?.code === "resource_missing") {
      return Response.json({ error: "subscription_not_found" }, { status: 404 });
    }
    console.error("Failed to recover Stripe subscription", error);
    return Response.json({ error: "subscription_recovery_failed" }, { status: 500 });
  }
}
