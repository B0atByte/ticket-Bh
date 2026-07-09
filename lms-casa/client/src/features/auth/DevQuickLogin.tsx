import {
  Crown,
  GraduationCap,
  Loader2,
  UserCircle2,
  UserCog,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';

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

const DEV_PIN = '2905';

interface Props {
  onPick: (account: DevAccount) => void;
  pending?: boolean;
}

export function DevQuickLogin({ onPick, pending }: Props) {
  if (!import.meta.env.DEV) return null;

  const [digits, setDigits] = useState(['', '', '', '']);
  const [shake, setShake] = useState(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const pin = digits.join('');
  const unlocked = pin === DEV_PIN;

  function handleDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = digits.map((d, i) => (i === index ? digit : d));
    setDigits(next);

    if (digit && index < 3) {
      inputRefs[index + 1]?.current?.focus();
    }

    const entered = next.join('');
    if (entered.length === 4 && !entered.split('').some((d) => d === '') && entered !== DEV_PIN) {
      setShake(true);
      setTimeout(() => {
        setDigits(['', '', '', '']);
        setShake(false);
        inputRefs[0]?.current?.focus();
      }, 500);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1]?.current?.focus();
    }
  }

  return (
    <div className="mt-6 border border-dashed border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
          <Wrench className="h-3.5 w-3.5" />
          DEV — Quick Login
        </div>
        <span className="text-[10px] text-muted-foreground">(hidden in production build)</span>
      </div>

      {!unlocked ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <p className="text-[11px] text-muted-foreground">ใส่ PIN 4 หลักเพื่อใช้งาน</p>
          <div className={`flex gap-2 ${shake ? 'animate-shake' : ''}`}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={inputRefs[i]}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={`h-10 w-10 border text-center text-sm font-semibold outline-none transition-colors
                  focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30
                  ${shake ? 'border-destructive bg-destructive/5' : 'border-input bg-background'}`}
              />
            ))}
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
