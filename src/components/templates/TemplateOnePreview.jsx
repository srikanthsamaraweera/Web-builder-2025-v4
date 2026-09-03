"use client";

import Image from "next/image";
import { normalizeSiteSections } from "@/config/siteSections";
import { BUSINESS_DAYS, normalizeOpeningHours, normalizeList } from "@/config/businessPageDefaults";
import SiteInquiryForm from "@/components/SiteInquiryForm";
import LoadingOverlay from "@/components/LoadingOverlay";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { deriveSiteTheme } from "@/lib/siteTheme";

const APPROVED_STATUS = "APPROVED";
const BUCKET = "site-assets";

function fallbackFavicon(title, color) {
  const initial = String(title || "B")
    .trim()
    .slice(0, 1)
    .toUpperCase()
    .replace(/[&<>"']/g, "");
  const safeColor = /^#[0-9a-f]{6}$/i.test(color || "") ? color : "#bf283b";
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    '<rect width="64" height="64" rx="14" fill="',
    safeColor,
    '"/>',
    '<text x="32" y="41" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff">',
    initial || "B",
    "</text></svg>",
  ].join("");
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function safeExternalUrl(value) {
  try {
    const url = new URL(typeof value === "string" ? value.trim() : "");
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function formatBusinessTime(value) {
  const [hourValue, minuteValue] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) return value || "";
  const suffix = hourValue >= 12 ? "PM" : "AM";
  const hour = hourValue % 12 || 12;
  return `${hour}:${String(minuteValue).padStart(2, "0")} ${suffix}`;
}

function getOpeningStatus(hours, now = new Date()) {
  const dayIndex = (now.getDay() + 6) % 7;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayKey = BUSINESS_DAYS[dayIndex].toLowerCase();
  const today = hours[todayKey];
  const toMinutes = (value) => {
    const [hour, minute] = String(value || "").split(":").map(Number);
    return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
  };
  const openMinutes = toMinutes(today?.open);
  const closeMinutes = toMinutes(today?.close);
  if (!today?.closed && openMinutes !== null && closeMinutes !== null) {
    if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
      return { label: `Open now · Closes ${formatBusinessTime(today.close)}`, open: true };
    }
    if (currentMinutes < openMinutes) {
      return { label: `Closed · Opens today at ${formatBusinessTime(today.open)}`, open: false };
    }
  }
  for (let offset = 1; offset <= 7; offset += 1) {
    const nextIndex = (dayIndex + offset) % 7;
    const next = hours[BUSINESS_DAYS[nextIndex].toLowerCase()];
    if (next && !next.closed) {
      return { label: `Closed · Opens ${BUSINESS_DAYS[nextIndex]} at ${formatBusinessTime(next.open)}`, open: false };
    }
  }
  return { label: "Closed", open: false };
}

const PREVIEW_ENDPOINTS = {
  id: (value) => `/api/sites/${encodeURIComponent(value)}/preview`,
  slug: (value) => `/api/sites/slug/${encodeURIComponent(value)}/preview`,
};

export default function TemplateOnePreview({ identifier = "", identifierType = "id" }) {
  const key = Array.isArray(identifier) ? identifier[0] : identifier;
  const normalizedIdentifier = typeof key === "string" ? key.trim() : `${key ?? ""}`;
  const normalizedType = PREVIEW_ENDPOINTS[identifierType] ? identifierType : "id";
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [site, setSite] = useState(null);
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [ownerActive, setOwnerActive] = useState(null);
  const [isSiteOwner, setIsSiteOwner] = useState(false);
  const [error, setError] = useState("");
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [directorySubmitting, setDirectorySubmitting] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [mobileHero, setMobileHero] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const requestIdRef = useRef(0);
  const siteRef = useRef(null);

  useEffect(() => {
    siteRef.current = site;
  }, [site]);

  const loadPreview = useCallback(async () => {
    if (!normalizedIdentifier) {
      setLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const endpointBuilder = PREVIEW_ENDPOINTS[normalizedType];
    if (!endpointBuilder) {
      setAllowed(false);
      setSite(null);
      setOwnerProfile(null);
      setOwnerActive(null);
      setError("Unable to load preview.");
      setLoading(false);
      return;
    }

    // Keep rendered preview content visible during background refreshes.
    setLoading((prev) => prev || !siteRef.current);
    setError("");

    try {
      const { data: initialSessionData } = await supabase.auth.getSession();
      const initialAccessToken = initialSessionData?.session?.access_token ?? null;
      let res = await fetch(endpointBuilder(normalizedIdentifier), {
        headers: initialAccessToken
          ? { Authorization: "Bearer " + initialAccessToken }
          : undefined,
        cache: "no-store",
      });

      if (res.status === 403) {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.warn("Failed to obtain session:", sessionError);
        }

        const accessToken = sessionData?.session?.access_token ?? null;
        if (accessToken) {
          res = await fetch(endpointBuilder(normalizedIdentifier), {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
          });
        }
      }

      if (requestIdRef.current !== requestId) {
        return;
      }

      if (res.ok) {
        const payload = await res.json();
        const fetchedSite = payload?.site ?? null;
        setSite(fetchedSite);
        setAllowed(true);
        setError("");
        setOwnerProfile(payload?.ownerProfile ?? null);
        setOwnerActive(typeof payload?.ownerActive === "boolean" ? payload.ownerActive : null);
        setIsSiteOwner(Boolean(payload?.isSiteOwner));
        return;
      }

      setAllowed(false);
      setSite(null);
      setOwnerProfile(null);
      setOwnerActive(null);
      setIsSiteOwner(false);

      if (res.status === 404) {
        setError("Site not found.");
        return;
      }

      if (res.status === 403) {
        const payload = await res.json().catch(() => null);
        if (payload?.reason === "publishing_not_started") {
          setError(
            "This website has not been published yet. Its owner must start the free trial or activate a subscription before this public link can be viewed.",
          );
        } else if (payload?.reason === "publishing_inactive") {
          setError(
            "This website is temporarily unavailable because its publishing plan is inactive or has expired. The owner can reactivate publishing from their dashboard.",
          );
        } else {
          setError("This website is private or is not currently available to the public.");
        }
        return;
      }

      const payload = await res.json().catch(() => null);
      const detail = typeof payload?.error === "string" ? ` (${payload.error})` : "";
      setError(`Unable to load preview${detail}.`);
    } catch (err) {
      if (requestIdRef.current !== requestId) {
        return;
      }
      console.error("Failed to load preview:", err);
      setAllowed(false);
      setSite(null);
      setOwnerProfile(null);
      setOwnerActive(null);
      setIsSiteOwner(false);
      setError("Unable to load preview.");
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [normalizedIdentifier, normalizedType]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    if (!normalizedIdentifier) {
      setLoading(false);
      setAllowed(false);
      setSite(null);
      setOwnerProfile(null);
      setOwnerActive(null);
      setIsSiteOwner(false);
      setError("");
    }
  }, [normalizedIdentifier]);

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
    const whatsapp = typeof contact.whatsapp === "string" ? contact.whatsapp.trim() : "";
    const address = typeof contact.address === "string" ? contact.address.trim() : "";
    const city =
      typeof site?.nearest_city === "string"
        ? site.nearest_city.trim()
        : typeof contact.city === "string"
        ? contact.city.trim()
        : "";
    return { email, phone, whatsapp, address, city };
  }, [
    site?.content_json?.contact?.email,
    site?.content_json?.contact?.phone,
    site?.content_json?.contact?.whatsapp,
    site?.content_json?.contact?.address,
    site?.nearest_city,
    site?.content_json?.contact?.city,
  ]);

  const theme = site?.content_json?.theme ?? {};
  const generatedTheme = deriveSiteTheme(theme?.primaryColor, theme?.mode);
  const topBarBackground = generatedTheme.primary;
  const topBarTextColor = generatedTheme.primaryText;
  const topBarFixed = Boolean(theme?.topBarFixed);
  const mainDescriptionTitleColor = generatedTheme.accent;
  const mainDescriptionTextColor = generatedTheme.text;
  const aboutTitleColor = generatedTheme.accent;
  const aboutTextColor = generatedTheme.text;
  const contactTitleColor = generatedTheme.accent;
  const contactTextColor = generatedTheme.text;
  const galleryTitleColor = generatedTheme.accent;
  const primaryColor = generatedTheme.primary;
  const storedStyle = site?.content_json?.template;
  const overallStyle = [
    "modern",
    "friendly",
    "elegant",
    "bold",
    "minimal",
    "showcase",
  ].includes(storedStyle)
    ? storedStyle
    : "modern";
  const fontClass =
    overallStyle === "elegant"
      ? "font-serif"
      : overallStyle === "friendly"
        ? "font-sans tracking-wide"
        : "font-sans";
  const openingHours = normalizeOpeningHours(site?.content_json?.openingHours);
  const catalog = normalizeList(site?.content_json?.catalog).filter((item) =>
    [item.name, item.description, item.price].some(
      (value) => typeof value === "string" && value.trim(),
    ),
  );
  const social = {
    facebook: safeExternalUrl(site?.content_json?.social?.facebook),
    instagram: safeExternalUrl(site?.content_json?.social?.instagram),
    tiktok: safeExternalUrl(site?.content_json?.social?.tiktok),
  };

  useEffect(() => {
    if (!site) return undefined;

    const iconHref = logoUrl || fallbackFavicon(site.title, primaryColor);
    const existingIcons = Array.from(
      document.head.querySelectorAll('link[rel~="icon"]'),
    );
    const icons =
      existingIcons.length > 0
        ? existingIcons
        : [document.createElement("link")];
    const originalIcons = icons.map((icon) => ({
      icon,
      href: icon.getAttribute("href"),
      rel: icon.getAttribute("rel"),
      type: icon.getAttribute("type"),
      attached: icon.isConnected,
    }));

    icons.forEach((icon) => {
      if (!icon.isConnected) {
        icon.rel = "icon";
        document.head.appendChild(icon);
      }
      icon.href = iconHref;
      icon.removeAttribute("type");
      icon.setAttribute("data-site-favicon", "true");
    });

    return () => {
      originalIcons.forEach(({ icon, href, rel, type, attached }) => {
        if (!attached) {
          icon.remove();
          return;
        }
        if (href === null) icon.removeAttribute("href");
        else icon.setAttribute("href", href);
        if (rel === null) icon.removeAttribute("rel");
        else icon.setAttribute("rel", rel);
        if (type === null) icon.removeAttribute("type");
        else icon.setAttribute("type", type);
        icon.removeAttribute("data-site-favicon");
      });
    };
  }, [site, logoUrl, primaryColor]);

  const hasGalleryImages = galleryImages.length > 0;
  const hasContactInfo = Boolean(
    contactInfo.email || contactInfo.phone || contactInfo.whatsapp,
  );
  const hasLocationInfo = Boolean(contactInfo.address || contactInfo.city);
  const locationQuery = [contactInfo.address, contactInfo.city]
    .filter(Boolean)
    .join(", ");
  const googleMapsUrl = locationQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery)}`
    : "";

  const rawPaidUntil = ownerProfile?.paid_until ? String(ownerProfile.paid_until) : "";

  const paidUntilDate = useMemo(() => {
    if (!rawPaidUntil) return null;
    const parsed = Date.parse(rawPaidUntil);
    if (Number.isNaN(parsed)) return null;
    const date = new Date(parsed);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [rawPaidUntil]);

  const isOwnerExpired = useMemo(() => {
    if (ownerActive === false) return true;
    if (!ownerProfile) return false;
    if (paidUntilDate) {
      return paidUntilDate.getTime() < Date.now();
    }
    return true;
  }, [ownerActive, ownerProfile, paidUntilDate]);

  const formattedPaidUntil = useMemo(() => {
    if (paidUntilDate) {
      try {
        return paidUntilDate.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } catch {
        return paidUntilDate.toISOString().split("T")[0];
      }
    }
    return rawPaidUntil;
  }, [paidUntilDate, rawPaidUntil]);

  useEffect(() => {
    setCurrentSlide(0);
  }, [site?.hero]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(media.matches);
    updatePreference();
    media.addEventListener?.("change", updatePreference);
    return () => media.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const updateMobile = () => {
      setMobileHero(media.matches);
      if (media.matches) setCurrentSlide(0);
    };
    updateMobile();
    media.addEventListener?.("change", updateMobile);
    return () => media.removeEventListener?.("change", updateMobile);
  }, []);

  useEffect(() => {
    if (heroImages.length <= 1 || heroPaused || reduceMotion || mobileHero) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => {
        const next = prev + 1;
        return next >= heroImages.length ? 0 : next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [heroImages.length, heroPaused, reduceMotion, mobileHero]);

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

  if (!normalizedIdentifier) {
    return (
      <div className="max-w-5xl mx-auto py-16">
        <h1 className="text-2xl font-semibold text-gray-900">Preview unavailable</h1>
        <p className="mt-4 text-gray-700">Missing site identifier.</p>
      </div>
    );
  }

  if (loading) {
    return <LoadingOverlay message="Loading website preview…" showRefresh={false} />;
  }

  if (!allowed) {
    return (
      <div className="max-w-5xl mx-auto py-16">
        <h1 className="text-2xl font-semibold text-gray-900">
          Website not publicly available
        </h1>
        {error ? <p className="mt-4 text-gray-700">{error}</p> : null}
      </div>
    );
  }

  const siteTitle = site?.title || "Preview Page";
  const siteDescription = site?.description || "";
  const mainDescriptionTitle =
    typeof site?.content_json?.mainDescriptionTitle === "string" &&
    site.content_json.mainDescriptionTitle.trim()
      ? site.content_json.mainDescriptionTitle.trim()
      : siteTitle;
  const lightboxImage = lightboxIndex !== null ? galleryImages[lightboxIndex] ?? null : null;
  const templateName = overallStyle;
  const templateClass =
    templateName === "elegant"
      ? "bg-stone-50"
      : templateName === "friendly"
        ? "bg-orange-50/30"
        : templateName === "minimal"
          ? "bg-white"
          : templateName === "bold"
            ? "bg-slate-950"
            : templateName === "showcase"
              ? "bg-neutral-950"
              : "bg-slate-50";
  const heroSectionClass =
    overallStyle === "friendly"
      ? "relative mx-auto mt-6 w-[calc(100%-2rem)] max-w-6xl overflow-hidden rounded-[2rem] bg-gray-100 shadow-lg"
      : overallStyle === "elegant"
        ? "relative w-full overflow-hidden border-y bg-stone-100"
        : overallStyle === "bold"
          ? "relative w-full overflow-hidden border-b-8 bg-slate-950"
          : overallStyle === "minimal"
            ? "relative mx-auto my-10 w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-sm bg-gray-100 shadow-sm"
            : overallStyle === "showcase"
              ? "relative w-full overflow-hidden bg-black"
              : "relative w-full overflow-hidden bg-gray-100";
  const heroHeightClass =
    overallStyle === "showcase"
      ? "relative h-[70vh] min-h-[440px] max-h-[760px] w-full"
      : overallStyle === "bold"
        ? "relative h-[520px] w-full"
        : overallStyle === "elegant"
          ? "relative h-[480px] w-full"
          : overallStyle === "friendly"
            ? "relative h-[380px] w-full"
            : overallStyle === "minimal"
              ? "relative h-[320px] w-full"
              : "relative h-[400px] w-full";
  const heroImageClass =
    overallStyle === "elegant"
      ? "object-cover object-center saturate-[0.8] contrast-[0.95]"
      : overallStyle === "bold"
        ? "object-cover object-center saturate-150 contrast-110 scale-[1.03]"
        : overallStyle === "minimal"
          ? "object-cover object-center saturate-[0.75]"
          : overallStyle === "showcase"
            ? "object-cover object-center scale-[1.02]"
            : "object-cover object-center";
  const configuredSections = normalizeSiteSections(site?.content_json?.sections);
  const sectionEnabled = (sectionId) =>
    configuredSections.find((section) => section.id === sectionId)?.enabled ?? false;
  const sectionOrder = (sectionId) => {
    const index = configuredSections.findIndex((section) => section.id === sectionId);
    return index < 0 ? configuredSections.length : index;
  };
  const hasMainDescription = Boolean(
    siteDescription.trim() ||
      (typeof site?.content_json?.mainDescriptionTitle === "string" &&
        site.content_json.mainDescriptionTitle.trim()),
  );
  const hasAboutContent = aboutParagraphs.length > 0;
  const hasOpeningHours = site?.content_json?.openingHoursConfigured === true;
  const openingStatus = getOpeningStatus(openingHours);
  const hasSocialLinks = Object.values(social).some(Boolean);
  const hasContactSection = Boolean(
    contactInfo.email || contactInfo.phone || contactInfo.whatsapp || hasSocialLinks,
  );
  const heroContent = site?.content_json?.heroContent || {};
  const heroHeadline = typeof heroContent.headline === "string" ? heroContent.headline.trim() : "";
  const heroTagline = typeof heroContent.tagline === "string" ? heroContent.tagline.trim() : "";
  const heroAction = typeof heroContent.action === "string" ? heroContent.action : "none";
  const heroActionConfig =
    heroAction === "services" && catalog.length > 0
      ? { label: "View products & services", href: "#services" }
      : heroAction === "call" && contactInfo.phone
        ? { label: "Call us", href: `tel:${contactInfo.phone.replace(/[^+\d]/g, "")}` }
        : heroAction === "whatsapp" && contactInfo.whatsapp
          ? { label: "WhatsApp", href: `https://wa.me/${contactInfo.whatsapp.replace(/\D/g, "")}` }
          : heroAction === "inquiry" && contactInfo.email
            ? { label: "Send inquiry", href: "#inquiry" }
            : null;
  const navItems = [
    sectionEnabled("services") && catalog.length > 0 ? ["Services", "#services"] : null,
    sectionEnabled("about") && hasAboutContent ? ["About", "#about"] : null,
    sectionEnabled("gallery") && hasGalleryImages ? ["Gallery", "#gallery"] : null,
    sectionEnabled("location") && hasLocationInfo ? ["Location", "#location"] : null,
    sectionEnabled("contact") && hasContactSection ? ["Contact", "#contact"] : null,
  ].filter(Boolean);
  const sectionStyle = {
    backgroundColor: generatedTheme.surface,
    color: generatedTheme.text,
    borderColor: generatedTheme.border,
  };
  const footerClass =
    overallStyle === "friendly"
      ? "mt-12 border-t px-4 py-10"
      : overallStyle === "elegant"
        ? "mt-16 border-t px-4 py-12"
        : overallStyle === "bold"
          ? "mt-12 border-t-[6px] px-4 py-10 uppercase tracking-wide"
          : overallStyle === "minimal"
            ? "mt-16 border-t px-4 py-8"
            : overallStyle === "showcase"
              ? "border-t px-4 py-12"
              : "mt-12 border-t px-4 py-10";
  const footerStyle =
    overallStyle === "modern"
      ? {
          backgroundColor: generatedTheme.primary,
          color: generatedTheme.primaryText,
          borderColor: generatedTheme.primary,
        }
      : overallStyle === "bold"
        ? { backgroundColor: "#0f172a", color: "#ffffff", borderColor: primaryColor }
        : overallStyle === "showcase"
          ? { backgroundColor: "#050505", color: "#ffffff", borderColor: "#262626" }
          : overallStyle === "friendly"
            ? {
                backgroundColor: generatedTheme.soft,
                color: generatedTheme.text,
                borderColor: generatedTheme.border,
              }
            : {
                backgroundColor: generatedTheme.page,
                color: generatedTheme.text,
                borderColor: generatedTheme.border,
              };

  const privateOwnerPreview = isOwnerExpired && Boolean(ownerProfile);
  const trialAlreadyUsed = Boolean(ownerProfile?.trial_used_at);

  const startPublishing = async () => {
    if (publishLoading || !site?.id) return;
    setPublishLoading(true);
    setPublishError("");
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error("Please sign in again before activating publishing.");
      }

      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: "BASIC", siteId: site.id }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.url) {
        throw new Error(
          payload?.error === "subscription_already_exists"
            ? "Your subscription is already active. Refresh the preview and try publishing again."
            : "Unable to open publishing checkout. Please try again.",
        );
      }

      const navigationWindow = window.top && window.top !== window ? window.top : window;
      navigationWindow.location.assign(payload.url);
    } catch (publishCheckoutError) {
      setPublishError(
        publishCheckoutError.message || "Unable to activate publishing.",
      );
      setPublishLoading(false);
    }
  };

  const requestDirectoryListing = async () => {
    if (directorySubmitting || !site?.id) return;
    setDirectorySubmitting(true);
    setDirectoryError("");
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error("Please sign in again before requesting a directory listing.");
      }

      const response = await fetch(
        "/api/sites/" + encodeURIComponent(site.id) + "/directory-listing",
        {
          method: "POST",
          headers: { Authorization: "Bearer " + accessToken },
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload?.error === "publishing_not_active"
            ? "Activate publishing before requesting a directory listing."
            : "Unable to request a directory listing. Please try again.",
        );
      }
      setSite((current) =>
        current ? { ...current, status: payload?.status || "SUBMITTED" } : current,
      );
    } catch (requestError) {
      setDirectoryError(
        requestError.message || "Unable to request a directory listing.",
      );
    } finally {
      setDirectorySubmitting(false);
    }
  };

  const copyPublicLink = async () => {
    if (!site?.slug) return;
    try {
      await navigator.clipboard.writeText(
        window.location.origin + "/" + site.slug + "-site",
      );
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      setDirectoryError("Unable to copy the link. Please copy it from the address bar.");
    }
  };

  return (
    <div
      className={`min-h-screen ${templateClass} ${fontClass}`}
      data-template={templateName}
      data-site-style={overallStyle}
      data-theme={generatedTheme.mode}
      style={{ backgroundColor: generatedTheme.page, color: generatedTheme.text }}
    >
      {privateOwnerPreview ? (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
          <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                Free private preview — keep creating and testing your website at
                no cost. Only you can see it while signed in; activate publishing
                when you are ready to share it publicly.
              </p>
              {publishError ? (
                <p className="mt-1 text-xs font-medium text-red-700" role="alert">
                  {publishError}
                </p>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
              <a
                href={`/sites/${encodeURIComponent(site.id)}/edit?step=5`}
                target="_top"
                className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-amber-500 bg-white px-4 py-2 text-center text-sm font-semibold text-amber-950 hover:bg-amber-100 sm:w-auto"
              >
                Continue editing
              </a>
              <button
                type="button"
                onClick={startPublishing}
                disabled={publishLoading}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#BF283B] px-4 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-[#a32131] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {publishLoading
                  ? "Opening checkout…"
                  : trialAlreadyUsed
                    ? "Subscribe & publish"
                    : "Start free trial & publish"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isSiteOwner && ownerActive ? (
        <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950">
          <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                Your website is live and ready to share.
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-emerald-900">
                <a
                  href={"/" + site.slug + "-site"}
                  className="font-medium underline underline-offset-2"
                >
                  {(typeof window === "undefined" ? "" : window.location.origin) +
                    "/" +
                    site.slug +
                    "-site"}
                </a>
                <button
                  type="button"
                  onClick={copyPublicLink}
                  className="rounded border border-emerald-300 bg-white px-2 py-0.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                >
                  {linkCopied ? "Copied" : "Copy link"}
                </button>
              </div>
              {directoryError ? (
                <p className="mt-2 text-xs font-medium text-red-700" role="alert">
                  {directoryError}
                </p>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
              <a
                href={"/sites/" + encodeURIComponent(site.id) + "/edit?step=5"}
                target="_top"
                className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-emerald-400 bg-white px-4 py-2 text-center text-sm font-semibold text-emerald-950 hover:bg-emerald-100 sm:w-auto"
              >
                Continue editing
              </a>
              {site.status === "APPROVED" ? (
                <span className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-center text-sm font-semibold text-white">
                  Listed in directory
                </span>
              ) : site.status === "SUBMITTED" ? (
                <span className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-300 bg-white px-4 py-2 text-center text-sm font-semibold text-emerald-950">
                  Directory review requested
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <details className="group relative">
                    <summary
                      className="flex h-9 w-9 cursor-help list-none items-center justify-center rounded-full border border-emerald-300 bg-white text-sm font-bold text-emerald-900"
                      aria-label="What is directory listing?"
                    >
                      i
                    </summary>
                    <p className="absolute bottom-full right-0 z-20 mb-2 w-72 rounded-lg border border-emerald-200 bg-white p-3 text-xs font-medium leading-5 text-emerald-950 shadow-lg">
                      Your website is already live. This sends it to our team for
                      review before it appears in the Lankan business directory.
                    </p>
                  </details>
                  <button
                    type="button"
                    onClick={requestDirectoryListing}
                    disabled={directorySubmitting}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#BF283B] px-4 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-[#a32131] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {directorySubmitting
                      ? "Requesting…"
                      : "Apply for directory listing"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <header
        className={topBarFixed ? "sticky top-0 z-40" : undefined}
        style={{
          backgroundColor: topBarBackground,
          color: topBarTextColor,
        }}
      >
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
            ) : null}
            <span className="text-lg font-semibold">{siteTitle}</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            {navItems.map(([label, href]) => <a key={href} href={href} className="opacity-100 transition-opacity hover:opacity-80">{label}</a>)}
          </nav>
          {navItems.length > 0 ? <button type="button" className="rounded-lg border border-white/30 px-3 py-2 text-sm md:hidden" onClick={() => setMobileMenuOpen((open) => !open)} aria-expanded={mobileMenuOpen} aria-label="Toggle navigation menu">Menu</button> : null}
        </div>
        {mobileMenuOpen ? <nav className="border-t border-white/20 px-4 py-3 md:hidden"><div className="mx-auto grid max-w-6xl gap-1">{navItems.map(([label, href]) => <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="rounded px-3 py-2 text-sm font-medium hover:bg-white/10">{label}</a>)}</div></nav> : null}
      </header>
      <div className="flex flex-col">
      {sectionEnabled("hero") && heroImages.length > 0 ? (
        <section
          className={heroSectionClass}
          style={{ order: sectionOrder("hero") }}
          onMouseEnter={() => setHeroPaused(true)}
          onMouseLeave={() => setHeroPaused(false)}
          onFocusCapture={() => setHeroPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setHeroPaused(false);
          }}
          aria-roledescription="carousel"
        >
          <div className={heroHeightClass}>
            {heroImages.map((src, idx) => (
              <Image
                key={src}
                src={src}
                alt={`Hero image ${idx + 1}`}
                fill
                priority={idx === 0}
                className={`absolute inset-0 h-full w-full transition-all ${overallStyle === "elegant" ? "duration-1000" : "duration-700"} ${heroImageClass} ${
                  idx === currentSlide ? "opacity-100" : "opacity-0"
                }`}
                sizes="100vw"
              />
            ))}

            {heroImages.length > 1 && !mobileHero ? (
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
            {overallStyle === "bold" ? <div className="pointer-events-none absolute inset-y-0 left-0 w-3" style={{ backgroundColor: primaryColor }} /> : null}
            {overallStyle === "showcase" ? <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" /> : null}
            {heroHeadline || heroTagline || heroActionConfig ? (
              <div className={`absolute inset-0 z-[5] flex px-8 py-12 text-white ${overallStyle === "friendly" || overallStyle === "showcase" ? "items-center justify-center text-center" : overallStyle === "elegant" ? "items-end justify-start" : "items-center justify-start"}`}>
                <div className={`max-w-2xl ${overallStyle === "friendly" ? "rounded-3xl bg-black/55 p-7 backdrop-blur-sm" : "rounded-xl bg-gradient-to-r from-black/75 to-black/20 p-7"}`}>
                  {heroHeadline ? <h1 className="text-3xl font-bold leading-tight sm:text-5xl">{heroHeadline}</h1> : null}
                  {heroTagline ? <p className="mt-3 max-w-xl text-base leading-relaxed text-white/90 sm:text-lg">{heroTagline}</p> : null}
                  {heroActionConfig ? <a href={heroActionConfig.href} className="mt-6 inline-flex rounded-lg px-5 py-3 text-sm font-semibold shadow-lg" style={{ backgroundColor: primaryColor, color: generatedTheme.primaryText }}>{heroActionConfig.label}</a> : null}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {sectionEnabled("services") && catalog.length > 0 ? (
        <section
          id="services"
          className="border-b border-red-100 bg-red-50/40"
          style={{ order: sectionOrder("services"), backgroundColor: generatedTheme.soft, borderColor: generatedTheme.border }}
        >
          <div className="mx-auto max-w-5xl px-4 py-8">
            <h2 className="text-2xl font-semibold" style={{ color: primaryColor }}>Products and Services</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.map((item, index) => (
                <article key={`${item.name || "item"}-${index}`} className="rounded-xl border p-5 shadow-sm" style={sectionStyle}>
                  <h3 className="font-semibold">{item.name || "Product or service"}</h3>
                  {item.description ? <p className="mt-2 text-sm" style={{ color: generatedTheme.muted }}>{item.description}</p> : null}
                  {item.price ? <p className="mt-3 font-semibold" style={{ color: generatedTheme.accent }}>{item.price}</p> : null}
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <main className="contents">
        {sectionEnabled("about") && (hasMainDescription || hasAboutContent) ? (
        <div
          id="about"
          className="mx-auto w-full max-w-5xl px-4 py-12"
          style={{ order: sectionOrder("about") }}
        >
        {hasMainDescription ? <div className="site-content-section flex flex-col gap-6 rounded-3xl border p-10 shadow-sm" style={sectionStyle}>
          <div>
            
            <h1 className="mt-4 text-4xl font-bold text-gray-900">
              <span style={{ color: mainDescriptionTitleColor }}>
                {mainDescriptionTitle}
              </span>
            </h1>
            {siteDescription ? (
              <p
                className="mt-4 text-lg leading-relaxed"
                style={{ color: mainDescriptionTextColor }}
              >
                {siteDescription}
              </p>
            ) : (
              <p className="mt-4 text-lg leading-relaxed text-gray-500">
                {/* Discover what makes this site special. The creator will add more details soon. */}
              </p>
            )}
          </div>
        </div> : null}

        {hasAboutContent ? <section className={`site-content-section ${hasMainDescription ? "mt-12" : ""} rounded-2xl border p-8 shadow-sm`} style={sectionStyle}>
          <h2
            className="text-2xl font-semibold"
            style={{ color: aboutTitleColor }}
          >
            About {siteTitle}
          </h2>
          <div
            className="mt-4 space-y-4 text-base leading-relaxed"
            style={{ color: aboutTextColor }}
          >
            {aboutParagraphs.map((paragraph, idx) => <p key={idx}>{paragraph}</p>)}
          </div>
        </section> : null}
        </div>
        ) : null}

        {sectionEnabled("openingHours") && hasOpeningHours ? (
          <section className="site-content-section mx-auto my-12 w-[calc(100%-2rem)] max-w-5xl rounded-2xl border p-8 shadow-sm" style={{ ...sectionStyle, order: sectionOrder("openingHours") }}>
            <h2 className="text-2xl font-semibold" style={{ color: primaryColor }}>Opening Hours</h2>
            <p className="mt-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold" style={{ backgroundColor: openingStatus.open ? "#dcfce7" : generatedTheme.soft, color: openingStatus.open ? "#166534" : generatedTheme.text }}>{openingStatus.label}</p>
            <dl className="mt-6 divide-y divide-gray-100">
              {BUSINESS_DAYS.map((label) => {
                const row = openingHours[label.toLowerCase()];
                return <div key={label} className="flex justify-between gap-4 py-2 text-sm"><dt className="font-medium">{label}</dt><dd style={{ color: generatedTheme.muted }}>{row.closed ? "Closed" : `${row.open} – ${row.close}`}</dd></div>;
              })}
            </dl>
          </section>
        ) : null}

        {sectionEnabled("gallery") && hasGalleryImages ? (
        <section
          id="gallery"
          className="site-content-section mx-auto my-12 w-[calc(100%-2rem)] max-w-5xl rounded-2xl border border-red-100 bg-white p-8 shadow-sm"
          style={{ ...sectionStyle, order: sectionOrder("gallery") }}
        >
          <h2
            className="text-2xl font-semibold"
            style={{ color: galleryTitleColor }}
          >
            Gallery
          </h2>
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
        ) : null}


        {sectionEnabled("location") && hasLocationInfo ? (
        <section
          id="location"
          className="site-content-section mx-auto my-12 w-[calc(100%-2rem)] max-w-5xl rounded-2xl border border-red-100 bg-white p-8 shadow-sm"
          style={{ ...sectionStyle, order: sectionOrder("location") }}
        >
          <h2
            className="text-2xl font-semibold"
            style={{ color: contactTitleColor }}
          >
            Location
          </h2>
          {hasLocationInfo ? (
            <div className="mt-6" style={{ color: contactTextColor }}>
              {contactInfo.address ? <p>{contactInfo.address}</p> : null}
              {contactInfo.city ? (
                <p className="mt-1 text-sm text-gray-500">{contactInfo.city}</p>
              ) : null}
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex rounded-lg px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: primaryColor, color: generatedTheme.primaryText }}
              >
                View on Google Maps
              </a>
            </div>
          ) : (
            <p className="mt-4 text-base text-gray-500">
              Location details will be added soon.
            </p>
          )}
        </section>
        ) : null}

        {sectionEnabled("inquiry") && Boolean(contactInfo.email) ? (
          <section id="inquiry" className="site-content-section mx-auto my-12 w-[calc(100%-2rem)] max-w-5xl rounded-2xl border p-8 shadow-sm" style={{ ...sectionStyle, order: sectionOrder("inquiry") }}>
            <h2 className="text-2xl font-semibold" style={{ color: primaryColor }}>Send an Inquiry</h2>
            {contactInfo.email ? (
              <SiteInquiryForm
                siteId={site.id}
                primaryColor={primaryColor}
                primaryTextColor={generatedTheme.primaryText}
                fieldBackground={generatedTheme.page}
                fieldTextColor={generatedTheme.text}
                fieldPlaceholderColor={generatedTheme.muted}
                fieldBorderColor={generatedTheme.border}
                previewOnly={privateOwnerPreview}
              />
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                Online inquiries are unavailable until a contact email is added.
              </p>
            )}
          </section>
        ) : null}

        {sectionEnabled("contact") && hasContactSection ? (
        <section
          id="contact"
          className="site-content-section mx-auto my-12 w-[calc(100%-2rem)] max-w-5xl rounded-2xl border border-red-100 bg-white p-8 shadow-sm"
          style={{ ...sectionStyle, order: sectionOrder("contact") }}
        >
          <h2
            className="text-2xl font-semibold"
            style={{ color: contactTitleColor }}
          >
            Get in touch
          </h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {contactInfo.phone ? <a href={`tel:${contactInfo.phone.replace(/[^+\d]/g, "")}`} className="rounded-lg px-5 py-3 text-sm font-semibold" style={{ backgroundColor: primaryColor, color: generatedTheme.primaryText }}>Call</a> : null}
            {contactInfo.whatsapp ? <a target="_blank" rel="noopener noreferrer" href={`https://wa.me/${contactInfo.whatsapp.replace(/\D/g, "")}`} className="rounded-lg px-5 py-3 text-sm font-semibold" style={{ backgroundColor: "#16a34a", color: "#ffffff" }}>WhatsApp</a> : null}
            {hasLocationInfo ? <a href="#location" className="rounded-lg border px-5 py-3 text-sm font-semibold" style={{ borderColor: generatedTheme.accent, color: generatedTheme.accent }}>Directions</a> : null}
            {contactInfo.email ? <a href="#inquiry" className="rounded-lg border px-5 py-3 text-sm font-semibold" style={{ borderColor: generatedTheme.accent, color: generatedTheme.accent }}>Send inquiry</a> : null}
          </div>
          {hasContactInfo ? (
            <dl className="mt-8 grid gap-8 border-t pt-6 sm:grid-cols-2" style={{ borderColor: generatedTheme.border }}>
              <div>
                <dt className="text-sm font-semibold uppercase tracking-wide text-gray-500">Email</dt>
                <dd className="mt-2 text-base" style={{ color: contactTextColor }}>
                  {contactInfo.email ? (
                    <a
                      href={`mailto:${contactInfo.email}`}
                      className="hover:underline"
                      style={{ color: contactTextColor }}
                    >
                      {contactInfo.email}
                    </a>
                  ) : (
                    <span className="text-gray-400">Not provided</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold uppercase tracking-wide text-gray-500">Phone</dt>
                <dd className="mt-2 text-base" style={{ color: contactTextColor }}>
                  {contactInfo.phone ? (
                    <a
                      href={`tel:${contactInfo.phone.replace(/[^+\d]/g, "")}`}
                      className="hover:underline"
                      style={{ color: contactTextColor }}
                    >
                      {contactInfo.phone}
                    </a>
                  ) : (
                    <span className="text-gray-400">Not provided</span>
                  )}
                </dd>
              </div>
              {contactInfo.whatsapp ? (
                <div>
                  <dt className="text-sm font-semibold uppercase tracking-wide text-gray-500">WhatsApp</dt>
                  <dd className="mt-2 text-base" style={{ color: contactTextColor }}>
                    <a
                      href={`https://wa.me/${contactInfo.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                      style={{ color: contactTextColor }}
                    >
                      {contactInfo.whatsapp}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-4 text-base text-gray-500">Contact details will be added soon.</p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {Object.entries({ Facebook: social.facebook, Instagram: social.instagram, TikTok: social.tiktok }).map(([label, url]) => url ? <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="rounded border px-4 py-2 text-sm font-medium" style={{ borderColor: generatedTheme.accent, color: generatedTheme.accent }}>{label}</a> : null)}
          </div>
        </section>
        ) : null}
      </main>
      </div>

      <footer className={footerClass} style={footerStyle}>
        <div className="mx-auto grid max-w-6xl items-center gap-6 text-center text-sm md:grid-cols-3 md:text-left">
          <p className={overallStyle === "bold" ? "text-xs font-semibold" : "font-medium"}>
            Copyright © {siteTitle} {new Date().getUTCFullYear()}
          </p>
          <p className="text-xs opacity-55 md:text-center">
            Site by{" "}
            <a
              href="https://lankan.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 transition-opacity hover:opacity-100 hover:underline"
            >
              lankan.org
            </a>
          </p>
          {navItems.length > 0 ? (
            <nav
              aria-label="Footer navigation"
              className="flex flex-wrap justify-center gap-x-5 gap-y-2 md:justify-end"
            >
              {navItems.map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  className="font-medium opacity-75 transition-opacity hover:opacity-100"
                >
                  {label}
                </a>
              ))}
            </nav>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
      </footer>

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
