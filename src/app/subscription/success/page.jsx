import { findSubscriptionPlanByPriceId } from "@/config/subscriptionPlans";
import { stripe } from "@/lib/stripeServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import SubscriptionSuccessActions from "./SubscriptionSuccessActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SubscriptionSuccessPage({ searchParams }) {
  const params = await searchParams;
  const rawSessionId = Array.isArray(params?.session_id)
    ? params.session_id[0]
    : params?.session_id;
  const sessionId = typeof rawSessionId === "string" ? rawSessionId.trim() : "";

  let confirmed = false;
  let plan = "your plan";

  if (stripe && sessionId.startsWith("cs_")) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: [
          "subscription",
          "subscription.items.data.price",
          "subscription.latest_invoice",
        ],
      });
      confirmed = session.status === "complete";
      if (session.metadata?.planTier) plan = session.metadata.planTier;

      const subscription =
        typeof session.subscription === "string"
          ? await stripe.subscriptions.retrieve(session.subscription, {
              expand: ["items.data.price"],
            })
          : session.subscription;
      const userId =
        session.metadata?.supabaseUserId || session.client_reference_id;
      const priceId = subscription?.items?.data?.[0]?.price?.id;
      const selectedPlan = findSubscriptionPlanByPriceId(priceId);
      const periodEnds = (subscription?.items?.data || [])
        .map((item) => item.current_period_end)
        .filter(Number.isFinite);
      const periodEnd = periodEnds.length
        ? Math.max(...periodEnds)
        : subscription?.trial_end || subscription?.current_period_end;

      if (confirmed && subscription && userId && selectedPlan) {
        const update = {
          stripe_customer_id:
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id,
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceId,
          subscription_status: subscription.status,
          plan_tier: selectedPlan.key,
          site_limit: selectedPlan.siteLimit,
          stripe_synced_at: new Date().toISOString(),
        };
        if (Number.isFinite(periodEnd)) {
          update.paid_until = new Date(periodEnd * 1000).toISOString();
        }

        const { error } = await supabaseAdmin
          .from("profiles")
          .update(update)
          .eq("id", userId);
        if (error) throw error;

        const invoice =
          typeof subscription.latest_invoice === "string"
            ? await stripe.invoices.retrieve(subscription.latest_invoice)
            : subscription.latest_invoice;
        if (invoice?.id) {
          const invoicePeriods = (invoice.lines?.data || [])
            .map((line) => line.period)
            .filter(
              (period) =>
                Number.isFinite(period?.start) &&
                Number.isFinite(period?.end),
            );
          const invoicePeriodStart = invoicePeriods.length
            ? Math.min(...invoicePeriods.map((period) => period.start))
            : null;
          const invoicePeriodEnd = invoicePeriods.length
            ? Math.max(...invoicePeriods.map((period) => period.end))
            : null;
          const customerId =
            typeof invoice.customer === "string"
              ? invoice.customer
              : invoice.customer?.id;
          const { error: invoiceError } = await supabaseAdmin
            .from("subscription_payments")
            .upsert(
              {
                user_id: userId,
                stripe_invoice_id: invoice.id,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscription.id,
                amount_paid: invoice.amount_paid || 0,
                currency: (invoice.currency || "lkr").toLowerCase(),
                status: invoice.status || "paid",
                paid_at: Number.isFinite(invoice.status_transitions?.paid_at)
                  ? new Date(
                      invoice.status_transitions.paid_at * 1000,
                    ).toISOString()
                  : null,
                period_start: Number.isFinite(invoicePeriodStart)
                  ? new Date(invoicePeriodStart * 1000).toISOString()
                  : null,
                period_end: Number.isFinite(invoicePeriodEnd)
                  ? new Date(invoicePeriodEnd * 1000).toISOString()
                  : null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "stripe_invoice_id" },
            );
          if (invoiceError) throw invoiceError;
        }
      }
    } catch (error) {
      console.warn("Unable to verify completed Stripe Checkout Session", error);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
      <section className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">
          {confirmed ? "✓" : "…"}
        </div>
        <h1 className="mt-5 text-3xl font-bold text-gray-900">
          {confirmed ? "Subscription confirmed" : "Confirming subscription"}
        </h1>
        <p className="mt-3 text-gray-600">
          {confirmed
            ? `Your ${plan} subscription checkout was completed successfully.`
            : "We could not verify this Checkout Session. Your payment may still be processing."}
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Subscription access is synchronized securely from Stripe and may take
          a few seconds to appear.
        </p>
        <SubscriptionSuccessActions />
      </section>
    </main>
  );
}
