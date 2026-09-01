"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";

const Turnstile = dynamic(() => import("react-turnstile"), { ssr: false });

export default function SiteInquiryForm({
  siteId,
  primaryColor,
  primaryTextColor = "#ffffff",
  fieldBackground = "#ffffff",
  fieldTextColor = "#171717",
  fieldPlaceholderColor = "#6b7280",
  fieldBorderColor = "#d1d5db",
  previewOnly = false,
}) {
  const [state, setState] = useState({ status: "idle", message: "" });
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY;

  const submit = async (event) => {
    event.preventDefault();
    setState({ status: "sending", message: "" });
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/sites/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, turnstileToken, ...Object.fromEntries(form.entries()) }),
    });
    let result = {};
    try {
      result = await response.json();
    } catch {}
    setTurnstileToken("");
    try {
      turnstileRef.current?.reset();
    } catch {}
    if (response.ok) {
      event.currentTarget.reset();
      setState({ status: "sent", message: "Your inquiry has been sent." });
    } else {
      setState({
        status: "error",
        message:
          result?.error === "rate_limited"
            ? "Too many inquiries have been sent. Please try again later."
            : "Unable to send your inquiry. Please try again.",
      });
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mt-6 grid gap-4 sm:grid-cols-2"
      style={{
        "--inquiry-field-background": fieldBackground,
        "--inquiry-field-text": fieldTextColor,
        "--inquiry-field-placeholder": fieldPlaceholderColor,
        "--inquiry-field-border": fieldBorderColor,
      }}
    >
      <input name="website" tabIndex="-1" autoComplete="off" className="hidden" aria-hidden="true" />
      <input disabled={previewOnly} required name="name" maxLength={120} placeholder="Your name" className="site-inquiry-field rounded border px-3 py-2 disabled:opacity-70" />
      <input disabled={previewOnly} required type="email" name="email" maxLength={320} placeholder="Email" className="site-inquiry-field rounded border px-3 py-2 disabled:opacity-70" />
      <input disabled={previewOnly} name="phone" maxLength={40} placeholder="Telephone (optional)" className="site-inquiry-field rounded border px-3 py-2 disabled:opacity-70 sm:col-span-2" />
      <textarea disabled={previewOnly} required name="message" maxLength={3000} placeholder="How can we help?" className="site-inquiry-field min-h-32 rounded border px-3 py-2 disabled:opacity-70 sm:col-span-2" />
      <div className="sm:col-span-2">
        {previewOnly ? <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Inquiry delivery becomes available when this website is published.</p> : siteKey ? <Turnstile sitekey={siteKey} onVerify={(token, boundTurnstile) => { setTurnstileToken(token); turnstileRef.current = boundTurnstile; }} onExpire={() => setTurnstileToken("")} /> : <p className="text-sm text-red-700">Inquiry verification is unavailable.</p>}
      </div>
      <button disabled={previewOnly || state.status === "sending" || !turnstileToken} className="rounded px-4 py-2 font-medium disabled:opacity-60" style={{ backgroundColor: primaryColor, color: primaryTextColor }}>
        {state.status === "sending" ? "Sending…" : "Send inquiry"}
      </button>
      {state.message ? <p className={`self-center text-sm ${state.status === "error" ? "text-red-700" : "text-green-700"}`}>{state.message}</p> : null}
    </form>
  );
}
