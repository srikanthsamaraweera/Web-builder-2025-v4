import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripeServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
}

function getAppUrl(request) {
  const configuredUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  const url = new URL(configuredUrl || request.nextUrl.origin);

  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error("invalid_app_url");
  }

  return url.origin;
}

export async function POST(request) {
  try {
    if (!stripe) {
      return Response.json({ error: "stripe_not_configured" }, { status: 503 });
    }

    const token = getBearerToken(request);
    if (!token) {
      return Response.json({ error: "missing_token" }, { status: 401 });
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      return Response.json({ error: "invalid_token" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return Response.json({ error: "profile_not_found" }, { status: 404 });
    }
    if (!profile.stripe_customer_id) {
      return Response.json({ error: "stripe_customer_not_found" }, { status: 409 });
    }

    try {
      const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
      if (customer.deleted) {
        return Response.json(
          { error: "stripe_customer_not_found" },
          { status: 409 },
        );
      }
    } catch (error) {
      if (error?.code === "resource_missing") {
        return Response.json(
          { error: "stripe_customer_not_found" },
          { status: 409 },
        );
      }
      throw error;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${getAppUrl(request)}/dashboard/home`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Failed to create Stripe Customer Portal Session", error);
    return Response.json({ error: "portal_session_failed" }, { status: 500 });
  }
}
