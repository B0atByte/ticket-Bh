export function OrderCardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm animate-pulse dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-36 rounded-md bg-slate-100 dark:bg-slate-800" />
          <div className="h-3.5 w-56 max-w-full rounded-md bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="h-6 w-24 rounded-md bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-md bg-slate-50 p-3 dark:bg-slate-800/70">
            <div className="h-3 w-14 rounded-md bg-slate-100 dark:bg-slate-800" />
            <div className="mt-2 h-3.5 w-20 rounded-md bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function OrderListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </div>
  )
}
