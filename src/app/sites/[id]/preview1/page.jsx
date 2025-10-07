"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const APPROVED_STATUS = "APPROVED";
const BUCKET = "site-assets";

export default function Preview1() {
  const params = useParams();
  const siteId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? "";
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [site, setSite] = useState(null);
  const [error, setError] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);

  const loadPreview = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    setError("");

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.warn("Failed to obtain session:", sessionError);
      }

      const accessToken = sessionData?.session?.access_token ?? null;
      const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
      const res = await fetch(`/api/sites/${encodeURIComponent(siteId)}/preview`, {
        headers,
        cache: "no-store",
      });

      if (res.ok) {
        const payload = await res.json();
        setSite(payload?.site ?? null);
        setAllowed(true);
        setError("");
        return;
      }

      setAllowed(false);
      setSite(null);

      if (res.status === 404) {
        setError("Site not found.");
        return;
      }

      if (res.status === 403) {
        setError("This site preview is not available.");
        return;
      }

      const payload = await res.json().catch(() => null);
      const detail = typeof payload?.error === "string" ? ` (${payload.error})` : "";
      setError(`Unable to load preview${detail}.`);
    } catch (err) {
      console.error("Failed to load preview:", err);
      setAllowed(false);
      setSite(null);
      setError("Unable to load preview.");
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadPreview();
    });
    return () => {
      listener?.subscription?.unsubscribe?.();
    };
  }, [loadPreview]);

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      setAllowed(false);
      setSite(null);
      setError("");
    }
  }, [siteId]);

  const heroImages = useMemo(() => {
    const list = Array.isArray(site?.hero) ? site.hero : [];
    return list
      .map((path) => {
        if (!path || typeof path !== "string") return null;
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return data?.publicUrl || null;
      })
      .filter(Boolean);
  }, [site?.hero]);

  const logoUrl = useMemo(() => {
    const path = typeof site?.logo === "string" ? site.logo : "";
    if (!path) return "";
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl || "";
  }, [site?.logo]);

  const aboutParagraphs = useMemo(() => {
    const raw = typeof site?.content_json?.about === "string" ? site.content_json.about.trim() : "";
    if (!raw) return [];
    return raw
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);
  }, [site?.content_json?.about]);

  useEffect(() => {
    setCurrentSlide(0);
  }, [site?.hero]);

  useEffect(() => {
    if (heroImages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => {
        const next = prev + 1;
        return next >= heroImages.length ? 0 : next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [heroImages.length]);

  const goPrev = useCallback(() => {
    if (heroImages.length <= 1) return;
    setCurrentSlide((prev) => {
      const total = heroImages.length;
      return total === 0 ? 0 : (prev - 1 + total) % total;
    });
  }, [heroImages.length]);

  const goNext = useCallback(() => {
    if (heroImages.length <= 1) return;
    setCurrentSlide((prev) => {
      const total = heroImages.length;
      return total === 0 ? 0 : (prev + 1) % total;
    });
  }, [heroImages.length]);

  const goToSlide = useCallback(
    (index) => {
      if (heroImages.length === 0) return;
      setCurrentSlide(() => {
        const total = heroImages.length;
        if (total === 0) return 0;
        const normalized = ((index % total) + total) % total;
        return normalized;
      });
    },
    [heroImages.length]
  );

  if (!siteId) {
    return (
      <div className="max-w-5xl mx-auto py-16">
        <h1 className="text-2xl font-semibold text-gray-900">Preview unavailable</h1>
        <p className="mt-4 text-gray-700">Missing site identifier.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-16">
        <p>Loading preview...</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="max-w-5xl mx-auto py-16">
        <h1 className="text-2xl font-semibold text-gray-900">Preview unavailable</h1>
        {error ? <p className="mt-4 text-gray-700">{error}</p> : null}
      </div>
    );
  }

  const statusValue = (site?.status || "").toUpperCase();
  const subtitle = statusValue === APPROVED_STATUS ? "Approved" : null;
  const siteTitle = site?.title || "Preview Page";
  const siteDescription = site?.description || "";
  const logoFallbackInitial = siteTitle.trim().charAt(0)?.toUpperCase() || "P";

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-red-700 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <div className="relative h-10 w-10 overflow-hidden rounded bg-white/20">
                <Image
                  src={logoUrl}
                  alt={`${siteTitle} logo`}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded bg-white/20 text-lg font-semibold">
                {logoFallbackInitial}
              </div>
            )}
            <span className="text-lg font-semibold">{siteTitle}</span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <a href="#" className="hover:text-white/80">About</a>
            <a href="#" className="hover:text-white/80">Contact</a>
            <a href="#" className="hover:text-white/80">Gallery</a>
          </nav>
        </div>
      </header>

      {heroImages.length > 0 ? (
        <section className="relative w-full overflow-hidden bg-gray-100">
          <div className="relative h-[400px] w-full">
            {heroImages.map((src, idx) => (
              <Image
                key={src}
                src={src}
                alt={`Hero image ${idx + 1}`}
                fill
                priority={idx === 0}
                className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ${
                  idx === currentSlide ? "opacity-100" : "opacity-0"
                }`}
                sizes="100vw"
              />
            ))}

            {heroImages.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 text-gray-800 shadow hover:bg-white"
                  aria-label="Previous slide"
                >
                  <span aria-hidden="true">&lt;</span>
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 text-gray-800 shadow hover:bg-white"
                  aria-label="Next slide"
                >
                  <span aria-hidden="true">&gt;</span>
                </button>
                <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
                  {heroImages.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => goToSlide(idx)}
                      className={`h-2.5 w-2.5 rounded-full border border-white transition-colors ${
                        idx === currentSlide ? "bg-white" : "bg-white/40"
                      }`}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-col gap-6 rounded-3xl border border-red-50 bg-white p-10 shadow-sm">
          <div>
            
            <h1 className="mt-4 text-4xl font-bold text-gray-900">{siteTitle}</h1>
            {siteDescription ? (
              <p className="mt-4 text-lg leading-relaxed text-gray-700">{siteDescription}</p>
            ) : (
              <p className="mt-4 text-lg leading-relaxed text-gray-500">
                Discover what makes this site special. The creator will add more details soon.
              </p>
            )}
          </div>
        </div>

        <section className="mt-12 rounded-2xl border border-red-100 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-red-700">About {siteTitle}</h2>
          <div className="mt-4 space-y-4 text-base leading-relaxed text-gray-700">
            {aboutParagraphs.length > 0 ? (
              aboutParagraphs.map((paragraph, idx) => <p key={idx}>{paragraph}</p>)
            ) : (
              <p>This site owner is still working on their story. Check back soon for more details.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
