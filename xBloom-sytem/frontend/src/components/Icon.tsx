import type { ReactNode } from "react";

// Stroke-based line icons (lucide-style) matching the mockup's .ico look.
// No emoji anywhere in the app — always use <Icon name=… />.
const PATHS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9h12v-9" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5c0 4.4 2.9 8.2 7 9.5 4.1-1.3 7-5.1 7-9.5V6z" />
      <polyline points="9 11.5 11 13.5 15 9.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7.5 12 12 15 14" />
    </>
  ),
  tool: (
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2-2 2.4-2.4z" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16.5" />
      <circle cx="12" cy="7.8" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 3 19h18z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <circle cx="12" cy="16.6" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  check: <polyline points="5 12.5 10 17.5 19 7" />,
  chevronRight: <polyline points="9 6 15 12 9 18" />,
  chevronLeft: <polyline points="15 6 9 12 15 18" />,
  close: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <polyline points="14 3 14 8 19 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="16.5" x2="13" y2="16.5" />
    </>
  ),
  video: (
    <>
      <polygon points="22 7 16 11 22 15" />
      <rect x="2" y="6" width="14" height="12" rx="1" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </>
  ),
  box: (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.3 7 12 12 20.7 7" />
      <line x1="12" y1="12" x2="12" y2="21" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7H7l1.2-1.8A1 1 0 0 1 9 4.7h6a1 1 0 0 1 .8.5L17 7h2.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="13" r="3.2" />
    </>
  ),
  arrowDown: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="6 13 12 19 18 13" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9a2 2 0 0 0-3-3L5 17z" />
      <line x1="14.5" y1="6.5" x2="17.5" y2="9.5" />
    </>
  ),
  trash: (
    <>
      <line x1="4.5" y1="7" x2="19.5" y2="7" />
      <path d="M6.5 7l1 12h9l1-12" />
      <path d="M9.5 7V4.5h5V7" />
    </>
  ),
  swap: (
    <>
      <polyline points="7 4 4 7 7 10" />
      <path d="M4 7h11a4 4 0 0 1 4 4" />
      <polyline points="17 20 20 17 17 14" />
      <path d="M20 17H9a4 4 0 0 1-4-4" />
    </>
  ),
  chart: (
    <>
      <line x1="4" y1="20" x2="20" y2="20" />
      <rect x="6" y="11" width="3" height="6" />
      <rect x="11" y="7" width="3" height="10" />
      <rect x="16" y="13" width="3" height="4" />
    </>
  ),
  list: (
    <>
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <line x1="4.5" y1="6" x2="4.5" y2="6" />
      <line x1="4.5" y1="12" x2="4.5" y2="12" />
      <line x1="4.5" y1="18" x2="4.5" y2="18" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1.3" />
      <circle cx="17" cy="20" r="1.3" />
      <path d="M3 4h2l2.2 11.2a1 1 0 0 0 1 .8h8.4a1 1 0 0 0 1-.8L20 7H6" />
    </>
  ),
  external: (
    <>
      <path d="M14 5h5v5" />
      <line x1="19" y1="5" x2="11" y2="13" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="1.5" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </>
  ),
  store: (
    <>
      <path d="M4 9.5 5 5h14l1 4.5" />
      <path d="M5 9.5V19h14V9.5" />
      <path d="M9.5 19v-4.5h5V19" />
    </>
  ),
  recycle: (
    <>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3" />
      <polyline points="17.5 3.5 17.5 7 14 7" />
      <path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3" />
      <polyline points="6.5 20.5 6.5 17 10 17" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.7a3 3 0 0 1 0 5.6" />
      <path d="M17.5 13.2a5 5 0 0 1 3 4.8" />
    </>
  ),
  send: (
    <>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
