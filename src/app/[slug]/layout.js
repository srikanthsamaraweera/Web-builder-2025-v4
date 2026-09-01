import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const routeParams = await params;
  const routeSegment = Array.isArray(routeParams?.slug)
    ? routeParams.slug[0]
    : routeParams?.slug;
  const slug =
    typeof routeSegment === "string" && routeSegment.endsWith("-site")
      ? routeSegment.slice(0, -"-site".length)
      : "";

  if (!slug) {
    return { title: "Business page", robots: { index: false, follow: false } };
  }

  try {
    const { data: site } = await supabaseAdmin
      .from("sites")
      .select("title, description, status, owner")
      .eq("slug", slug)
      .maybeSingle();
    const { data: owner } = site?.owner
      ? await supabaseAdmin
          .from("profiles")
          .select("subscription_status, paid_until, role")
          .eq("id", site.owner)
          .maybeSingle()
      : { data: null };
    const active =
      String(owner?.role || "").trim().toUpperCase() === "ADMIN" ||
      (["active", "trialing", "past_due"].includes(
        String(owner?.subscription_status || "").toLowerCase(),
      ) &&
      owner?.paid_until &&
      new Date(owner.paid_until).getTime() > Date.now());
    const indexable = site?.status === "APPROVED" && Boolean(active);

    return {
      title: site?.title || "Business page",
      description: site?.description || "Local business page",
      robots: {
        index: indexable,
        follow: indexable,
        googleBot: { index: indexable, follow: indexable },
      },
    };
  } catch {
    return { title: "Business page", robots: { index: false, follow: false } };
  }
}

export default function SiteLayout({ children }) {
  return children;
}
