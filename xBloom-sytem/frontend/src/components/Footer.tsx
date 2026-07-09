import { APP_VERSION, COPYRIGHT } from "../lib/version";

export default function Footer({ className = "" }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <div className={`text-center text-[11px] text-grey ${className}`}>
      © {year} {COPYRIGHT} · v{APP_VERSION} · <span className="font-bold text-accent">DEMO</span>
    </div>
  );
}
