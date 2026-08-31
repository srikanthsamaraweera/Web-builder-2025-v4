import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
      .select("id, status, title, content_json")
      .eq("id", siteId)
      .maybeSingle();
    if (siteError) throw siteError;
    if (!site || !["SUBMITTED", "APPROVED"].includes(site.status)) {
      return Response.json({ error: "site_not_available" }, { status: 404 });
    }

    const recipientEmail = text(site.content_json?.contact?.email, 320).toLowerCase();
    if (!EMAIL_RE.test(recipientEmail)) {
      return Response.json({ error: "recipient_not_configured" }, { status: 422 });
    }

    const brevoApiKey = process.env.BREVO_API_KEY?.trim();
    const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim().toLowerCase();
    const senderName = process.env.BREVO_SENDER_NAME?.trim() || "Lankan Web Directory";
    if (!brevoApiKey || !EMAIL_RE.test(senderEmail || "")) {
      console.error("Inquiry email delivery is not configured");
      return Response.json({ error: "email_not_configured" }, { status: 503 });
    }

    const sourceHash = createHash("sha256")
      .update(`${site.id}:${remoteIp}:${process.env.INQUIRY_RATE_LIMIT_SALT || "inquiry"}`)
      .digest("hex");
    const { data: submissionRows, error } = await supabaseAdmin.rpc(
      "reserve_site_inquiry_delivery",
      {
        p_site_id: site.id,
        p_source_hash: sourceHash,
      },
    );
    if (error) throw error;

    const submission = submissionRows?.[0];
    if (!submission?.accepted) {
      if (submission?.reason === "rate_limited") {
        return Response.json({ error: "rate_limited" }, { status: 429 });
      }
      if (submission?.reason === "site_not_available") {
        return Response.json({ error: "site_not_available" }, { status: 404 });
      }
      throw new Error("inquiry_not_accepted");
    }

    const siteTitle = text(site.title, 160) || "Website";
    const escaped = {
      siteTitle: escapeHtml(siteTitle),
      name: escapeHtml(name),
      email: escapeHtml(email),
      phone: escapeHtml(phone || "Not provided"),
      message: escapeHtml(message).replaceAll("\n", "<br>"),
    };
    const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: recipientEmail, name: siteTitle }],
        replyTo: { email, name },
        subject: `New website inquiry for ${siteTitle}`,
        textContent: [
          `New inquiry for ${siteTitle}`,
          "",
          `Name: ${name}`,
          `Email: ${email}`,
          `Telephone: ${phone || "Not provided"}`,
          "",
          "Message:",
          message,
        ].join("\n"),
        htmlContent: `<h2>New inquiry for ${escaped.siteTitle}</h2><p><strong>Name:</strong> ${escaped.name}</p><p><strong>Email:</strong> ${escaped.email}</p><p><strong>Telephone:</strong> ${escaped.phone}</p><p><strong>Message:</strong><br>${escaped.message}</p>`,
      }),
    });

    let emailResult = {};
    try {
      emailResult = await emailResponse.json();
    } catch {}

    const deliveryStatus = emailResponse.ok ? "SENT" : "FAILED";
    const { error: deliveryUpdateError } = await supabaseAdmin
      .from("site_inquiry_deliveries")
      .update({
        delivery_status: deliveryStatus,
        provider_message_id:
          emailResponse.ok && typeof emailResult?.messageId === "string"
            ? emailResult.messageId
            : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", submission.reservation_id);
    if (deliveryUpdateError) {
      console.error("Failed to update inquiry delivery status", deliveryUpdateError);
    }

    if (!emailResponse.ok) {
      console.error("Brevo rejected inquiry email", {
        status: emailResponse.status,
        code: emailResult?.code,
        message: emailResult?.message,
      });
      return Response.json({ error: "email_delivery_failed" }, { status: 502 });
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("Failed to save site inquiry", error);
    return Response.json({ error: "inquiry_failed" }, { status: 500 });
  }
}
