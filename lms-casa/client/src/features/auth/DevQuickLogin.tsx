import {
  Crown,
  GraduationCap,
  Loader2,
  UserCircle2,
  UserCog,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export interface DevAccount {
  label: string;
  icon: LucideIcon;
  identifier: string;
  password: string;
  description?: string;
}

const DEV_ACCOUNTS: DevAccount[] = [
  {
    label: 'Super Admin',
    icon: Crown,
    identifier: 'admin@lmscasa.local',
    password: 'Admin@12345',
    description: 'Full access — all 31 permissions',
  },
  {
    label: 'HR',
    icon: UserCog,
    identifier: 'hr@lmscasa.local',
    password: 'Hr@12345',
    description: 'Users, enrollments, reports',
  },
  {
    label: 'Manager',
    icon: UserCog,
    identifier: 'manager@lmscasa.local',
    password: 'Manager@12345',
    description: 'Read-only — sees /team direct reports',
  },
  {
    label: 'Instructor',
    icon: GraduationCap,
    identifier: 'instructor@lmscasa.local',
    password: 'Instructor@12345',
    description: 'Authors courses + exams',
  },
  {
    label: 'Employee',
    icon: UserCircle2,
    identifier: 'employee@lmscasa.local',
    password: 'Employee@12345',
    description: 'Takes courses + exams',
  },
];

interface Props {
  onPick: (account: DevAccount) => void;
  pending?: boolean;
}

export function DevQuickLogin({ onPick, pending }: Props) {
  if (!import.meta.env.DEV) return null;

  return (
    <div className="mt-6 border border-dashed border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
          <Wrench className="h-3.5 w-3.5" />
          DEV — Quick Login
        </div>
        <span className="text-[10px] text-muted-foreground">(hidden in production build)</span>
      </div>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {DEV_ACCOUNTS.map((account) => {
          const Icon = account.icon;
          return (
            <button
              key={account.label}
              type="button"
              disabled={pending}
              onClick={() => onPick(account)}
              className="group flex items-start gap-2 rounded border bg-card px-2 py-1.5 text-left text-xs transition-colors hover:border-primary hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              title={account.description}
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{account.label}</div>
                {account.description && (
                  <div className="truncate text-[10px] text-muted-foreground">
                    {account.description}
                  </div>
                )}
              </div>
              {pending && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Tip: panel นี้ขึ้นเฉพาะตอน <code className="font-mono">vite dev</code> — กดปุ่มจะกรอกฟอร์มและกด login ให้อัตโนมัติ
      </p>
    </div>
  );
}
