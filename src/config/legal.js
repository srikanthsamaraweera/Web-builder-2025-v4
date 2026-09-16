const clean = (value, fallback = "") => value?.trim() || fallback;

export const LEGAL_CONFIG = Object.freeze({
  serviceName: clean(
    process.env.NEXT_PUBLIC_SERVICE_NAME,
    "Lankan Web Directory",
  ),
  websiteUrl: clean(
    process.env.NEXT_PUBLIC_APP_URL,
    "http://127.0.0.1:3000",
  ).replace(/\/$/, ""),
  contactEmail: clean(
    process.env.NEXT_PUBLIC_CONTACT_EMAIL,
    "info@lankan.org",
  ),
  legalOperatorName: clean(process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME),
  legalOperatorLocation: clean(
    process.env.NEXT_PUBLIC_LEGAL_OPERATOR_LOCATION,
  ),
  hostingProvider: clean(
    process.env.NEXT_PUBLIC_HOSTING_PROVIDER,
    "Vercel",
  ),
  hostingRegion: clean(process.env.NEXT_PUBLIC_HOSTING_REGION),
});

export function operatorDescription() {
  const { serviceName, legalOperatorName, legalOperatorLocation } = LEGAL_CONFIG;
  if (!legalOperatorName) return serviceName;
  return `${serviceName}, operated by ${legalOperatorName}${
    legalOperatorLocation ? ` (${legalOperatorLocation})` : ""
  }`;
}
