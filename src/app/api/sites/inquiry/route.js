import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (body?.website) return Response.json({ received: true });

    const siteId = text(body?.siteId, 80);
    const name = text(body?.name, 120);
    const email = text(body?.email, 320).toLowerCase();
    const phone = text(body?.phone, 40);
    const message = text(body?.message, 3000);
    const turnstileToken = text(body?.turnstileToken, 3000);
    if (!siteId || !name || !EMAIL_RE.test(email) || !message || !turnstileToken) {
      return Response.json({ error: "invalid_inquiry" }, { status: 400 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for") || "unknown";
    const remoteIp = forwardedFor.split(",")[0].trim();
    const verifyBody = new FormData();
    verifyBody.append("secret", process.env.TURNSTILE_SECRET || "");
    verifyBody.append("response", turnstileToken);
    if (remoteIp !== "unknown") verifyBody.append("remoteip", remoteIp);
    const verification = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: verifyBody },
    ).then((response) => response.json());
    if (!verification.success) {
      return Response.json({ error: "turnstile_failed" }, { status: 400 });
    }

    const { data: site, error: siteError } = await supabaseAdmin
      .from("sites")
      .select("id, status")
      .eq("id", siteId)
      .maybeSingle();
    if (siteError) throw siteError;
    if (!site || !["SUBMITTED", "APPROVED"].includes(site.status)) {
      return Response.json({ error: "site_not_available" }, { status: 404 });
    }

    const sourceHash = createHash("sha256")
      .update(`${site.id}:${remoteIp}:${process.env.INQUIRY_RATE_LIMIT_SALT || "inquiry"}`)
      .digest("hex");
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabaseAdmin
      .from("site_inquiries")
      .select("id", { count: "exact", head: true })
      .eq("site_id", site.id)
      .eq("source_hash", sourceHash)
      .gte("created_at", since);
    if (countError) throw countError;
    if ((count || 0) >= 5) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }

    const { error } = await supabaseAdmin.from("site_inquiries").insert({
      site_id: site.id,
      name,
      email,
      phone: phone || null,
      message,
      source_hash: sourceHash,
    });
    if (error) throw error;
    return Response.json({ received: true });
  } catch (error) {
    console.error("Failed to save site inquiry", error);
    return Response.json({ error: "inquiry_failed" }, { status: 500 });
  }
}
