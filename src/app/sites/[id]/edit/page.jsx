"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import LoadingOverlay from "@/components/LoadingOverlay";
import { processImage } from "@/lib/image";

const BUCKET = "site-assets";

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

async function getPublicUrl(path) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

export default function EditSitePage() {
  const { id } = useParams();
  const router = useRouter();
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
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [servicesText, setServicesText] = useState("");
  const [logo, setLogo] = useState("");
  const [hero, setHero] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  useEffect(() => {
    setSlug(slugify(slugInput));
  }, [slugInput]);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: auth }, { data, error: selErr }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.from("sites").select("*").eq("id", id).single(),
        ]);
        if (selErr) throw selErr;
        // Ensure user is owner
        if (!auth.user || data.owner !== auth.user.id) {
          router.replace("/dashboard");
          return;
        }
        // Load profile for gating (paid status)
        const { data: prof } = await supabase
          .from("profiles")
          .select("paid_until, role")
          .eq("id", auth.user.id)
          .single();
        setProfile(prof || null);
        setSite(data);
        setTitle(data.title || "");
        setSlugInput(data.slug || "");
        setDescription(data.description || "");
        setStatus(data.status || "DRAFT");
        const cj = data.content_json || {};
        setAbout(cj.about || "");
        setContactEmail(cj.contact?.email || "");
        setContactPhone(cj.contact?.phone || "");
        setContactAddress(cj.contact?.address || "");
        // Represent services array as newline-separated text
        setServicesText(Array.isArray(cj.services) ? cj.services.join("\n") : "");
        setLogo(data.logo || "");
        setHero(Array.isArray(data.hero) ? data.hero : []);
        setGallery(Array.isArray(data.gallery) ? data.gallery : []);
      } catch (e) {
        setError(e.message || "Failed to load site");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  if (loading) {
    return <LoadingOverlay message="Loading editor..." />;
  }

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
          `/api/sites/slug-available?slug=${encodeURIComponent(slug)}&excludeId=${encodeURIComponent(site.id)}`
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

  const previewUrl = (path) => (path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : "");

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
    const ext = processed.name.split(".").pop();
    const safeName = processed.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${site.owner}/${site.id}/${kind}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, processed, {
      cacheControl: "31536000",
      upsert: false,
    });
    if (upErr) throw upErr;
    return path;
  };

  const countWords = (s) => (s?.trim() ? s.trim().split(/\s+/).length : 0);
  const onSave = async (e, nextStatus) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      // Validate word limits
      if (countWords(about) > 100) throw new Error("About must be 100 words or fewer");
      if (countWords(servicesText) > 100) throw new Error("Services must be 100 words or fewer");

      // Build content_json from fields
      const contentPayload = {
        about: about || "",
        contact: {
          email: contactEmail || "",
          phone: contactPhone || "",
          address: contactAddress || "",
        },
        services: servicesText
          ? servicesText
              .split(/\r?\n/) // one per line
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      };

      if (!/^[a-z0-9-]{3,30}$/.test(slug)) throw new Error("Invalid slug");
      if (!slugAvailable) throw new Error("Slug already in use");

      const { error: updErr } = await supabase
        .from("sites")
        .update({
          title: title.trim(),
          slug,
          description: description || null,
          content_json: contentPayload,
          status: nextStatus || status || "DRAFT",
          logo: logo || null,
          hero,
          gallery,
        })
        .eq("id", site.id);
      if (updErr) throw updErr;
      if (nextStatus) setStatus(nextStatus);
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
      const { data: fresh, error: selErr } = await supabase
        .from("sites")
        .select("hero,gallery")
        .eq("id", site.id)
        .single();
      if (selErr) throw selErr;

      const current = kind === "hero" ? (fresh?.hero || []) : (fresh?.gallery || []);
      const max = 6;
      const slots = Math.max(0, max - current.length);
      if (slots <= 0) throw new Error(`${kind === "hero" ? "Hero" : "Gallery"} already has ${max} images`);

      const accepted = list.slice(0, slots);
      const uploaded = [];
      for (const f of accepted) {
        const path = await uploadFile(f, kind);
        uploaded.push(path);
      }

      const updatedList = [...current, ...uploaded];
      const updatePayload = kind === "hero" ? { hero: updatedList } : { gallery: updatedList };
      const { error: updErr } = await supabase
        .from("sites")
        .update(updatePayload)
        .eq("id", site.id);
      if (updErr) throw updErr;

      if (kind === "hero") setHero(updatedList);
      if (kind === "gallery") setGallery(updatedList);
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
      const { error: updErr } = await supabase
        .from("sites")
        .update({ logo: path })
        .eq("id", site.id);
      if (updErr) throw updErr;
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
      if (kind === "logo") {
        const old = logo;
        const { error: updErr } = await supabase
          .from("sites")
          .update({ logo: null })
          .eq("id", site.id);
        if (updErr) throw updErr;
        setLogo("");
        if (old) {
          try { await supabase.storage.from(BUCKET).remove([old]); } catch {}
        }
      } else {
        const list = kind === "hero" ? [...hero] : [...gallery];
        const [removed] = list.splice(idx, 1);
        const updatePayload = kind === "hero" ? { hero: list } : { gallery: list };
        const { error: updErr } = await supabase
          .from("sites")
          .update(updatePayload)
          .eq("id", site.id);
        if (updErr) throw updErr;
        if (kind === "hero") setHero(list);
        else setGallery(list);
        if (removed) {
          try { await supabase.storage.from(BUCKET).remove([removed]); } catch {}
        }
      }
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  if (loading) return null;

  const isAdmin = (profile?.role || "USER") === "ADMIN";
  const paidUntil = profile?.paid_until ? new Date(profile.paid_until) : null;
  const isExpired = isAdmin ? false : (!paidUntil || paidUntil <= new Date());

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-red-700">Edit site</h1>
        <span className="inline-block rounded bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-xs">
          Status: {status === 'SUBMITTED' ? 'Submitted for approval' : status === 'APPROVED' ? 'Approved' : status === 'REJECTED' ? 'Rejected' : 'Draft'}
        </span>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
      )}
      {!isAdmin && isExpired && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-800">
          Your plan is inactive. You can save drafts but cannot submit for approval.
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
                  <span className="text-red-600">Use 3–30 lowercase letters, digits, hyphens.</span>
                )}
                {checkingSlug && <span className="text-gray-500"> Checking…</span>}
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
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-24"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {/* Publishing is not available here */}
        </section>

        <section className="rounded border border-gray-200 p-4">
          <h2 className="font-semibold text-red-700 mb-3">About</h2>
          <textarea
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-28"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
          />
          <div className="mt-1 text-xs text-gray-600">{countWords(about)}/100 words</div>
        </section>

        <section className="rounded border border-gray-200 p-4">
          <h2 className="font-semibold text-red-700 mb-3">Contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <label className="block text-sm font-medium mb-1">Address</label>
              <textarea
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-12"
                value={contactAddress}
                onChange={(e) => setContactAddress(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="rounded border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-red-700">Services</h2>
            <span className="text-xs text-gray-600">{countWords(servicesText)}/100 words</span>
          </div>
          <textarea
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-28"
            value={servicesText}
            onChange={(e) => setServicesText(e.target.value)}
            placeholder="One service per line"
          />
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
                  className="inline-flex items-center rounded bg-red-600 text-white px-4 py-2 font-medium hover:bg-red-700 cursor-pointer"
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
                    className="inline-flex items-center rounded bg-red-600 text-white px-3 py-1.5 font-medium hover:bg-red-700 cursor-pointer"
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-red-700">Gallery</h2>
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
                      if (e.target.files) onAddImages(e.target.files, "gallery");
                      e.target.value = "";
                    }}
                  />
                  <label
                    htmlFor="gallery-input"
                    className="inline-flex items-center rounded bg-red-600 text-white px-3 py-1.5 font-medium hover:bg-red-700 cursor-pointer"
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
            <p className="text-sm text-gray-600">No gallery images added yet.</p>
          )}
        </section>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={(e) => onSave(e, 'DRAFT')}
            className="rounded bg-red-600 text-white px-4 py-2 font-medium hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            disabled={saving || !slugAvailable || !/^[a-z0-9-]{3,30}$/.test(slug) || (!isAdmin && isExpired)}
            onClick={(e) => onSave(e, 'SUBMITTED')}
            className="rounded border border-red-300 text-red-700 px-4 py-2 font-medium hover:bg-red-50 disabled:opacity-60"
            title={!slugAvailable ? 'Fix slug before submitting' : undefined}
          >
            {saving ? "Submitting…" : "Submit for approval"}
          </button>
          <button type="button" onClick={() => router.push("/dashboard")} className="rounded border px-4 py-2">
            Back to dashboard
          </button>
        </div>
      </form>
    </div>
  );
}
