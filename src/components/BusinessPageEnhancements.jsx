"use client";

import { BUSINESS_DAYS } from "@/config/businessPageDefaults";

const inputClass =
  "w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500";
const BRAND_COLORS = [
  "#bf283b",
  "#b45309",
  "#15803d",
  "#0f766e",
  "#0369a1",
  "#4338ca",
  "#7e22ce",
  "#be185d",
];

export default function BusinessPageEnhancements({ value, onChange, show = ["appearance", "social", "hours", "catalog"] }) {
  const visible = new Set(show);
  const update = (key, nextValue) => onChange({ ...value, [key]: nextValue });
  const updateSocial = (key, nextValue) =>
    update("social", { ...(value.social || {}), [key]: nextValue });
  const updateHours = (day, patch) =>
    onChange({
      ...value,
      openingHoursConfigured: true,
      openingHours: {
        ...value.openingHours,
        [day]: { ...value.openingHours?.[day], ...patch },
      },
    });
  const updateListItem = (key, index, patch) => {
    const items = [...(value[key] || [])];
    items[index] = { ...items[index], ...patch };
    update(key, items);
  };
  const removeListItem = (key, index) =>
    update(
      key,
      (value[key] || []).filter((_, itemIndex) => itemIndex !== index),
    );

  return (
    <>
      {visible.has("appearance") ? (
        <section className="rounded border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-red-700">Appearance</h2>
          <p className="mt-1 text-sm text-gray-600">
            Choose an overall style, one prominent colour, and a theme. Text,
            buttons, headings, backgrounds, and contrast are handled automatically.
          </p>
          <fieldset className="mt-5">
            <legend className="text-sm font-medium text-gray-900">Overall style</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                ["modern", "Modern", "Clean and professional", "font-sans"],
                ["friendly", "Friendly", "Soft and approachable", "font-sans tracking-wide"],
                ["elegant", "Elegant", "Refined and timeless", "font-serif"],
                ["bold", "Bold", "Energetic and attention-grabbing", "font-sans uppercase tracking-tight"],
                ["minimal", "Minimal", "Calm, spacious, and focused", "font-sans font-light"],
                ["showcase", "Showcase", "Immersive and image-led", "font-sans tracking-wide"],
              ].map(([style, label, description, previewClass]) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => update("template", style)}
                  className={`rounded-xl border bg-white p-4 text-left ${
                    (value.template || "modern") === style
                      ? "border-red-400 ring-2 ring-red-200"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  aria-pressed={(value.template || "modern") === style}
                >
                  <span className={`block text-lg font-semibold text-gray-900 ${previewClass}`}>{label}</span>
                  <span className="mt-1 block text-xs text-gray-600">{description}</span>
                  <span className={`mt-3 block h-2 w-full ${style === "elegant" || style === "minimal" ? "rounded-sm" : style === "friendly" || style === "showcase" ? "rounded-full" : "rounded-md"}`} style={{ backgroundColor: value.primaryColor || "#bf283b" }} />
                </button>
              ))}
            </div>
          </fieldset>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <span className="text-sm font-medium text-gray-900">Prominent colour</span>
              <div className="mt-3 flex flex-wrap gap-3">
                {BRAND_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => update("primaryColor", color)}
                    className={`h-10 w-10 rounded-full border-2 shadow-sm ${
                      (value.primaryColor || "#bf283b").toLowerCase() === color
                        ? "border-gray-900 ring-2 ring-gray-300"
                        : "border-white"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Use ${color} as the prominent colour`}
                  />
                ))}
                <label className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm">
                  Custom
                  <input
                    type="color"
                    className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
                    value={value.primaryColor || "#bf283b"}
                    onChange={(event) => update("primaryColor", event.target.value)}
                  />
                </label>
              </div>
            </div>
            <fieldset>
              <legend className="text-sm font-medium text-gray-900">Website theme</legend>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {[
                  ["light", "Light", "bg-white text-gray-900"],
                  ["dark", "Dark", "bg-slate-900 text-white"],
                ].map(([mode, label, classes]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => update("themeMode", mode)}
                    className={`rounded-lg border p-4 text-left ${classes} ${
                      (value.themeMode || "light") === mode
                        ? "ring-2 ring-red-400"
                        : "border-gray-300"
                    }`}
                    aria-pressed={(value.themeMode || "light") === mode}
                  >
                    <span className="block font-semibold">{label}</span>
                    <span className="mt-2 block h-2 w-16 rounded" style={{ backgroundColor: value.primaryColor || "#bf283b" }} />
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </section>
      ) : null}

      {visible.has("social") ? <section className="rounded border border-gray-200 p-4">
        <h2 className="font-semibold text-red-700">Contact buttons and social links</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            WhatsApp number
            <input className={`${inputClass} mt-1`} value={value.whatsapp || ""} onChange={(e) => update("whatsapp", e.target.value)} placeholder="+94 77 123 4567" />
          </label>
          {[
            ["facebook", "Facebook URL"],
            ["instagram", "Instagram URL"],
            ["tiktok", "TikTok URL"],
          ].map(([key, label]) => (
            <label key={key} className="text-sm font-medium">
              {label}
              <input type="url" className={`${inputClass} mt-1`} value={value.social?.[key] || ""} onChange={(e) => updateSocial(key, e.target.value)} placeholder="https://" />
            </label>
          ))}
        </div>
      </section> : null}

      {visible.has("hours") ? <section className="rounded border border-gray-200 p-4">
        <h2 className="font-semibold text-red-700">Opening hours</h2>
        <div className="mt-4 space-y-2">
          {BUSINESS_DAYS.map((label) => {
            const day = label.toLowerCase();
            const row = value.openingHours?.[day] || {};
            return (
              <div key={day} className="grid items-center gap-2 rounded bg-gray-50 p-2 sm:grid-cols-[1fr_auto_8rem_8rem]">
                <span className="text-sm font-medium">{label}</span>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(row.closed)} onChange={(e) => updateHours(day, { closed: e.target.checked })} /> Closed</label>
                <input aria-label={`${label} opening time`} type="time" disabled={row.closed} className={inputClass} value={row.open || "09:00"} onChange={(e) => updateHours(day, { open: e.target.value })} />
                <input aria-label={`${label} closing time`} type="time" disabled={row.closed} className={inputClass} value={row.close || "17:00"} onChange={(e) => updateHours(day, { close: e.target.value })} />
              </div>
            );
          })}
        </div>
      </section> : null}

      {visible.has("catalog") ? <section className="rounded border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-red-700">Products and services</h2>
          <button type="button" className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700" onClick={() => update("catalog", [...(value.catalog || []), { name: "", description: "", price: "" }])}>Add item</button>
        </div>
        <div className="mt-4 space-y-3">
          {(value.catalog || []).map((item, index) => (
            <div key={index} className="grid gap-3 rounded border border-gray-200 p-3 sm:grid-cols-3">
              <input className={inputClass} value={item.name || ""} onChange={(e) => updateListItem("catalog", index, { name: e.target.value })} placeholder="Name" />
              <input className={inputClass} value={item.description || ""} onChange={(e) => updateListItem("catalog", index, { description: e.target.value })} placeholder="Short description" />
              <div className="flex gap-2"><input className={inputClass} value={item.price || ""} onChange={(e) => updateListItem("catalog", index, { price: e.target.value })} placeholder="Price (optional)" /><button type="button" onClick={() => removeListItem("catalog", index)} className="text-sm text-red-700">Remove</button></div>
            </div>
          ))}
        </div>
      </section> : null}

    </>
  );
}
