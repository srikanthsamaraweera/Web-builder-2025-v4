const HEX_COLOR_RE = /^#([0-9a-f]{6})$/i;

export function normalizeHexColor(value, fallback = "#bf283b") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^#([0-9a-f]{3})$/i.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split("")
      .map((character) => character.repeat(2))
      .join("")}`.toLowerCase();
  }
  return HEX_COLOR_RE.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

function toRgb(color) {
  const value = normalizeHexColor(color).slice(1);
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function toHex(rgb) {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(color) {
  const channels = toRgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function mix(first, second, amount) {
  const a = toRgb(first);
  const b = toRgb(second);
  return toHex(a.map((channel, index) => channel * (1 - amount) + b[index] * amount));
}

export function readableTextColor(background) {
  return contrastRatio(background, "#ffffff") >= contrastRatio(background, "#111827")
    ? "#ffffff"
    : "#111827";
}

function accessibleAccent(primary, surface, mode) {
  if (contrastRatio(primary, surface) >= 4.5) return primary;
  const target = mode === "dark" ? "#ffffff" : "#000000";
  for (let amount = 0.1; amount <= 0.9; amount += 0.1) {
    const candidate = mix(primary, target, amount);
    if (contrastRatio(candidate, surface) >= 4.5) return candidate;
  }
  return mode === "dark" ? "#ffffff" : "#111827";
}

export function deriveSiteTheme(primaryValue, modeValue) {
  const primary = normalizeHexColor(primaryValue);
  const mode = modeValue === "dark" ? "dark" : "light";
  const dark = mode === "dark";
  const page = dark ? "#0f172a" : "#f8fafc";
  const surface = dark ? "#111827" : "#ffffff";
  const text = dark ? "#f8fafc" : "#111827";
  const muted = dark ? "#cbd5e1" : "#475569";
  const border = dark ? "#334155" : "#e5e7eb";

  return {
    mode,
    primary,
    primaryText: readableTextColor(primary),
    accent: accessibleAccent(primary, surface, mode),
    hover: mix(primary, readableTextColor(primary) === "#ffffff" ? "#000000" : "#ffffff", 0.16),
    soft: mix(primary, surface, dark ? 0.82 : 0.9),
    page,
    surface,
    text,
    muted,
    border,
  };
}
