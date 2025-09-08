export default function GlobalLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-3 text-red-700" aria-live="polite" aria-busy="true">
          <span className="inline-block h-3 w-3 rounded-full bg-red-600 animate-bounce [animation-delay:0ms]"></span>
          <span className="inline-block h-3 w-3 rounded-full bg-red-600 animate-bounce [animation-delay:150ms]"></span>
          <span className="inline-block h-3 w-3 rounded-full bg-red-600 animate-bounce [animation-delay:300ms]"></span>
          <span className="ml-2 font-medium">Loading…</span>
        </div>
      </div>
    </div>
  );
}

