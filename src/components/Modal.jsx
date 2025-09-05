"use client";

import { useEffect } from "react";

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50" />
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

