"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";
import LoadingOverlay from "@/components/LoadingOverlay";

const BUCKET = "site-assets";

export default function AdminSiteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [site, setSite] = useState(null);
  const [comment, setComment] = useState("");
  const [targetStatus, setTargetStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  const previewUrl = (path) => (path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : "");

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getSession();
      const session = auth?.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (prof?.role !== "ADMIN") {
        router.replace("/dashboard/home");
        return;
      }
      setAllowed(true);
      const resp = await fetch(`/api/admin/sites/detail?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!resp.ok) {
        setError("Failed to load site");
        setChecking(false);
        return;
      }
      const json = await resp.json();
      const data = json.site;
      setSite(data);
      const existing = data?.content_json?.moderation_comment || "";
      setComment(existing);
      setTargetStatus(data.status || "DRAFT");
      setChecking(false);
    })();
  }, [id, router]);

  const updateStatus = async (newStatus) => {
    if (!site) return;
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getSession();
      const session = auth?.session;
      if (!session) throw new Error("Not signed in");
      const resp = await fetch(`/api/admin/sites/detail`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: site.id, status: newStatus, comment }),
      });
      if (!resp.ok) throw new Error("Failed to update");
      setMessage(
        newStatus === "APPROVED"
          ? "Site approved."
          : newStatus === "REJECTED"
          ? "Site marked not approved."
          : newStatus === "SUBMITTED"
          ? "Site marked submitted."
          : "Site marked draft."
      );
      setSite({ ...site, status: newStatus, content_json: { ...(site.content_json || {}), moderation_comment: newStatus === "REJECTED" ? (comment || "") : null } });
    } catch (e) {
      setError(e.message || "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = () => {
    setDeleteInput("");
    setError("");
    setMessage("");
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setShowDeleteModal(false);
    setDeleteInput("");
  };

  const deleteSite = async () => {
    if (!site) return;
    if (deleteInput.trim() !== site.slug) {
      setError("Enter the site slug exactly to confirm deletion.");
      return;
    }

    setError("");
    setMessage("");
    setDeleting(true);
    try {
      const { data: auth } = await supabase.auth.getSession();
      const session = auth?.session;
      if (!session) throw new Error("Not signed in");

      const resp = await fetch(`/api/admin/sites/detail?id=${encodeURIComponent(site.id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!resp.ok) throw new Error("Failed to delete site");

      router.replace("/admin/sites");
      router.refresh();
    } catch (e) {
      setError(e.message || "Failed to delete site");
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (checking) return <LoadingOverlay message="Loading admin site..." />;
  if (!allowed) return null;
  if (!site) return <div className="max-w-5xl mx-auto text-red-700">Site not found.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-red-700">Review site</h1>
          <div className="text-sm text-gray-700">/{site.slug}</div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded border border-gray-300 px-3 py-2"
            value={targetStatus}
            onChange={(e) => setTargetStatus(e.target.value)}
          >
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted for approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Not approved</option>
          </select>
          <button
            disabled={saving}
            onClick={() => updateStatus(targetStatus)}
            className="rounded bg-[#BF283B] text-white px-4 py-2 font-medium hover:bg-[#a32131] disabled:opacity-60"
          >
            Update status
          </button>
          <button
            type="button"
            disabled={saving || deleting}
            onClick={openDeleteModal}
            className="rounded border border-red-300 px-4 py-2 font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            Delete site
          </button>
          <button onClick={() => router.push("/admin/sites")} className="rounded border px-4 py-2">Back</button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</div>
      )}
      {message && (
        <div className="rounded border border-green-300 bg-green-50 p-3 text-green-800">{message}</div>
      )}

      <section className="rounded border border-gray-200 p-4">
        <h2 className="font-semibold text-red-700 mb-2">Basics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div><span className="font-medium">Title:</span> {site.title}</div>
          <div><span className="font-medium">Status:</span> {site.status === 'SUBMITTED' ? 'Submitted for approval' : site.status === 'APPROVED' ? 'Approved' : site.status === 'REJECTED' ? 'Rejected' : 'Draft'}</div>
          <div className="sm:col-span-2"><span className="font-medium">Description:</span> {site.description || '-'}</div>
          <div><span className="font-medium">Nearest city:</span> {site.nearest_city || '—'}</div>
        </div>
      </section>

      <section className="rounded border border-gray-200 p-4">
        <h2 className="font-semibold text-red-700 mb-2">Content</h2>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">About:</span> {site.content_json?.about || '-'}
          </div>
          <div>
            <span className="font-medium">Contact:</span>{" "}
            {site.content_json?.contact?.email || "-"} |{" "}
            {site.content_json?.contact?.phone || "-"} |{" "}
            {site.content_json?.contact?.address || "-"}
            {site.nearest_city ? ` | ${site.nearest_city}` : ""}
          </div>
          <div>
            <span className="font-medium">Services:</span> {Array.isArray(site.content_json?.services) && site.content_json.services.length > 0 ? site.content_json.services.join(', ') : '-'}
          </div>
        </div>
      </section>

      <section className="rounded border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold text-red-700">Images</h2>
        <div className="text-sm">Logo:</div>
        {site.logo ? (
          <Image src={previewUrl(site.logo)} alt="Logo" width={96} height={96} className="border h-24 w-24 object-contain" />
        ) : (
          <div className="text-sm text-gray-600">No logo</div>
        )}
        <div className="text-sm">Hero ({(site.hero || []).length}):</div>
        {(site.hero || []).length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {site.hero.map((p, i) => (
              <Image key={i} src={previewUrl(p)} alt="Hero" width={200} height={120} className="border w-full h-24 object-cover" />
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-600">No hero images</div>
        )}
        <div className="text-sm">Gallery ({(site.gallery || []).length}):</div>
        {(site.gallery || []).length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {site.gallery.map((p, i) => (
              <Image key={i} src={previewUrl(p)} alt="Gallery" width={200} height={120} className="border w-full h-24 object-cover" />
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-600">No gallery images</div>
        )}
      </section>

      <section className="rounded border border-gray-200 p-4">
        <h2 className="font-semibold text-red-700 mb-2">Review comment</h2>
        <textarea
          className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-24"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional note when not approved (visible to user later)"
        />
      </section>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Delete site</h2>
            <p className="mt-2 text-sm text-gray-600">
              This permanently removes the site and its uploaded images. Enter
              <span className="mx-1 font-mono text-gray-900">{site.slug}</span>
              to confirm.
            </p>
            <label className="mt-4 block text-sm font-medium text-gray-700">
              Site slug
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Enter site slug"
              />
            </label>
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
                onClick={deleteSite}
                className="rounded bg-[#BF283B] px-4 py-2 text-sm font-medium text-white hover:bg-[#a32131] disabled:opacity-60"
                disabled={deleting || deleteInput.trim() !== site.slug}
              >
                {deleting ? "Deleting..." : "Delete site"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
