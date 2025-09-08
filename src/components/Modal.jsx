"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Auto-close on route changes to avoid lingering overlays
  const pathname = usePathname();
  useEffect(() => {
    if (!open) return;
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open) return null;

  return (
    <div
      data-modal-root
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div data-overlay className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 w-full max-w-xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-lg shadow-lg border border-red-200 bg-white">
          <div className="flex items-center justify-between px-5 py-3 border-b border-red-100 bg-red-600 text-white rounded-t-lg">
            <h3 className="font-semibold">{title}</h3>
            <button
              aria-label="Close"
              onClick={onClose}
              className="rounded p-1 hover:bg-white/10"
            >
              ✕
            </button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

