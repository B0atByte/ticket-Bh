import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
      <Link
        to="/dashboard"
        className="flex h-6 items-center gap-1 rounded-md px-1.5 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <Home className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">หน้าแรก</span>
      </Link>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={idx} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="rounded-md px-1.5 py-0.5 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={isLast ? 'font-medium text-slate-900' : 'px-1.5'}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
