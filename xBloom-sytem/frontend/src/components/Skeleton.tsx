// Skeleton placeholders shown while data loads.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl2 bg-card2 ${className}`} />;
}

/** Skeleton rows for the staff tables. */
export function SkeletonTable({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl2 border border-line">
      <div className="flex gap-3 border-b border-line bg-card2 px-3 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 border-b border-line/60 px-3 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton stat cards (dashboard). */
export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl2 border border-line bg-card p-4">
          <Skeleton className="mb-3 h-3 w-2/3" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a generic card body (customer result / CRM panel). */
export function SkeletonCard({ lines = 4 }: { lines?: number }) {
  return (
    <div className="rounded-xl2 border border-line bg-card p-5">
      <Skeleton className="mb-4 h-5 w-1/2" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="mb-2.5 h-4 w-full" />
      ))}
    </div>
  );
}

/** CRM two-column skeleton. */
export function SkeletonCrm() {
  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[380px_1fr]">
      <div className="flex flex-col gap-5">
        <SkeletonCard lines={6} />
        <SkeletonCard lines={3} />
      </div>
      <SkeletonCard lines={5} />
    </div>
  );
}
