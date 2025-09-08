"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function isDebugEnabled(searchParams) {
  try {
    if (searchParams?.get("debug") === "1") {
      window.localStorage?.setItem("DEBUG_UI", "1");
      return true;
    }
    if (searchParams?.get("debug") === "0") {
      window.localStorage?.removeItem("DEBUG_UI");
      return false;
    }
    return window.localStorage?.getItem("DEBUG_UI") === "1";
  } catch {
    return false;
  }
}

function scanOverlays() {
  const results = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const nodes = Array.from(document.querySelectorAll("body *"));
  for (const el of nodes) {
    const cs = window.getComputedStyle(el);
    if (cs.position !== "fixed") continue;
    const rect = el.getBoundingClientRect();
    const covers = rect.width >= vw * 0.8 && rect.height >= vh * 0.8 && rect.left <= vw * 0.1 && rect.top <= vh * 0.1;
    const pe = cs.pointerEvents !== "none";
    const vis = cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
    if (covers && pe && vis) {
      const zi = parseInt(cs.zIndex || "0", 10) || 0;
      results.push({ el, rect, z: zi, className: el.className, id: el.id, tag: el.tagName, modal: el.hasAttribute("data-modal-root") || el.hasAttribute("data-overlay") });
      try {
        el.style.outline = "2px dashed rgba(255,0,0,0.6)";
        el.style.outlineOffset = "-2px";
      } catch {}
    }
  }
  return results.sort((a, b) => b.z - a.z);
}

export default function DebugOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [enabled, setEnabled] = useState(false);
  const [overlays, setOverlays] = useState([]);

  useEffect(() => {
    const on = isDebugEnabled(searchParams);
    setEnabled(on);
  }, [searchParams]);

  useEffect(() => {
    if (!enabled) return;
    console.groupCollapsed(`[Debug] Route change to ${pathname}`);
    console.time("overlay-scan");
    const res = scanOverlays();
    console.timeEnd("overlay-scan");
    setOverlays(res);
    if (res.length) {
      console.warn(`[Debug] Found ${res.length} fullscreen fixed overlays`);
      res.forEach((r, i) =>
        console.warn(`#${i + 1}`, { tag: r.tag, id: r.id, className: r.className, zIndex: r.z, rect: r.rect, modalLike: r.modal })
      );
    } else {
      console.log("[Debug] No fullscreen overlays detected.");
    }
    console.groupEnd();
  }, [enabled, pathname]);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e) => {
      const [top] = document.elementsFromPoint(e.clientX, e.clientY) || [];
      if (top) {
        const cs = window.getComputedStyle(top);
        console.log("[Debug] click@", e.clientX, e.clientY, {
          tag: top.tagName,
          id: top.id,
          className: top.className,
          zIndex: cs.zIndex,
          position: cs.position,
          pointerEvents: cs.pointerEvents,
        });
      }
    };
    window.addEventListener("click", handler, true);
    return () => window.removeEventListener("click", handler, true);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-3 right-3 z-[70] rounded bg-white/90 backdrop-blur px-3 py-2 border border-red-300 text-xs text-red-700 shadow">
      <div className="font-semibold">Debug UI</div>
      <div>Path: {pathname}</div>
      <div>Overlays: {overlays.length}</div>
      <div className="mt-1">
        Toggle with <code>?debug=1</code> / <code>?debug=0</code>
      </div>
    </div>
  );
}

