import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const routeParams = await params;
  const rawSlug = Array.isArray(routeParams?.slug)
    ? routeParams.slug[0]
    : routeParams?.slug;
  const slug = typeof rawSlug === "string" ? rawSlug.trim() : "";

  if (!slug) {
    return { title: "Business page", robots: { index: false, follow: false } };
  }

  try {
    const { data: site } = await supabaseAdmin
      .from("sites")
      .select("title, description, status")
      .eq("slug", slug)
      .maybeSingle();
    const approved = site?.status === "APPROVED";

    return {
      title: site?.title || "Business page",
      description: site?.description || "Local business page",
      robots: {
        index: approved,
        follow: approved,
        googleBot: { index: approved, follow: approved },
      },
    };
  } catch {
    return { title: "Business page", robots: { index: false, follow: false } };
  }
}

export default function BusinessPageLayout({ children }) {
  return children;
}
