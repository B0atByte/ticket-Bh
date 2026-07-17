import { useState } from "react";
import { Icon } from "./Icon";
import { otherSystems } from "../lib/quickAccess";

export default function QuickAccessMenu() {
  const [open, setOpen] = useState(false);
  const systems = otherSystems("xbloom");

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex h-8 w-8 items-center justify-center rounded-xl2 text-muted hover:text-ink" aria-label="ไปยังระบบอื่น">
        <Icon name="dashboard" size={18} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-40 w-60 rounded-xl2 border border-line bg-card p-1.5 shadow-lg">
            <p className="px-2.5 py-1.5 text-xs font-semibold text-muted">ไปยังระบบอื่น</p>
            {systems.map((s) => (
              <a
                key={s.key}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 rounded-xl2 px-2.5 py-2 text-sm text-ink hover:bg-canvas"
              >
                <span className="truncate">{s.label}</span>
                <Icon name="external" size={13} className="shrink-0 text-muted" />
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
