export const revalidate = 120;

import Link from "next/link";
import Image from "next/image";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Script from "next/script";

const STORAGE_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-assets`
  : "";

const DIRECTORY_LIMIT = 9;

async function getDirectorySites() {
  try {
    const { data: sites, error } = await supabaseAdmin
      .from("sites")
      .select("id, title, slug, description, logo, hero, owner, created_at, status")
      .eq("status", "APPROVED")
      .order("created_at", { ascending: false })
      .limit(DIRECTORY_LIMIT);

    if (error || !sites?.length) {
      if (error) console.error("Failed to load directory sites", error);
      return [];
    }

    const ownerIds = [...new Set(sites.map((site) => site.owner).filter(Boolean))];
    if (ownerIds.length === 0) return [];

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, paid_until")
      .in("id", ownerIds);

    if (profilesError) {
      console.error("Failed to load profiles for directory", profilesError);
      return [];
    }

    const now = Date.now();
    const activeOwners = new Set(
      (profiles || []).filter((profile) => {
        if (!profile?.paid_until) return false;
        const paidUntil = new Date(profile.paid_until).getTime();
        return Number.isFinite(paidUntil) && paidUntil > now;
      }).map((profile) => profile.id)
    );

    return sites.filter((site) => site.slug && activeOwners.has(site.owner));
  } catch (err) {
    console.error("Unexpected directory fetch error", err);
    return [];
  }
}

function assetUrl(path) {
  if (!path || !STORAGE_BASE) return "";
  return `${STORAGE_BASE}/${path}`;
}

function getHeroImage(site) {
  const heroList = Array.isArray(site?.hero) ? site.hero : [];
  return assetUrl(heroList[0]);
}

function getLogo(site) {
  return assetUrl(site?.logo);
}

function trimDescription(text) {
  if (!text) return "";
  if (text.length <= 140) return text;
  return `${text.slice(0, 137).trim()}...`;
}

function DirectoryCard({ site }) {
  const heroImage = getHeroImage(site);
  const logo = getLogo(site);
  const href = `/${site.slug}/t1`;
  const created = site?.created_at ? new Date(site.created_at) : null;

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-red-100 bg-white shadow-lg transition hover:-translate-y-1 hover:shadow-2xl">
      <div
        className="h-44 w-full bg-gradient-to-br from-red-100 via-orange-50 to-white"
        style={
          heroImage
            ? {
              backgroundImage: `linear-gradient(135deg, rgba(190,18,60,0.75), rgba(249,115,22,0.55)), url(${heroImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
            : {}
        }
      />
      <div className="px-5 pb-6 -mt-10 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-2xl border border-white/60 bg-white shadow-md flex items-center justify-center overflow-hidden">
            {logo ? (
              <Image
                src={logo}
                alt={`${site.title} logo`}
                width={56}
                height={56}
                className="object-contain max-h-14"
              />
            ) : (
              <span className="text-lg font-semibold text-red-600">
                {site.title?.slice(0, 1) ?? "B"}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{site.title}</h3>
            {created && (
              <p className="text-sm text-gray-500 mt-3">
                Listed {created.toLocaleDateString(undefined, { month: "short", year: "numeric" })}
              </p>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{trimDescription(site.description)}</p>
        <div className="flex items-center justify-between text-xs text-gray-500 uppercase tracking-[0.2em]">
          {site.slug && <span>/ {site.slug}</span>}
          <span className="text-green-600 font-semibold tracking-[0.3em]">LIVE</span>
        </div>
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition group-hover:bg-red-700"
        >
          View business page
        </Link>
      </div>
    </div>
  );
}

export default async function Home() {
  const featuredSites = await getDirectorySites();

  return (
    <div className="space-y-16 bg-white">
      <section className="rounded-3xl bg-gradient-to-br from-red-600 via-red-500 to-orange-500 px-6 py-10 text-white shadow-xl sm:px-10">
        <div className="max-w-4xl space-y-6">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.4em] text-white/80">
              curated business web directory
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
              Showcase your business with a hosted mini website
            </h1>
            <p className="text-lg text-white/90">
              Register once, choose a template, and your business goes live on our public
              directory. Every mini site is mobile-ready, blazing fast, and gets a shareable link
              that you can drop anywhere online.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:gap-6">
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.3em] text-white/70">
                how it works
              </span>
              <p className="text-sm text-white/90">
                Create an account, build with our drag-free editor, and publish instantly to the
                directory — no hosting or code required.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/register"
                className="rounded-2xl bg-white px-5 py-2.5 text-center font-semibold text-red-600 shadow-lg shadow-red-900/20 hover:bg-red-50"
              >
                List your business
              </Link>
              <Link
                href="/login"
                className="rounded-2xl border border-white/50 px-5 py-2.5 text-center font-semibold text-white hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
        <div className="max-w-4xl space-y-6">
          <div>
            <ins
              className="adsbygoogle"
              style={{ display: "block" }}
              data-ad-client="ca-pub-6148592747489806"
              data-ad-slot="1234567890"
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
            <Script id="ads-init" strategy="afterInteractive">
              {`(adsbygoogle = window.adsbygoogle || []).push({});`}
            </Script>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-red-600">featured listings</p>
            <h2 className="text-2xl font-bold text-gray-900">Businesses live on the directory</h2>
            <p className="text-gray-600">
              Only approved listings from active accounts appear here. Click any card to see the live
              template experience.
            </p>
          </div>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Add yours
          </Link>
        </div>

        {featuredSites.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-red-200 bg-red-50/50 px-6 py-12 text-center text-red-700">
            <p className="font-semibold">No businesses to show yet.</p>
            <p className="text-sm text-red-600/80 mt-1">
              Approved listings from active subscriptions will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredSites.map((site) => (
              <DirectoryCard key={site.id} site={site} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
