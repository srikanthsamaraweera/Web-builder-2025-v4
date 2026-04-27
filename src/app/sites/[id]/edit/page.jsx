"use client";

import { useEffect, useMemo, useState, useRef, useId } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import LoadingOverlay from "@/components/LoadingOverlay";
import { processImage } from "@/lib/image";

const BUCKET = "site-assets";
const DEFAULT_TOP_BAR_BACKGROUND = "#b91c1c";
const DEFAULT_TOP_BAR_TEXT = "#ffffff";
const DEFAULT_MAIN_DESCRIPTION_TITLE_COLOR = "#111827";
const DEFAULT_MAIN_DESCRIPTION_TEXT_COLOR = "#374151";
const DEFAULT_ABOUT_TITLE_COLOR = "#b91c1c";
const DEFAULT_ABOUT_TEXT_COLOR = "#374151";
const DEFAULT_CONTACT_TITLE_COLOR = "#b91c1c";
const DEFAULT_CONTACT_TEXT_COLOR = "#1f2937";
const DEFAULT_GALLERY_TITLE_COLOR = "#b91c1c";
const DEFAULT_SERVICE_CHIP_BACKGROUND = "#fee2e2";
const DEFAULT_SERVICE_CHIP_TEXT = "#991b1b";
const HEX_COLOR_RE = /^#([0-9a-f]{6})$/i;

function normalizeHexColor(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^#([0-9a-f]{3})$/i.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toLowerCase()}`;
  }
  if (HEX_COLOR_RE.test(trimmed)) return trimmed.toLowerCase();
  return fallback;
}

