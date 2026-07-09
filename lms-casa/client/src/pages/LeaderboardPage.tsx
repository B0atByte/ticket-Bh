import { useQuery } from '@tanstack/react-query';
import {
  Award,
  Building2,
  Crown,
  Loader2,
  Medal,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../features/auth/auth.store';
import {
  getLeaderboard,
  getMyPoints,
  type LeaderboardEntry,
} from '../features/points/points.api';

type Scope = 'org' | 'department';

export function LeaderboardPage() {
  const { t } = useTranslation();
  const me = useAuthStore((s) => s.user);
  const [scope, setScope] = useState<Scope>('org');

  const myPoints = useQuery({ queryKey: ['points', 'me'], queryFn: getMyPoints });
  const lb = useQuery({
    queryKey: ['leaderboard', scope],
    queryFn: () => getLeaderboard({ scope, limit: 50 }),
  });

  const myUserId = me?.id ?? '';
  const myRank = scope === 'org' ? myPoints.data?.rankOrg : myPoints.data?.rankDept;
  const deptName = myPoints.data?.departmentName;
  const hasDept = Boolean(myPoints.data?.departmentId);

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center border bg-muted">
          <Trophy className="h-5 w-5 text-muted-foreground" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{t('leaderboard.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('leaderboard.subtitle')}</p>
        </div>
      </header>

      <section
        className="border bg-card p-5"
        aria-label={t('leaderboard.myRankAria')}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center border border-amber-200 bg-amber-50 text-amber-700">
              <Sparkles className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('leaderboard.totalXp')}
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {myPoints.isLoading ? '—' : (myPoints.data?.totalXp ?? 0).toLocaleString()}
                <span className="ml-1 text-sm font-normal text-muted-foreground">XP</span>
              </div>
            </div>
          </div>
          <RankBadge label={t('leaderboard.rankOrg')} rank={myPoints.data?.rankOrg ?? null} />
          <RankBadge
            label={t('leaderboard.rankDept')}
            rank={myPoints.data?.rankDept ?? null}
            hint={deptName ?? undefined}
          />
        </div>
      </section>

      <div role="tablist" aria-label={t('leaderboard.scopeAria')} className="flex gap-2">
        <ScopeTab
          active={scope === 'org'}
          onClick={() => setScope('org')}
          icon={Users}
          label={t('leaderboard.scopeOrg')}
        />
        <ScopeTab
          active={scope === 'department'}
          onClick={() => setScope('department')}
          icon={Building2}
          label={
            hasDept && deptName
              ? `${t('leaderboard.scopeDept')} (${deptName})`
              : t('leaderboard.scopeDept')
          }
          disabled={!hasDept}
        />
      </div>

      <section className="border bg-card" aria-label={t('leaderboard.tableAria')}>
        {lb.isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !lb.data || lb.data.entries.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {scope === 'department' && !hasDept
              ? t('leaderboard.noDept')
              : t('leaderboard.empty')}
          </div>
        ) : (
          <ol className="divide-y">
            {lb.data.entries.map((entry) => (
              <LeaderboardRow key={entry.userId} entry={entry} isMe={entry.userId === myUserId} />
            ))}
          </ol>
        )}
      </section>

      {myRank != null && myRank > (lb.data?.entries.length ?? 0) && lb.data && (
        <p className="text-center text-xs text-muted-foreground">
          {t('leaderboard.yourPositionHint', { rank: myRank })}
        </p>
      )}
    </div>
  );
}

function ScopeTab({
  active,
  onClick,
  icon: Icon,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-2 border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-primary bg-primary/5 text-primary'
          : 'bg-card hover:bg-accent'
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}

function RankBadge({
  label,
  rank,
  hint,
}: {
  label: string;
  rank: number | null;
  hint?: string;
}) {
  return (
    <div className="text-right">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">
        {rank == null ? '—' : `#${rank}`}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function LeaderboardRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const fullName = `${entry.firstName} ${entry.lastName}`.trim();
  const initials = (entry.firstName[0] ?? '') + (entry.lastName[0] ?? '');
  return (
    <li
      className={`flex items-center gap-3 px-4 py-3 ${
        isMe ? 'bg-primary/5' : ''
      }`}
      aria-current={isMe ? 'true' : undefined}
    >
      <div className="flex w-10 shrink-0 items-center justify-center font-semibold tabular-nums">
        <RankIndicator rank={entry.rank} />
      </div>
      <Avatar avatarUrl={entry.avatarUrl} initials={initials} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {fullName}
          {isMe && (
            <span className="ml-2 border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              YOU
            </span>
          )}
        </div>
        {entry.departmentName && (
          <div className="truncate text-xs text-muted-foreground">{entry.departmentName}</div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold tabular-nums">{entry.totalXp.toLocaleString()}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">XP</div>
      </div>
    </li>
  );
}

function RankIndicator({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-amber-500" aria-label="Rank 1" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-muted-foreground" aria-label="Rank 2" />;
  if (rank === 3) return <Award className="h-5 w-5 text-orange-500" aria-label="Rank 3" />;
  return <span className="text-sm text-muted-foreground">{rank}</span>;
}

function Avatar({ avatarUrl, initials }: { avatarUrl: string | null; initials: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full border bg-muted object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold uppercase text-muted-foreground"
    >
      {initials || '?'}
    </div>
  );
}
