export const BUSINESS_DAYS = Object.freeze([
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);

export function createDefaultOpeningHours() {
  return Object.fromEntries(
    BUSINESS_DAYS.map((day) => [
      day.toLowerCase(),
      { closed: day === "Sunday", open: "09:00", close: "17:00" },
    ]),
  );
}

export function normalizeOpeningHours(value) {
  const defaults = createDefaultOpeningHours();
  return Object.fromEntries(
    BUSINESS_DAYS.map((day) => {
      const key = day.toLowerCase();
      const row = value?.[key];
      return [
        key,
        {
          closed:
            typeof row?.closed === "boolean" ? row.closed : defaults[key].closed,
          open: /^\d{2}:\d{2}$/.test(row?.open || "")
            ? row.open
            : defaults[key].open,
          close: /^\d{2}:\d{2}$/.test(row?.close || "")
            ? row.close
            : defaults[key].close,
        },
      ];
    }),
  );
}

export function normalizeList(value, limit = 12) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object").slice(0, limit)
    : [];
}
