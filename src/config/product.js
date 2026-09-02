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

export function getTrialEndDate(startDate = new Date()) {
  const trialEnd = new Date(startDate);
  trialEnd.setUTCDate(trialEnd.getUTCDate() + TRIAL_DAYS);
  return trialEnd;
}
