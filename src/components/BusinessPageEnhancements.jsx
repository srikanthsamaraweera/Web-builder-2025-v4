"use client";

import { BUSINESS_DAYS } from "@/config/businessPageDefaults";

const inputClass =
  "w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500";

export default function BusinessPageEnhancements({ value, onChange }) {
  const update = (key, nextValue) => onChange({ ...value, [key]: nextValue });
  const updateSocial = (key, nextValue) =>
    update("social", { ...(value.social || {}), [key]: nextValue });
  const updateHours = (day, patch) =>
    update("openingHours", {
      ...value.openingHours,
      [day]: { ...value.openingHours?.[day], ...patch },
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
      <section className="rounded border border-gray-200 p-4">
        <h2 className="font-semibold text-red-700">Template and style</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium">
            Template
            <select
              className={`${inputClass} mt-1`}
              value={value.template || "classic"}
              onChange={(event) => update("template", event.target.value)}
            >
              <option value="classic">Classic</option>
              <option value="modern">Modern</option>
              <option value="compact">Compact</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Font style
            <select
              className={`${inputClass} mt-1`}
              value={value.fontStyle || "sans"}
              onChange={(event) => update("fontStyle", event.target.value)}
            >
              <option value="sans">Modern sans</option>
              <option value="serif">Classic serif</option>
              <option value="rounded">Friendly rounded</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Primary colour
            <input
              type="color"
              className={`${inputClass} mt-1 h-11`}
              value={value.primaryColor || "#bf283b"}
              onChange={(event) => update("primaryColor", event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="rounded border border-gray-200 p-4">
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
      </section>

      <section className="rounded border border-gray-200 p-4">
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
      </section>

      <section className="rounded border border-gray-200 p-4">
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
      </section>

    </>
  );
}
