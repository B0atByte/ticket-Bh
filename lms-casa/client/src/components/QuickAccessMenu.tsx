import { ExternalLink, Grid2x2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { otherSystems } from '../lib/quickAccess';

export function QuickAccessMenu() {
  const [open, setOpen] = useState(false);
  const systems = otherSystems('lmscasa');

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label="ไปยังระบบอื่น">
        <Grid2x2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-40 w-60 rounded-lg border border-border bg-popover p-1.5 shadow-xl">
            <p className="px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">ไปยังระบบอื่น</p>
            {systems.map((s) => (
              <a
                key={s.key}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <span className="truncate">{s.label}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
