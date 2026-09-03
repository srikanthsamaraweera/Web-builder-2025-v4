const configuredTrialDays = Number.parseInt(
  process.env.NEXT_PUBLIC_TRIAL_DAYS || "",
  10,
);

export const TRIAL_DAYS =
  Number.isInteger(configuredTrialDays) && configuredTrialDays > 0
    ? configuredTrialDays
    : 30;

export const TRIAL_DURATION_LABEL = `${TRIAL_DAYS} ${
  TRIAL_DAYS === 1 ? "day" : "days"
}`;

const configuredBasicMonthlyPriceLkr = Number.parseInt(
  process.env.NEXT_PUBLIC_BASIC_MONTHLY_PRICE_LKR || "",
  10,
);

export const BASIC_MONTHLY_PRICE_LKR =
  Number.isInteger(configuredBasicMonthlyPriceLkr) &&
  configuredBasicMonthlyPriceLkr > 0
    ? configuredBasicMonthlyPriceLkr
    : 1000;

export const BASIC_DAILY_PRICE_LKR = Math.round(BASIC_MONTHLY_PRICE_LKR / 30);

export const BASIC_MONTHLY_PRICE_LABEL = `LKR ${BASIC_MONTHLY_PRICE_LKR.toLocaleString("en-LK")}`;
export const BASIC_DAILY_PRICE_LABEL = `LKR ${BASIC_DAILY_PRICE_LKR.toLocaleString("en-LK")}`;

export function getTrialEndDate(startDate = new Date()) {
  const trialEnd = new Date(startDate);
  trialEnd.setUTCDate(trialEnd.getUTCDate() + TRIAL_DAYS);
  return trialEnd;
}
