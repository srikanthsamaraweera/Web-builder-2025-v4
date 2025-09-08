"use client";

export default function LoadingOverlay({ message = "Loading…" }) {
  const onRefresh = () => {
    try {
      window.location.reload();
    } catch (_) {
      try { window.location.href = window.location.href; } catch {}
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-white/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-red-200 bg-white/95 shadow px-5 py-4 text-red-800" role="status" aria-live="polite" aria-busy="true">
        <div className="flex items-center gap-3">
          <span className="inline-block h-5 w-5 rounded-full border-2 border-red-600 border-t-transparent animate-spin" />
          <span className="font-medium">{message}</span>
        </div>
        <div className="mt-3 text-sm text-red-700/90">
          If this screen is stuck, you can refresh safely.
        </div>
        <div className="mt-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center rounded bg-red-600 text-white px-3 py-1.5 font-medium hover:bg-red-700"
          >
            Refresh page
          </button>
        </div>
      </div>
    </div>
  );
}

