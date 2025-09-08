"use client";

export default function LoadingOverlay({ message = "Loading…" }) {
  return (
    <div className="fixed inset-0 z-[80] bg-white/80 backdrop-blur-sm flex items-center justify-center">
      <div className="flex items-center gap-3 text-red-700" aria-live="polite" aria-busy="true">
        <span className="inline-block h-5 w-5 rounded-full border-2 border-red-600 border-t-transparent animate-spin" />
        <span className="font-medium">{message}</span>
      </div>
    </div>
  );
}

