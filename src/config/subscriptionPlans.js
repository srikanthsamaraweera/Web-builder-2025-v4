import "server-only";
import { TRIAL_DAYS } from "@/config/product";

function parseInteger(value, fallback, { min = 0, max = Infinity } = {}) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : fallback;
}

function parsePriceIds(...values) {
  return [
    ...new Set(
      values
        .flatMap((value) => (value || "").split(","))
        .map((value) => value.trim())
        .filter((value) => value.startsWith("price_")),
    ),
  ];
}

function createPlan({
  key,
  name,
  priceId,
  legacyPriceIds,
  siteLimit,
  trialDays,
}) {
  const recognizedPriceIds = parsePriceIds(priceId, legacyPriceIds);
  return Object.freeze({
    key,
    name,
    priceId: recognizedPriceIds[0] || "",
    recognizedPriceIds: Object.freeze(recognizedPriceIds),
    siteLimit,
    trialDays,
  });
}

const defaultTrialDays = TRIAL_DAYS;

export const SUBSCRIPTION_PLANS = Object.freeze({
  BASIC: createPlan({
    key: "BASIC",
    name: "Basic",
    priceId: process.env.STRIPE_BASIC_PRICE_ID,
    legacyPriceIds: process.env.STRIPE_BASIC_LEGACY_PRICE_IDS,
    siteLimit: parseInteger(process.env.STRIPE_BASIC_SITE_LIMIT, 5, { min: 1 }),
    trialDays: parseInteger(
      process.env.STRIPE_BASIC_TRIAL_DAYS,
      defaultTrialDays,
      { min: 0, max: 730 },
    ),
  }),
  PRO: createPlan({
    key: "PRO",
    name: "Pro",
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    legacyPriceIds: process.env.STRIPE_PRO_LEGACY_PRICE_IDS,
    siteLimit: parseInteger(process.env.STRIPE_PRO_SITE_LIMIT, 20, { min: 1 }),
    trialDays: parseInteger(
      process.env.STRIPE_PRO_TRIAL_DAYS,
      defaultTrialDays,
      { min: 0, max: 730 },
    ),
  }),
  BUSINESS: createPlan({
    key: "BUSINESS",
    name: "Business",
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
    legacyPriceIds: process.env.STRIPE_BUSINESS_LEGACY_PRICE_IDS,
    siteLimit: parseInteger(process.env.STRIPE_BUSINESS_SITE_LIMIT, 100, {
      min: 1,
    }),
    trialDays: parseInteger(
      process.env.STRIPE_BUSINESS_TRIAL_DAYS,
      defaultTrialDays,
      { min: 0, max: 730 },
    ),
  }),
});

export function getSubscriptionPlan(planKey) {
  const normalizedKey =
    typeof planKey === "string" ? planKey.trim().toUpperCase() : "";
  const plan = SUBSCRIPTION_PLANS[normalizedKey];
  return plan?.priceId ? plan : null;
}

export function getAvailableSubscriptionPlans() {
  return Object.values(SUBSCRIPTION_PLANS).filter((plan) => plan.priceId);
}

export function findSubscriptionPlanByPriceId(priceId) {
  if (typeof priceId !== "string" || !priceId.startsWith("price_")) {
    return null;
  }
  return (
    getAvailableSubscriptionPlans().find((plan) =>
      plan.recognizedPriceIds.includes(priceId),
    ) || null
  );
}
