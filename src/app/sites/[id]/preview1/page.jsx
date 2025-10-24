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
  const [lightboxIndex, setLightboxIndex] = useState(null);

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

  const galleryImages = useMemo(() => {
    const list = Array.isArray(site?.gallery) ? site.gallery : [];
    return list
      .map((path) => {
        if (!path || typeof path !== "string") return null;
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return data?.publicUrl || null;
      })
      .filter(Boolean);
  }, [site?.gallery]);

  const aboutParagraphs = useMemo(() => {
    const raw = typeof site?.content_json?.about === "string" ? site.content_json.about.trim() : "";
    if (!raw) return [];
    return raw
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);
  }, [site?.content_json?.about]);

  const contactInfo = useMemo(() => {
    const contact = site?.content_json?.contact ?? {};
    const email = typeof contact.email === "string" ? contact.email.trim() : "";
    const phone = typeof contact.phone === "string" ? contact.phone.trim() : "";
    const address = typeof contact.address === "string" ? contact.address.trim() : "";
    return { email, phone, address };
  }, [
    site?.content_json?.contact?.email,
    site?.content_json?.contact?.phone,
    site?.content_json?.contact?.address,
  ]);

  const hasGalleryImages = galleryImages.length > 0;
  const hasContactInfo = Boolean(contactInfo.email || contactInfo.phone || contactInfo.address);

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

  const openLightbox = useCallback(
    (index) => {
      if (galleryImages.length === 0) return;
      setLightboxIndex(() => {
        const total = galleryImages.length;
        if (total === 0) return null;
        const normalized = ((index % total) + total) % total;
        return normalized;
      });
    },
    [galleryImages.length]
  );

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const goLightboxPrev = useCallback(() => {
    setLightboxIndex((prev) => {
      if (prev === null || galleryImages.length === 0) return prev;
      const total = galleryImages.length;
      return (prev - 1 + total) % total;
    });
  }, [galleryImages.length]);

  const goLightboxNext = useCallback(() => {
    setLightboxIndex((prev) => {
      if (prev === null || galleryImages.length === 0) return prev;
      const total = galleryImages.length;
      return (prev + 1) % total;
    });
  }, [galleryImages.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const total = galleryImages.length;
    if (total === 0) {
      setLightboxIndex(null);
      return;
    }
    if (lightboxIndex >= total) {
      setLightboxIndex(total - 1);
    }
  }, [galleryImages.length, lightboxIndex]);

  useEffect(() => {
    if (lightboxIndex === null) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeLightbox();
      } else if (event.key === "ArrowRight") {
        goLightboxNext();
      } else if (event.key === "ArrowLeft") {
        goLightboxPrev();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [lightboxIndex, closeLightbox, goLightboxNext, goLightboxPrev]);

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
  const lightboxImage = lightboxIndex !== null ? galleryImages[lightboxIndex] ?? null : null;

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-red-700 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <div className="flex items-center justify-center rounded bg-white/20 px-4 py-2">
                <Image
                  src={logoUrl}
                  alt={`${siteTitle} logo`}
                  height={100}
                  width={300}
                  className="h-[30px] w-auto object-contain"
                  priority
                />
              </div>
            ) : (
              <div className="flex h-[100px] w-[100px] items-center justify-center rounded bg-white/20 text-3xl font-semibold">
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
            
              {subtitle?"":<span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700">{site.status}</span> }
           
            <h1 className="mt-4 text-4xl font-bold text-gray-900">{siteTitle}</h1>
            {siteDescription ? (
              <p className="mt-4 text-lg leading-relaxed text-gray-700">{siteDescription}</p>
            ) : (
              <p className="mt-4 text-lg leading-relaxed text-gray-500">
                {/* Discover what makes this site special. The creator will add more details soon. */}
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
              <p>
                {/* This site owner is still working on their story. Check back soon for more details. */}
                </p>
            )}
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-red-100 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-red-700">Gallery</h2>
          {hasGalleryImages ? (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {galleryImages.map((src, idx) => (
                <button
                  key={`${src}-${idx}`}
                  type="button"
                  onClick={() => openLightbox(idx)}
                  className="group relative overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-red-200"
                  aria-label={`Open gallery image ${idx + 1}`}
                >
                  <div className="relative aspect-square w-full">
                    <Image
                      src={src}
                      alt={`${siteTitle} gallery image ${idx + 1}`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-base text-gray-500">Gallery images will be added soon.</p>
          )}
        </section>

        <section className="mt-12 rounded-2xl border border-red-100 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-red-700">Contact</h2>
          {hasContactInfo ? (
            <dl className="mt-6 grid gap-8 sm:grid-cols-3">
              <div>
                <dt className="text-sm font-semibold uppercase tracking-wide text-gray-500">Email</dt>
                <dd className="mt-2 text-base text-gray-800">
                  {contactInfo.email ? (
                    <a href={`mailto:${contactInfo.email}`} className="text-red-700 hover:underline">
                      {contactInfo.email}
                    </a>
                  ) : (
                    <span className="text-gray-400">Not provided</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold uppercase tracking-wide text-gray-500">Phone</dt>
                <dd className="mt-2 text-base text-gray-800">
                  {contactInfo.phone ? (
                    <a
                      href={`tel:${contactInfo.phone.replace(/[^+\d]/g, "")}`}
                      className="text-red-700 hover:underline"
                    >
                      {contactInfo.phone}
                    </a>
                  ) : (
                    <span className="text-gray-400">Not provided</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold uppercase tracking-wide text-gray-500">Address</dt>
                <dd className="mt-2 text-base text-gray-800">
                  {contactInfo.address ? (
                    <p>{contactInfo.address}</p>
                  ) : (
                    <span className="text-gray-400">Not provided</span>
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-base text-gray-500">Contact details will be added soon.</p>
          )}
        </section>
      </main>

      {lightboxIndex !== null && lightboxImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-label="Gallery image lightbox"
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute right-6 top-6 rounded-full border border-white/40 bg-white/10 px-3 py-1 text-sm font-medium text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
            aria-label="Close gallery"
          >
            Close
          </button>

          {galleryImages.length > 1 ? (
            <>
              <button
                type="button"
                onClick={goLightboxPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white transition hover:bg-white/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
                aria-label="View previous image"
              >
                <span aria-hidden="true">&lt;</span>
              </button>
              <button
                type="button"
                onClick={goLightboxNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white transition hover:bg-white/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
                aria-label="View next image"
              >
                <span aria-hidden="true">&gt;</span>
              </button>
            </>
          ) : null}

          <div className="relative w-full max-w-5xl">
            <div className="relative w-full overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "3 / 2" }}>
              <Image
                src={lightboxImage}
                alt={`${siteTitle} gallery image ${lightboxIndex + 1}`}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1000px"
                className="object-contain"
              />
            </div>
            <div className="mt-4 text-center text-sm text-white/80">
              Image {lightboxIndex + 1} of {galleryImages.length}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
