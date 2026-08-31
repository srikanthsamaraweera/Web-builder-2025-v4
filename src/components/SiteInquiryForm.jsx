"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";

const Turnstile = dynamic(() => import("react-turnstile"), { ssr: false });

export default function SiteInquiryForm({ siteId, primaryColor }) {
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
    <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
      <input name="website" tabIndex="-1" autoComplete="off" className="hidden" aria-hidden="true" />
      <input required name="name" maxLength={120} placeholder="Your name" className="rounded border border-gray-300 px-3 py-2" />
      <input required type="email" name="email" maxLength={320} placeholder="Email" className="rounded border border-gray-300 px-3 py-2" />
      <input name="phone" maxLength={40} placeholder="Telephone (optional)" className="rounded border border-gray-300 px-3 py-2 sm:col-span-2" />
      <textarea required name="message" maxLength={3000} placeholder="How can we help?" className="min-h-32 rounded border border-gray-300 px-3 py-2 sm:col-span-2" />
      <div className="sm:col-span-2">
        {siteKey ? <Turnstile sitekey={siteKey} onVerify={(token, boundTurnstile) => { setTurnstileToken(token); turnstileRef.current = boundTurnstile; }} onExpire={() => setTurnstileToken("")} /> : <p className="text-sm text-red-700">Inquiry verification is unavailable.</p>}
      </div>
      <button disabled={state.status === "sending" || !turnstileToken} className="rounded px-4 py-2 font-medium text-white disabled:opacity-60" style={{ backgroundColor: primaryColor }}>
        {state.status === "sending" ? "Sending…" : "Send inquiry"}
      </button>
      {state.message ? <p className={`self-center text-sm ${state.status === "error" ? "text-red-700" : "text-green-700"}`}>{state.message}</p> : null}
    </form>
  );
}
