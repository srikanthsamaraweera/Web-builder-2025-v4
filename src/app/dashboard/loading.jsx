export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-40 rounded bg-red-100 animate-pulse" />
          <div className="mt-2 h-4 w-64 rounded bg-red-50 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 rounded bg-red-100 animate-pulse" />
          <div className="h-9 w-28 rounded bg-red-100 animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-red-200 bg-white shadow-sm overflow-hidden">
            <div className="h-28 bg-red-50 animate-pulse" />
            <div className="p-4 space-y-2">
              <div className="h-4 w-3/4 bg-red-100 rounded animate-pulse" />
              <div className="h-3 w-1/3 bg-red-50 rounded animate-pulse" />
              <div className="h-6 w-24 bg-red-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