function slugify(input) {
  console.log("slugify function works");
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

export default function EditSitePage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cameFromAdmin = searchParams.get("from") === "admin";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [site, setSite] = useState(null);
  const [profile, setProfile] = useState(null);
  const [title, setTitle] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [about, setAbout] = useState("");
  const [mainDescriptionTitle, setMainDescriptionTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [contactCity, setContactCity] = useState("");
  const [topBarBackground, setTopBarBackground] = useState(
    DEFAULT_TOP_BAR_BACKGROUND,
  );
  const [topBarTextColor, setTopBarTextColor] = useState(DEFAULT_TOP_BAR_TEXT);
  const [topBarFixed, setTopBarFixed] = useState(false);
  const [mainDescriptionTitleColor, setMainDescriptionTitleColor] = useState(
    DEFAULT_MAIN_DESCRIPTION_TITLE_COLOR,
  );
  const [mainDescriptionTextColor, setMainDescriptionTextColor] = useState(
    DEFAULT_MAIN_DESCRIPTION_TEXT_COLOR,
  );
  const [aboutTitleColor, setAboutTitleColor] = useState(
    DEFAULT_ABOUT_TITLE_COLOR,
  );
  const [aboutTextColor, setAboutTextColor] = useState(
    DEFAULT_ABOUT_TEXT_COLOR,
  );
  const [contactTitleColor, setContactTitleColor] = useState(
    DEFAULT_CONTACT_TITLE_COLOR,
  );
  const [contactTextColor, setContactTextColor] = useState(
    DEFAULT_CONTACT_TEXT_COLOR,
  );
  const [galleryTitleColor, setGalleryTitleColor] = useState(
    DEFAULT_GALLERY_TITLE_COLOR,
  );
  const [serviceChipBackgroundColor, setServiceChipBackgroundColor] = useState(
    DEFAULT_SERVICE_CHIP_BACKGROUND,
  );
  const [serviceChipTextColor, setServiceChipTextColor] = useState(
    DEFAULT_SERVICE_CHIP_TEXT,
  );
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [detectingCity, setDetectingCity] = useState(false);
  const [cityError, setCityError] = useState("");
  const [servicesText, setServicesText] = useState("");
  const [logo, setLogo] = useState("");
  const [hero, setHero] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");
  const [enteredDeleteCode, setEnteredDeleteCode] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const cityFetchAbortRef = useRef(null);
  const rawCityId = useId();
  const citySuggestionsListId = useMemo(
    () => `city-options-${rawCityId.replace(/:/g, "")}`,
    [rawCityId],
  );

  useEffect(() => {
    setSlug(slugify(slugInput));
  }, [slugInput]);

  useEffect(() => {
    return () => {
      try {
        cityFetchAbortRef.current?.abort?.();
      } catch {}
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    let unsub = null;
    let safetyTimer = null;

    const fetchSiteForEditor = async (session, isAdminUser) => {
      if (isAdminUser && cameFromAdmin) {
        const resp = await fetch(
          `/api/admin/sites/detail?id=${encodeURIComponent(id)}`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
          },
        );
        const json = await resp.json();
        if (!resp.ok) throw new Error(json?.error || "Failed to load site");
        return json.site || null;
      }

      const { data, error: selErr } = await supabase
        .from("sites")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (selErr) throw selErr;
      return data || null;
    };

    const loadForSession = async (session) => {
      console.log("loadforsession starts");
      try {
        const userId = session.user.id;
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("paid_until, role")
          .eq("id", userId)
          .maybeSingle();
        if (profErr) throw profErr;
        const isAdmin = (prof?.role || "USER") === "ADMIN";
        const data = await fetchSiteForEditor(session, isAdmin);
        if (!data || (!isAdmin && data.owner !== userId)) {
          router.replace("/dashboard/home");
          return;
        }
        if (canceled) return;
        setProfile(prof || null);
        setSite(data);
        setTitle(data.title || "");
        setSlugInput(data.slug || "");
        setDescription(data.description || "");
        setStatus(data.status || "DRAFT");
        const cj = data.content_json || {};
        setAbout(cj.about || "");
        setMainDescriptionTitle(cj.mainDescriptionTitle || "");
        setContactEmail(cj.contact?.email || "");
        setContactPhone(cj.contact?.phone || "");
        setContactAddress(cj.contact?.address || "");
        setContactCity(data.nearest_city || cj.contact?.city || "");
        setTopBarBackground(
          normalizeHexColor(
            cj.theme?.topBarBackground,
            DEFAULT_TOP_BAR_BACKGROUND,
          ),
        );
        setTopBarTextColor(
          normalizeHexColor(cj.theme?.topBarText, DEFAULT_TOP_BAR_TEXT),
        );
        setTopBarFixed(Boolean(cj.theme?.topBarFixed));
        setMainDescriptionTitleColor(
          normalizeHexColor(
            cj.theme?.mainDescriptionTitleColor,
            DEFAULT_MAIN_DESCRIPTION_TITLE_COLOR,
          ),
        );
        setMainDescriptionTextColor(
          normalizeHexColor(
            cj.theme?.mainDescriptionTextColor,
            DEFAULT_MAIN_DESCRIPTION_TEXT_COLOR,
          ),
        );
        setAboutTitleColor(
          normalizeHexColor(
            cj.theme?.aboutTitleColor,
            DEFAULT_ABOUT_TITLE_COLOR,
          ),
        );
        setAboutTextColor(
          normalizeHexColor(
            cj.theme?.aboutTextColor,
            DEFAULT_ABOUT_TEXT_COLOR,
          ),
        );
        setContactTitleColor(
          normalizeHexColor(
            cj.theme?.contactTitleColor,
            DEFAULT_CONTACT_TITLE_COLOR,
          ),
        );
        setContactTextColor(
          normalizeHexColor(
            cj.theme?.contactTextColor,
            DEFAULT_CONTACT_TEXT_COLOR,
          ),
        );
        setGalleryTitleColor(
          normalizeHexColor(
            cj.theme?.galleryTitleColor,
            DEFAULT_GALLERY_TITLE_COLOR,
          ),
        );
        setServiceChipBackgroundColor(
          normalizeHexColor(
            cj.theme?.serviceChipBackgroundColor,
            DEFAULT_SERVICE_CHIP_BACKGROUND,
          ),
        );
        setServiceChipTextColor(
          normalizeHexColor(
            cj.theme?.serviceChipTextColor,
            DEFAULT_SERVICE_CHIP_TEXT,
          ),
        );
        setServicesText(
          Array.isArray(cj.services) ? cj.services.join("\n") : "",
        );
        setLogo(data.logo || "");
        setHero(Array.isArray(data.hero) ? data.hero : []);
        setGallery(Array.isArray(data.gallery) ? data.gallery : []);
      } catch (e) {
        if (!canceled) setError(e.message || "Failed to load site");
      } finally {
        if (!canceled) setLoading(false);
      }
      console.log("loadforsession ends");
    };

    (async () => {
      console.log("session retrieval start");
      const { data } = await supabase.auth.getSession();
      const session = data?.session || null;
      if (session) {
        await loadForSession(session);
        return;
      }
      // Safety net: if no session arrives within 6s, re-check and redirect if still missing
      safetyTimer = setTimeout(async () => {
        if (canceled) return;
        try {
          console.log("safety timer fired -> rechecking session");
          const { data: d2 } = await supabase.auth.getSession();
          const s2 = d2?.session || null;
          if (s2) {
            await loadForSession(s2);
          } else {
            setLoading(false);
            router.replace("/login");
          }
        } catch {
          setLoading(false);
          router.replace("/login");
        }
      }, 6000);

      const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
        console.log("onAuthStateChange", { event, hasSession: !!sess });
        if (
          (event === "INITIAL_SESSION" ||
            event === "SIGNED_IN" ||
            event === "TOKEN_REFRESHED" ||
            event === "USER_UPDATED") &&
          sess
        ) {
          try {
            sub.subscription.unsubscribe();
          } catch {}
          if (safetyTimer) {
            try {
              clearTimeout(safetyTimer);
            } catch {}
          }
          loadForSession(sess);
        } else if (
          event === "SIGNED_OUT" ||
          (event === "INITIAL_SESSION" && !sess)
        ) {
          if (safetyTimer) {
            try {
              clearTimeout(safetyTimer);
            } catch {}
          }
          setLoading(false);
          router.replace("/login");
        }
      });
      unsub = () => {
        try {
          sub.subscription.unsubscribe();
        } catch {}
        if (safetyTimer) {
          try {
            clearTimeout(safetyTimer);
          } catch {}
        }
      };
      console.log("session retrieval end");
    })();

    return () => {
      canceled = true;
      if (unsub) unsub();
      if (safetyTimer) {
        try {
          clearTimeout(safetyTimer);
        } catch {}
      }
    };
  }, [id, router]);

  useEffect(() => {
    let active = true;
    if (!site) return;
    if (!slug || !/^[a-z0-9-]{3,30}$/.test(slug)) {
      setSlugAvailable(false);
      return;
    }
    setCheckingSlug(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/sites/slug-available?slug=${encodeURIComponent(slug)}&excludeId=${encodeURIComponent(site.id)}`,
        );
        const json = await res.json();
        if (!active) return;
        setSlugAvailable(!!json.available);
      } catch (e) {
        if (!active) return;
        setSlugAvailable(false);
      } finally {
        if (active) setCheckingSlug(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [slug, site]);

  const generateDeleteCode = () => {
    const min = 1_000_000_000;
    return String(Math.floor(min + Math.random() * 9_000_000_000));
  };

  const openDeleteModal = () => {
    setDeleteCode(generateDeleteCode());
    setEnteredDeleteCode("");
    setDeleteError("");
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setShowDeleteModal(false);
    setEnteredDeleteCode("");
    setDeleteError("");
  };

  const confirmDelete = async () => {
    const trimmed = enteredDeleteCode.trim();
    if (!deleteCode || trimmed !== deleteCode) {
      setDeleteError("Verification code does not match.");
      return;
    }
    setDeleting(true);
    setDeleteError("");
    try {
      const isAdminUser = (profile?.role || "USER") === "ADMIN";
      if (isAdminUser && cameFromAdmin) {
        const { data: auth } = await supabase.auth.getSession();
        const session = auth?.session;
        if (!session) throw new Error("Not signed in");
        const resp = await fetch(
          `/api/admin/sites/detail?id=${encodeURIComponent(id)}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          },
        );
        if (!resp.ok) throw new Error("Failed to delete site.");
        router.replace("/admin/sites");
      } else {
        const { error: delErr } = await supabase
          .from("sites")
          .delete()
          .eq("id", id);
        if (delErr) throw delErr;
        router.replace("/dashboard/home");
      }
    } catch (e) {
      setDeleteError(e.message || "Failed to delete site.");
    } finally {
      setDeleting(false);
    }
  };

  const previewUrl = (path) =>
    path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : "";

  const uploadFile = async (file, kind) => {
    const opts =
      kind === "logo"
        ? { maxWidth: 512, maxHeight: 512, quality: 0.9 }
        : kind === "hero"
          ? { maxWidth: 1400, maxHeight: 900, quality: 0.8 }
          : { maxWidth: 1200, maxHeight: 900, quality: 0.75 };

    const processed = await processImage(file, opts);
    // Hard cap 2MB after processing
    if (processed.size > 2 * 1024 * 1024) {
      throw new Error("Image too large after compression (max 2MB)");
    }
    const isAdminUser = (profile?.role || "USER") === "ADMIN";
    if (isAdminUser && cameFromAdmin) {
      const { data: auth } = await supabase.auth.getSession();
      const session = auth?.session;
      if (!session) throw new Error("Not signed in");

      const form = new FormData();
      form.append("id", site.id);
      form.append("kind", kind);
      form.append("file", processed);

      const resp = await fetch("/api/admin/sites/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: form,
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Failed to upload image");
      return json.path;
    }

    const safeName = processed.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${site.owner}/${site.id}/${kind}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, processed, {
        cacheControl: "31536000",
        upsert: false,
      });
    if (upErr) throw upErr;
    return path;
  };

  const buildCityCandidates = (payload) => {
    const seen = new Set();
    const candidates = [];
    const add = (value) => {
      if (!value || typeof value !== "string") return;
      const cleaned = value.trim();
      if (!cleaned || seen.has(cleaned.toLowerCase())) return;
      seen.add(cleaned.toLowerCase());
      candidates.push(cleaned);
    };

    add(payload?.city);
    add(payload?.locality);
    add(payload?.principalSubdivision);

    const adminList = payload?.localityInfo?.administrative || [];
    adminList.forEach((entry) => add(entry?.name));

    const informativeList = payload?.localityInfo?.informative || [];
    informativeList.forEach((entry) => add(entry?.name));

    return candidates.slice(0, 6);
  };

  const updateCityField = (value) => {
    setContactCity(value);
    setCityError("");
  };

  const fetchCitySuggestionsForCoords = async (latitude, longitude) => {
    try {
      cityFetchAbortRef.current?.abort?.();
      const controller = new AbortController();
      cityFetchAbortRef.current = controller;

      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        localityLanguage: "en",
      });

      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error("City lookup failed.");

      const payload = await response.json();
      const suggestions = buildCityCandidates(payload);
      setCitySuggestions(suggestions);
      if (!contactCity && suggestions.length > 0) {
        updateCityField(suggestions[0]);
      }
      setCityError("");
    } catch (err) {
      if (err?.name === "AbortError") return;
      console.warn("City lookup failed", err);
      setCityError(err?.message || "Unable to detect nearest cities.");
      setCitySuggestions([]);
    } finally {
      setDetectingCity(false);
      cityFetchAbortRef.current = null;
    }
  };

  const detectCityFromBrowser = () => {
    if (detectingCity) return;
    if (typeof window === "undefined") return;
    if (!navigator?.geolocation) {
      setCityError("Geolocation is not supported in this browser.");
      return;
    }
    setDetectingCity(true);
    setCityError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchCitySuggestionsForCoords(
          position.coords.latitude,
          position.coords.longitude,
        );
      },
      (geoError) => {
        console.warn("Geolocation error", geoError);
        setCityError(
          geoError?.message === "User denied Geolocation"
            ? "Permission to access location was denied."
            : "Unable to access your location.",
        );
        setDetectingCity(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
      },
    );
  };

  const countWords = (s) => (s?.trim() ? s.trim().split(/\s+/).length : 0);
  const shouldResetOwnerStatusToDraft = () =>
    (profile?.role || "USER") !== "ADMIN" &&
    !["DRAFT", "SUBMITTED"].includes((status || "").toUpperCase());
  const withOwnerDraftStatus = (payload) =>
    shouldResetOwnerStatusToDraft() ? { ...payload, status: "DRAFT" } : payload;

  const onSave = async (e, nextStatus) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      // Validate word limits
      if (countWords(about) > 100)
        throw new Error("About must be 100 words or fewer");
      if (countWords(servicesText) > 100)
        throw new Error("Services must be 100 words or fewer");

      // Build content_json from fields
      const existingContent = site?.content_json || {};
      const contentPayload = {
        ...existingContent,
        about: about || "",
        mainDescriptionTitle: mainDescriptionTitle.trim(),
        contact: {
          ...(existingContent.contact || {}),
          email: contactEmail || "",
          phone: contactPhone || "",
          address: contactAddress || "",
          city: contactCity || "",
        },
        services: servicesText
          ? servicesText
              .split(/\r?\n/) // one per line
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        theme: {
          ...(existingContent.theme || {}),
          topBarBackground: normalizeHexColor(
            topBarBackground,
            DEFAULT_TOP_BAR_BACKGROUND,
          ),
          topBarText: normalizeHexColor(topBarTextColor, DEFAULT_TOP_BAR_TEXT),
          topBarFixed: Boolean(topBarFixed),
          mainDescriptionTitleColor: normalizeHexColor(
            mainDescriptionTitleColor,
            DEFAULT_MAIN_DESCRIPTION_TITLE_COLOR,
          ),
          mainDescriptionTextColor: normalizeHexColor(
            mainDescriptionTextColor,
            DEFAULT_MAIN_DESCRIPTION_TEXT_COLOR,
          ),
          aboutTitleColor: normalizeHexColor(
            aboutTitleColor,
            DEFAULT_ABOUT_TITLE_COLOR,
          ),
          aboutTextColor: normalizeHexColor(
            aboutTextColor,
            DEFAULT_ABOUT_TEXT_COLOR,
          ),
          contactTitleColor: normalizeHexColor(
            contactTitleColor,
            DEFAULT_CONTACT_TITLE_COLOR,
          ),
          contactTextColor: normalizeHexColor(
            contactTextColor,
            DEFAULT_CONTACT_TEXT_COLOR,
          ),
          galleryTitleColor: normalizeHexColor(
            galleryTitleColor,
            DEFAULT_GALLERY_TITLE_COLOR,
          ),
          serviceChipBackgroundColor: normalizeHexColor(
            serviceChipBackgroundColor,
            DEFAULT_SERVICE_CHIP_BACKGROUND,
          ),
          serviceChipTextColor: normalizeHexColor(
            serviceChipTextColor,
            DEFAULT_SERVICE_CHIP_TEXT,
          ),
        },
      };

      if (!/^[a-z0-9-]{3,30}$/.test(slug)) throw new Error("Invalid slug");
      if (!slugAvailable) throw new Error("Slug already in use");

      const nextPayload = {
        title: title.trim(),
        slug,
        description: description || null,
        content_json: contentPayload,
        status: nextStatus || status || "DRAFT",
        logo: logo || null,
        hero,
        gallery,
        nearest_city: contactCity || null,
      };

      const isAdminUser = (profile?.role || "USER") === "ADMIN";
      if (isAdminUser && cameFromAdmin) {
        const { data: auth } = await supabase.auth.getSession();
        const session = auth?.session;
        if (!session) throw new Error("Not signed in");
        const resp = await fetch(`/api/admin/sites/detail`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            id: site.id,
            ...nextPayload,
          }),
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json?.error || "Failed to save");
        if (json?.site) {
          setSite(json.site);
          setStatus(json.site.status || nextPayload.status);
        } else if (nextStatus) {
          setStatus(nextStatus);
        }
      } else {
        const { error: updErr } = await supabase
          .from("sites")
          .update(nextPayload)
          .eq("id", site.id);
        if (updErr) throw updErr;
        if (nextStatus) setStatus(nextStatus);
      }
      router.refresh();
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const onAddImages = async (files, kind) => {
    try {
      if (kind === "hero") setUploadingHero(true);
      if (kind === "gallery") setUploadingGallery(true);
      if (!site) throw new Error("Site not loaded");
      const list = Array.from(files);

      // Fetch latest arrays from DB to avoid stale state and enforce limits
      let fresh = null;
      const isAdminUser = (profile?.role || "USER") === "ADMIN";
      if (isAdminUser && cameFromAdmin) {
        const { data: auth } = await supabase.auth.getSession();
        const session = auth?.session;
        if (!session) throw new Error("Not signed in");
        const resp = await fetch(
          `/api/admin/sites/detail?id=${encodeURIComponent(site.id)}`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
          },
        );
        const json = await resp.json();
        if (!resp.ok) throw new Error(json?.error || "Failed to load site");
        fresh = json.site || null;
      } else {
        const { data, error: selErr } = await supabase
          .from("sites")
          .select("hero,gallery")
          .eq("id", site.id)
          .single();
        if (selErr) throw selErr;
        fresh = data;
      }

      const current =
        kind === "hero" ? fresh?.hero || [] : fresh?.gallery || [];
      const max = 6;
      const slots = Math.max(0, max - current.length);
      if (slots <= 0)
        throw new Error(
          `${kind === "hero" ? "Hero" : "Gallery"} already has ${max} images`,
        );

      const accepted = list.slice(0, slots);
      const uploaded = [];
      for (const f of accepted) {
        const path = await uploadFile(f, kind);
        uploaded.push(path);
      }

      const updatedList = [...current, ...uploaded];
      const updatePayload = withOwnerDraftStatus(
        kind === "hero" ? { hero: updatedList } : { gallery: updatedList },
      );
      if (isAdminUser && cameFromAdmin) {
        const { data: auth } = await supabase.auth.getSession();
        const session = auth?.session;
        if (!session) throw new Error("Not signed in");
        const resp = await fetch(`/api/admin/sites/detail`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            id: site.id,
            ...updatePayload,
          }),
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json?.error || "Failed to update images");
        if (json?.site) setSite(json.site);
      } else {
        const { error: updErr } = await supabase
          .from("sites")
          .update(updatePayload)
          .eq("id", site.id);
        if (updErr) throw updErr;
      }

      if (kind === "hero") setHero(updatedList);
      if (kind === "gallery") setGallery(updatedList);
      if (updatePayload.status) setStatus(updatePayload.status);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      if (kind === "hero") setUploadingHero(false);
      if (kind === "gallery") setUploadingGallery(false);
    }
  };

  const onReplaceLogo = async (file) => {
    try {
      setUploadingLogo(true);
      if (!site) throw new Error("Site not loaded");
      const old = logo;
      const path = await uploadFile(file, "logo");
      const isAdminUser = (profile?.role || "USER") === "ADMIN";
      if (isAdminUser && cameFromAdmin) {
        const { data: auth } = await supabase.auth.getSession();
        const session = auth?.session;
        if (!session) throw new Error("Not signed in");
        const resp = await fetch(`/api/admin/sites/detail`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            id: site.id,
            logo: path,
          }),
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json?.error || "Failed to update logo");
        if (json?.site) setSite(json.site);
      } else {
        const updatePayload = withOwnerDraftStatus({ logo: path });
        const { error: updErr } = await supabase
          .from("sites")
          .update(updatePayload)
          .eq("id", site.id);
        if (updErr) throw updErr;
        if (updatePayload.status) setStatus(updatePayload.status);
      }
      setLogo(path);
      // Best-effort cleanup of previous logo file
      if (old) {
        try {
          await supabase.storage.from(BUCKET).remove([old]);
        } catch {}
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeFrom = async (kind, idx) => {
    try {
      if (!site) return;
      const isAdminUser = (profile?.role || "USER") === "ADMIN";
      if (kind === "logo") {
        const old = logo;
        if (isAdminUser && cameFromAdmin) {
          const { data: auth } = await supabase.auth.getSession();
          const session = auth?.session;
          if (!session) throw new Error("Not signed in");
          const resp = await fetch(`/api/admin/sites/detail`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              id: site.id,
              logo: null,
            }),
          });
          const json = await resp.json();
          if (!resp.ok) throw new Error(json?.error || "Failed to remove logo");
          if (json?.site) setSite(json.site);
        } else {
          const updatePayload = withOwnerDraftStatus({ logo: null });
          const { error: updErr } = await supabase
            .from("sites")
            .update(updatePayload)
            .eq("id", site.id);
          if (updErr) throw updErr;
          if (updatePayload.status) setStatus(updatePayload.status);
        }
        setLogo("");
        if (old) {
          try {
            await supabase.storage.from(BUCKET).remove([old]);
          } catch {}
        }
      } else {
        const list = kind === "hero" ? [...hero] : [...gallery];
        const [removed] = list.splice(idx, 1);
        const updatePayload = withOwnerDraftStatus(
          kind === "hero" ? { hero: list } : { gallery: list },
        );
        if (isAdminUser && cameFromAdmin) {
          const { data: auth } = await supabase.auth.getSession();
          const session = auth?.session;
          if (!session) throw new Error("Not signed in");
          const resp = await fetch(`/api/admin/sites/detail`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              id: site.id,
              ...updatePayload,
            }),
          });
          const json = await resp.json();
          if (!resp.ok)
            throw new Error(json?.error || "Failed to update images");
          if (json?.site) setSite(json.site);
        } else {
          const { error: updErr } = await supabase
            .from("sites")
            .update(updatePayload)
            .eq("id", site.id);
          if (updErr) throw updErr;
        }
        if (kind === "hero") setHero(list);
        else setGallery(list);
        if (updatePayload.status) setStatus(updatePayload.status);
        if (removed) {
          try {
            await supabase.storage.from(BUCKET).remove([removed]);
          } catch {}
        }
      }
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  // if (loading) return <p>Loading...</p>
  if (loading) return <LoadingOverlay message="Loading editor..." />;

  const isAdmin = (profile?.role || "USER") === "ADMIN";
  const paidUntil = profile?.paid_until ? new Date(profile.paid_until) : null;
  const isExpired = isAdmin ? false : !paidUntil || paidUntil <= new Date();
  const backHref =
    cameFromAdmin && isAdmin ? `/admin/sites/${id}` : "/dashboard/home";
  const backLabel =
    cameFromAdmin && isAdmin ? "Back to review" : "Back to dashboard";

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-red-700">Edit site</h1>
        <span className="inline-block rounded bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-xs">
          Status:{" "}
          {status === "SUBMITTED"
            ? "Submitted for approval"
            : status === "APPROVED"
              ? "Approved"
              : status === "REJECTED"
                ? "Rejected"
                : "Draft"}
        </span>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </p>
      )}
      {!isAdmin && isExpired && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-800">
          Your plan is inactive. You can save drafts but cannot submit for
          approval.
        </div>
      )}

      <form onSubmit={onSave} className="space-y-8">
        <section className="rounded border border-gray-200 p-4">
          <h2 className="font-semibold text-red-700 mb-3">Basics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slug</label>
              <input
                type="text"
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                required
              />
              <div className="mt-1 text-xs">
                {slug && !/^[a-z0-9-]{3,30}$/.test(slug) && (
                  <span className="text-red-600">
                    Use 3–30 lowercase letters, digits, hyphens.
                  </span>
                )}
                {checkingSlug && (
                  <span className="text-gray-500"> Checking…</span>
                )}
                {!checkingSlug && slugAvailable && (
                  <span className="text-green-700">Slug available.</span>
                )}
                {!checkingSlug && !slugAvailable && slug !== site.slug && (
                  <span className="text-red-600">Slug is taken.</span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-4">
              <div className="mb-1 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <label className="block text-sm font-medium">
                  Main description title
                </label>
                <label className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                  <span className="text-xs font-medium text-gray-600">
                    Title color
                  </span>
                  <input
                    type="color"
                    value={mainDescriptionTitleColor}
                    onChange={(e) => setMainDescriptionTitleColor(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-transparent p-1"
                  />
                  <span className="text-xs font-mono text-gray-600">
                    {mainDescriptionTitleColor}
                  </span>
                </label>
              </div>
              <input
                type="text"
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                value={mainDescriptionTitle}
                onChange={(e) => setMainDescriptionTitle(e.target.value)}
                placeholder="Defaults to the site title if left blank"
              />
            </div>
            <div className="mb-1 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <label className="block text-sm font-medium">
                Description
              </label>
              <label className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                <span className="text-xs font-medium text-gray-600">
                  Text color
                </span>
                <input
                  type="color"
                  value={mainDescriptionTextColor}
                  onChange={(e) => setMainDescriptionTextColor(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-transparent p-1"
                />
                <span className="text-xs font-mono text-gray-600">
                  {mainDescriptionTextColor}
                </span>
              </label>
            </div>
            <textarea
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-24"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-5">
              <h3
                className="text-2xl font-bold"
                style={{ color: mainDescriptionTitleColor }}
              >
                {mainDescriptionTitle || title || "Main description title"}
              </h3>
              <p
                className="mt-3 text-base leading-relaxed"
                style={{ color: mainDescriptionTextColor }}
              >
                {description ||
                  "This preview shows how your main title and description colors will appear on Template 1."}
              </p>
            </div>
          </div>
          {/* Publishing is not available here */}
        </section>

        <section className="rounded border border-gray-200 p-4">
          <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-red-700">About</h2>
              <label className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                <span className="text-xs font-medium text-gray-600">
                  Title color
                </span>
                <input
                  type="color"
                  value={aboutTitleColor}
                  onChange={(e) => setAboutTitleColor(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-transparent p-1"
                />
                <span className="text-xs font-mono text-gray-600">
                  {aboutTitleColor}
                </span>
              </label>
              <label className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                <span className="text-xs font-medium text-gray-600">
                  Text color
                </span>
                <input
                  type="color"
                  value={aboutTextColor}
                  onChange={(e) => setAboutTextColor(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-transparent p-1"
                />
                <span className="text-xs font-mono text-gray-600">
                  {aboutTextColor}
                </span>
              </label>
            </div>
          </div>

          <textarea
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-28"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
          />
          <div className="mt-1 text-xs text-gray-600">
            {countWords(about)}/100 words
          </div>
          <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-5">
            <h3
              className="text-2xl font-semibold"
              style={{ color: aboutTitleColor }}
            >
              About preview
            </h3>
            <p
              className="mt-3 text-base leading-relaxed"
              style={{ color: aboutTextColor }}
            >
              {about ||
                "This preview shows how your About title and text colors will appear on Template 1."}
            </p>
          </div>
        </section>

        <section className="rounded border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold text-red-700">Branding</h2>
            <button
              type="button"
              onClick={() => {
                setTopBarBackground(DEFAULT_TOP_BAR_BACKGROUND);
                setTopBarTextColor(DEFAULT_TOP_BAR_TEXT);
                setTopBarFixed(false);
                setMainDescriptionTitleColor(
                  DEFAULT_MAIN_DESCRIPTION_TITLE_COLOR,
                );
                setMainDescriptionTextColor(
                  DEFAULT_MAIN_DESCRIPTION_TEXT_COLOR,
                );
                setAboutTitleColor(DEFAULT_ABOUT_TITLE_COLOR);
                setAboutTextColor(DEFAULT_ABOUT_TEXT_COLOR);
                setContactTitleColor(DEFAULT_CONTACT_TITLE_COLOR);
                setContactTextColor(DEFAULT_CONTACT_TEXT_COLOR);
              }}
              className="rounded border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Reset branding
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block rounded border border-gray-200 p-3">
              <span className="block text-sm font-medium mb-2">
                Top bar background
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={topBarBackground}
                  onChange={(e) => setTopBarBackground(e.target.value)}
                  className="h-11 w-16 cursor-pointer rounded border border-gray-300 bg-transparent p-1"
                />
                <div>
                  <div className="text-sm font-mono text-gray-700">
                    {topBarBackground}
                  </div>
                  <p className="text-xs text-gray-500">
                    Used for the Template 1 top navigation bar.
                  </p>
                </div>
              </div>
            </label>
            <label className="block rounded border border-gray-200 p-3">
              <span className="block text-sm font-medium mb-2">
                Top bar text color
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={topBarTextColor}
                  onChange={(e) => setTopBarTextColor(e.target.value)}
                  className="h-11 w-16 cursor-pointer rounded border border-gray-300 bg-transparent p-1"
                />
                <div>
                  <div className="text-sm font-mono text-gray-700">
                    {topBarTextColor}
                  </div>
                  <p className="text-xs text-gray-500">
                    Controls the site title and navigation link color.
                  </p>
                </div>
              </div>
            </label>
          </div>
          <label className="mt-4 flex items-start gap-3 rounded border border-gray-200 p-3">
            <input
              type="checkbox"
              checked={topBarFixed}
              onChange={(e) => setTopBarFixed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-red-700 focus:ring-red-500"
            />
            <span>
              <span className="block text-sm font-medium text-gray-900">
                Fix top bar while scrolling
              </span>
              <span className="block text-xs text-gray-500">
                Keeps the top navigation pinned to the top of the page in
                Template 1 previews.
              </span>
            </span>
          </label>
          <div
            className="mt-4 flex items-center justify-between rounded-lg px-4 py-3"
            style={{
              backgroundColor: topBarBackground,
              color: topBarTextColor,
            }}
          >
            <span className="font-semibold">
              {title || "Site title preview"}
            </span>
            <div className="flex items-center gap-4 text-sm">
              <span>About</span>
              <span>Contact</span>
              <span>Gallery</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Header behavior:{" "}
            {topBarFixed
              ? "Fixed to top while scrolling"
              : "Scrolls naturally with the page"}
          </p>
        </section>

        <section className="rounded border border-gray-200 p-4">
          <h2 className="font-semibold text-red-700 mb-3">Contact</h2>
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block rounded border border-gray-200 p-3">
              <span className="block text-sm font-medium mb-2">
                Contact title color
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={contactTitleColor}
                  onChange={(e) => setContactTitleColor(e.target.value)}
                  className="h-11 w-16 cursor-pointer rounded border border-gray-300 bg-transparent p-1"
                />
                <div>
                  <div className="text-sm font-mono text-gray-700">
                    {contactTitleColor}
                  </div>
                  <p className="text-xs text-gray-500">
                    Changes the Contact heading color in Template 1.
                  </p>
                </div>
              </div>
            </label>
            <label className="block rounded border border-gray-200 p-3">
              <span className="block text-sm font-medium mb-2">
                Contact details color
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={contactTextColor}
                  onChange={(e) => setContactTextColor(e.target.value)}
                  className="h-11 w-16 cursor-pointer rounded border border-gray-300 bg-transparent p-1"
                />
                <div>
                  <div className="text-sm font-mono text-gray-700">
                    {contactTextColor}
                  </div>
                  <p className="text-xs text-gray-500">
                    Changes the displayed email, phone, and address colors.
                  </p>
                </div>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="text"
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    list={citySuggestionsListId}
                    className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={contactCity}
                    onChange={(e) => updateCityField(e.target.value)}
                    placeholder="Start typing or detect automatically"
                  />
                  <button
                    type="button"
                    onClick={detectCityFromBrowser}
                    disabled={detectingCity}
                    className="rounded border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {detectingCity ? "Detecting..." : "Detect"}
                  </button>
                </div>
                {citySuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {citySuggestions.map((city) => (
                      <button
                        type="button"
                        key={city}
                        onClick={() => updateCityField(city)}
                        className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-700 hover:border-red-300 hover:text-red-700"
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                )}
                {cityError && (
                  <p className="text-xs text-red-600">{cityError}</p>
                )}
                <p className="text-xs text-gray-500">
                  Choose a nearby city or type your location manually.
                </p>
                <datalist id={citySuggestionsListId}>
                  {citySuggestions.map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium mb-1">Address</label>
              <textarea
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-12"
                value={contactAddress}
                onChange={(e) => setContactAddress(e.target.value)}
              />
            </div>
          </div>
          <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-5">
            <h3
              className="text-2xl font-semibold"
              style={{ color: contactTitleColor }}
            >
              Contact preview
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Email
                </div>
                <div
                  className="mt-2 text-sm"
                  style={{ color: contactTextColor }}
                >
                  {contactEmail || " "}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Phone
                </div>
                <div
                  className="mt-2 text-sm"
                  style={{ color: contactTextColor }}
                >
                  {contactPhone || " "}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Address
                </div>
                <div
                  className="mt-2 text-sm"
                  style={{ color: contactTextColor }}
                >
                  {contactAddress || contactCity || "Contact details preview"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded border border-gray-200 p-4">
          <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-red-700">Services</h2>
              <label className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                <span className="text-xs font-medium text-gray-600">
                  Chip bg
                </span>
                <input
                  type="color"
                  value={serviceChipBackgroundColor}
                  onChange={(e) => setServiceChipBackgroundColor(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-transparent p-1"
                />
                <span className="text-xs font-mono text-gray-600">
                  {serviceChipBackgroundColor}
                </span>
              </label>
              <label className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                <span className="text-xs font-medium text-gray-600">
                  Chip text
                </span>
                <input
                  type="color"
                  value={serviceChipTextColor}
                  onChange={(e) => setServiceChipTextColor(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-transparent p-1"
                />
                <span className="text-xs font-mono text-gray-600">
                  {serviceChipTextColor}
                </span>
              </label>
            </div>
            <span className="text-xs text-gray-600">
              {countWords(servicesText)}/100 words
            </span>
          </div>
          <textarea
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-28"
            value={servicesText}
            onChange={(e) => setServicesText(e.target.value)}
            placeholder="One service per line"
          />
          <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-4">
            <div className="text-sm font-medium text-gray-700">
              Service chip preview
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(servicesText
                ? servicesText
                    .split(/\r?\n/)
                    .map((service) => service.trim())
                    .filter(Boolean)
                : ["Service preview"]
              ).map((service) => (
                <span
                  key={service}
                  className="inline-flex items-center rounded-full px-4 py-2 text-sm font-medium shadow-sm"
                  style={{
                    backgroundColor: serviceChipBackgroundColor,
                    color: serviceChipTextColor,
                  }}
                >
                  {service}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-red-700">Logo</h2>
            <span className="text-xs text-gray-600">{logo ? 1 : 0}/1</span>
          </div>
          {logo ? (
            <div className="flex items-center gap-4">
              <Image
                src={previewUrl(logo)}
                alt="Logo"
                width={64}
                height={64}
                className="h-16 w-16 object-contain border"
                sizes="64px"
              />
              <button
                type="button"
                onClick={() => removeFrom("logo", 0)}
                className="rounded bg-gray-100 px-3 py-1.5 border"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <input
                id="logo-input"
                className="hidden"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onReplaceLogo(file);
                  e.target.value = "";
                }}
              />
              {uploadingLogo ? (
                <span className="inline-flex items-center rounded bg-red-100 text-red-700 px-4 py-2 border border-red-200">
                  Uploading...
                </span>
              ) : (
                <label
                  htmlFor="logo-input"
                  className="inline-flex items-center rounded bg-[#BF283B] text-white px-4 py-2 font-medium hover:bg-[#a32131] cursor-pointer"
                >
                  Choose File
                </label>
              )}
            </>
          )}
        </section>

        <section className="rounded border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-red-700">Hero images</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-600">{hero.length}/6</span>
              {uploadingHero && (
                <span className="text-xs text-red-700">Uploading...</span>
              )}
              {hero.length < 6 && !uploadingHero && (
                <>
                  <input
                    id="hero-input"
                    className="hidden"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files) onAddImages(e.target.files, "hero");
                      e.target.value = "";
                    }}
                  />
                  <label
                    htmlFor="hero-input"
                    className="inline-flex items-center rounded bg-[#BF283B] text-white px-3 py-1.5 font-medium hover:bg-[#a32131] cursor-pointer"
                  >
                    Choose Files
                  </label>
                </>
              )}
            </div>
          </div>
          {hero.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {hero.map((p, i) => (
                <div key={i} className="relative">
                  <Image
                    src={previewUrl(p)}
                    alt="Hero"
                    width={300}
                    height={120}
                    className="w-full h-24 object-cover border"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
                  />
                  <button
                    type="button"
                    onClick={() => removeFrom("hero", i)}
                    className="absolute top-1 right-1 rounded bg-white/90 text-red-700 px-2 py-0.5 text-xs border"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No hero images added yet.</p>
          )}
        </section>

        <section className="rounded border border-gray-200 p-4">
          <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-red-700">Gallery</h2>
              <label className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2">
                <span className="text-xs font-medium text-gray-600">
                  Title color
                </span>
                <input
                  type="color"
                  value={galleryTitleColor}
                  onChange={(e) => setGalleryTitleColor(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-transparent p-1"
                />
                <span className="text-xs font-mono text-gray-600">
                  {galleryTitleColor}
                </span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-600">{gallery.length}/6</span>
              {uploadingGallery && (
                <span className="text-xs text-red-700">Uploading...</span>
              )}
              {gallery.length < 6 && !uploadingGallery && (
                <>
                  <input
                    id="gallery-input"
                    className="hidden"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files)
                        onAddImages(e.target.files, "gallery");
                      e.target.value = "";
                    }}
                  />
                  <label
                    htmlFor="gallery-input"
                    className="inline-flex items-center rounded bg-[#BF283B] text-white px-3 py-1.5 font-medium hover:bg-[#a32131] cursor-pointer"
                  >
                    Choose Files
                  </label>
                </>
              )}
            </div>
          </div>
          {gallery.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {gallery.map((p, i) => (
                <div key={i} className="relative">
                  <Image
                    src={previewUrl(p)}
                    alt="Gallery"
                    width={300}
                    height={120}
                    className="w-full h-24 object-cover border"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
                  />
                  <button
                    type="button"
                    onClick={() => removeFrom("gallery", i)}
                    className="absolute top-1 right-1 rounded bg-white/90 text-red-700 px-2 py-0.5 text-xs border"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              No gallery images added yet.
            </p>
          )}
        </section>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={(e) => onSave(e, "DRAFT")}
            className="rounded bg-[#BF283B] text-white px-4 py-2 font-medium hover:bg-[#a32131] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            disabled={
              saving ||
              !slugAvailable ||
              !/^[a-z0-9-]{3,30}$/.test(slug) ||
              (!isAdmin && isExpired)
            }
            onClick={(e) => onSave(e, "SUBMITTED")}
            className="rounded border border-red-300 text-red-700 px-4 py-2 font-medium hover:bg-red-50 disabled:opacity-60"
            title={!slugAvailable ? "Fix slug before submitting" : undefined}
          >
            {saving ? "Submitting…" : "Submit for approval"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={openDeleteModal}
            className="rounded border border-red-400 text-red-700 px-4 py-2 font-medium hover:bg-red-50 disabled:opacity-60"
          >
            Delete site
          </button>
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="rounded border px-4 py-2"
          >
            {backLabel}
          </button>
          <span className="inline-block rounded bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-xs">
            Status:{" "}
            {status === "SUBMITTED"
              ? "Submitted for approval"
              : status === "APPROVED"
                ? "Approved"
                : status === "REJECTED"
                  ? "Rejected"
                  : "Draft"}
          </span>
        </div>
      </form>
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Confirm deletion
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Enter{" "}
              <span className="font-mono text-base text-gray-900">
                {deleteCode}
              </span>{" "}
              to confirm you want to delete this site.
            </p>
            <label className="mt-4 block text-sm font-medium text-gray-700">
              Verification code
              <input
                type="text"
                value={enteredDeleteCode}
                onChange={(e) => {
                  setEnteredDeleteCode(e.target.value);
                  if (deleteError) setDeleteError("");
                }}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Enter delete code"
                inputMode="numeric"
              />
            </label>
            {deleteError && (
              <p className="mt-3 text-sm text-red-600">{deleteError}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="rounded border px-4 py-2 text-sm"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded bg-[#BF283B] px-4 py-2 text-sm font-medium text-white hover:bg-[#a32131] disabled:opacity-60"
                disabled={deleting || enteredDeleteCode.trim() !== deleteCode}
              >
                {deleting ? "Deleting..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
