export const revalidate = 120;

import Link from "next/link";
import Image from "next/image";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import HeroAuthActions from "@/components/HeroAuthActions";
import GoogleAdSlot from "@/components/GoogleAdSlot";
import { TRIAL_DURATION_LABEL } from "@/config/product";

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
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white transition duration-300 hover:-translate-y-1 hover:border-red-200 hover:shadow-[0_20px_50px_rgba(31,26,24,0.10)]">
      <div
        className="relative h-44 w-full shrink-0 bg-gradient-to-br from-red-100 via-orange-50 to-[#fffaf7]"
        style={
          heroImage
            ? {
              backgroundImage: `url(${heroImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
            : {}
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        <div className="absolute bottom-4 left-4 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border-2 border-white bg-white shadow-lg">
            {logo ? (
              <Image
                src={logo}
                alt={`${site.title} logo`}
                width={56}
                height={56}
                className="object-contain max-h-14"
              />
            ) : (
              <span className="text-lg font-bold text-[#BF283B]">
                {site.title?.slice(0, 1) ?? "B"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-bold leading-7 text-[#211b18]">
            {site.title}
          </h3>
          <span className="mt-1 shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
            Live
          </span>
        </div>
        {created && (
          <p className="mt-1.5 text-xs font-medium uppercase tracking-[0.12em] text-stone-400">
            Listed{" "}
            {created.toLocaleDateString(undefined, {
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
        <p className="mt-4 text-sm leading-6 text-stone-600">
          {trimDescription(site.description)}
        </p>
        <div className="flex-1" />
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center justify-between rounded-xl border border-stone-200 px-4 py-3 text-sm font-bold text-[#BF283B] transition group-hover:border-[#BF283B] group-hover:bg-red-50"
        >
          <span>View business page</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

export default async function Home() {
  const featuredSites = await getDirectorySites();

  return (
    <main className="bg-[#fffaf7] text-[#211b18]">
      <section className="relative overflow-hidden border-b border-red-100">
        <div
          className="absolute -right-32 -top-48 h-96 w-96 rounded-full bg-[#BF283B]/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 min-[360px]:px-5 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#BF283B]">
              Sri Lanka&apos;s business directory
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
              Discover local businesses.{" "}
              <span className="text-[#BF283B]">Share your own.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
              Explore trusted Sri Lankan businesses and the people behind them.
              Have a business? Create a simple professional page and start with
              a {TRIAL_DURATION_LABEL} free trial.
            </p>
            <HeroAuthActions />
          </div>

          <aside className="w-full rounded-3xl bg-[#211b18] p-6 text-white shadow-2xl shadow-stone-900/15 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-300">
              A directory with a purpose
            </p>
            <h2 className="mt-4 text-2xl font-bold leading-8 sm:text-3xl sm:leading-10">
              A clearer path to trusted local businesses.
            </h2>
            <a
              href="#featured-listings"
              className="mx-auto mt-7 flex w-fit items-center gap-3 rounded-full bg-[#BF283B] px-6 py-3.5 font-bold text-white shadow-[0_12px_30px_rgba(191,40,59,0.32)] ring-4 ring-red-400/20 transition hover:-translate-y-0.5 hover:bg-[#d23248] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <span>View Listings</span>
              <span
                className="text-xl leading-none motion-safe:animate-bounce"
                aria-hidden="true"
              >
                ↓
              </span>
            </a>
            <Link
              href="/about"
              className="mt-7 flex w-fit items-center gap-2 text-sm font-bold text-red-300 transition hover:text-white"
            >
              Why we built this directory
              <span aria-hidden="true">→</span>
            </Link>
          </aside>

        </div>
      </section>

      <section
        id="featured-listings"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14 min-[360px]:px-5 sm:px-6 sm:py-20"
      >
        <div className="flex flex-col gap-4 border-b border-stone-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#BF283B]">
              Business directory
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Currently listed businesses
            </h2>
            <p className="mt-2 text-stone-600">
              Browse the latest active businesses in our community.
            </p>
          </div>
          {featuredSites.length > 0 && (
            <p className="shrink-0 text-sm font-semibold text-stone-500">
              Showing {featuredSites.length}{" "}
              {featuredSites.length === 1 ? "business" : "businesses"}
            </p>
          )}
        </div>

        {featuredSites.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-red-200 bg-white px-5 py-14 text-center text-[#BF283B] sm:px-6">
            <p className="font-bold">Be the first business listed here.</p>
            <p className="mt-2 text-sm text-stone-600">
              Approved listings from active subscriptions will appear here automatically.
            </p>
            <Link
              href="/register"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#BF283B] px-5 py-3 text-sm font-bold text-white hover:bg-[#a32131]"
            >
              Create your page
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredSites.map((site) => (
              <DirectoryCard key={site.id} site={site} />
            ))}
          </div>
        )}
      </section>

      <div className="mx-auto max-w-4xl px-4 pb-8 min-[360px]:px-5 sm:px-6">
        <div>
          <GoogleAdSlot
            client="ca-pub-6148592747489806"
            slot="1234567890"
          />
        </div>
      </div>
    </main>
  );
}
