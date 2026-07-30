const configuredTrialMonths = Number.parseInt(
  process.env.NEXT_PUBLIC_TRIAL_MONTHS || "",
  10,
);

export const TRIAL_MONTHS =
  Number.isInteger(configuredTrialMonths) && configuredTrialMonths > 0
    ? configuredTrialMonths
    : 3;

export const TRIAL_DURATION_LABEL = `${TRIAL_MONTHS} ${
  TRIAL_MONTHS === 1 ? "month" : "months"
}`;

export function getTrialEndDate(startDate = new Date()) {
  const trialEnd = new Date(startDate);
  trialEnd.setUTCMonth(trialEnd.getUTCMonth() + TRIAL_MONTHS);
  return trialEnd;
}
