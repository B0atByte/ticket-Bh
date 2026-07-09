import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Award,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  Search,
  Star,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { getMyRecord, getUserRecord } from '../features/users/users.api';

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusLabel(s: string) {
  const MAP: Record<string, { label: string; cls: string }> = {
    ACTIVE:    { label: 'ใช้งาน',     cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    SUSPENDED: { label: 'ระงับ',      cls: 'border-amber-200 bg-amber-50 text-amber-700' },
    INVITED:   { label: 'รอเข้าร่วม', cls: 'border-primary/30 bg-primary/5 text-primary' },
    DISABLED:  { label: 'ปิดใช้งาน', cls: 'border-destructive/20 bg-destructive/10 text-destructive' },
  };
  const m = MAP[s];
  return m ?? { label: s, cls: 'border-border bg-muted text-muted-foreground' };
}

type ExamFilter = 'ALL' | 'PASSED' | 'FAILED' | 'PENDING';
type ActiveTab = 'courses' | 'exams';

export function EmployeeRecordPage({ self = false }: { self?: boolean }) {
  const { id = '' } = useParams();
  const query = useQuery({
    queryKey: self ? ['my-record'] : ['user-record', id],
    queryFn: () => (self ? getMyRecord() : getUserRecord(id)),
    enabled: self || Boolean(id),
  });

  const [tab, setTab] = useState<ActiveTab>('courses');
  const [courseSearch, setCourseSearch] = useState('');
  const [examFilter, setExamFilter] = useState<ExamFilter>('ALL');

  const r = query.data;

  const filteredCourses = useMemo(() => {
    if (!r) return [];
    const q = courseSearch.trim().toLowerCase();
    if (!q) return r.completedCourses;
    return r.completedCourses.filter((c) => c.title.toLowerCase().includes(q));
  }, [r, courseSearch]);

  const filteredAttempts = useMemo(() => {
    if (!r) return [];
    if (examFilter === 'ALL') return r.recentAttempts;
    if (examFilter === 'PASSED') return r.recentAttempts.filter((a) => a.passed === true);
    if (examFilter === 'FAILED') return r.recentAttempts.filter((a) => a.passed === false);
    return r.recentAttempts.filter((a) => a.passed === null);
  }, [r, examFilter]);

  if (query.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (query.isError || !r) {
    return (
      <div className="space-y-4 p-6">
        {!self && (
          <Link to="/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> กลับไปหน้าผู้ใช้
          </Link>
        )}
        <p className="text-destructive">{self ? 'ไม่พบประวัติการอบรมของคุณ' : 'ไม่พบประวัติของผู้ใช้นี้'}</p>
      </div>
    );
  }

  const { level } = r;
  const progressPct =
    level.nextLevelXp == null
      ? 100
      : Math.min(100, Math.round(((level.totalXp - level.levelFloorXp) / (level.nextLevelXp - level.levelFloorXp)) * 100));

  const initials = `${r.user.firstName[0] ?? ''}${r.user.lastName[0] ?? ''}`.toUpperCase();
  const st = statusLabel(r.user.status);

  const examCounts = {
    ALL: r.recentAttempts.length,
    PASSED: r.recentAttempts.filter((a) => a.passed === true).length,
    FAILED: r.recentAttempts.filter((a) => a.passed === false).length,
    PENDING: r.recentAttempts.filter((a) => a.passed === null).length,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      {self ? (
        <h1 className="text-xl font-semibold">ประวัติการอบรมของฉัน</h1>
      ) : (
        <Link to="/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> กลับไปหน้าผู้ใช้
        </Link>
      )}

      {/* Identity card */}
      <div className="border bg-card p-5">
        <div className="flex flex-wrap gap-5">
          {/* Avatar */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
            {initials}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">
                {r.user.firstName} {r.user.lastName}
              </h1>
              <span className={`border px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>
                {st.label}
              </span>
              {r.user.roles.map((role) => (
                <span key={role} className="border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  {role}
                </span>
              ))}
            </div>
            <div className="mt-2 grid gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
              <span>{r.user.email}</span>
              <span>รหัสพนักงาน: <span className="text-foreground">{r.user.employeeId ?? '—'}</span></span>
              <span>สาขา / แผนก: <span className="text-foreground">{r.user.department?.name ?? '—'}</span></span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                เข้าร่วม: {formatDate(r.user.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                เข้าสู่ระบบล่าสุด: {formatDate(r.user.lastLoginAt)}
              </span>
            </div>
          </div>

          {/* Level */}
          <div className="flex shrink-0 flex-col items-center border bg-primary/5 px-5 py-3 min-w-[160px]">
            <Award className="h-5 w-5 text-primary" />
            <div className="mt-1 text-3xl font-bold text-primary leading-none">Lv.{level.level}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{level.totalXp.toLocaleString()} XP</div>
            <div className="mt-2 h-1.5 w-full overflow-hidden bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="mt-1 text-center text-[10px] text-muted-foreground leading-tight">
              {level.nextLevelXp == null
                ? 'ระดับสูงสุด'
                : `อีก ${(level.nextLevelXp - level.totalXp).toLocaleString()} XP → Lv.${level.level + 1}`}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard icon={<Star className="h-4 w-4 fill-amber-400 text-amber-400" />} label="ดาวสะสม" value={r.stars} color="bg-amber-50" />
        <StatCard icon={<BookOpen className="h-4 w-4 text-primary" />} label="ลงทะเบียนทั้งหมด" value={r.totalEnrollments} color="bg-secondary" />
        <StatCard icon={<BookOpenCheck className="h-4 w-4 text-primary" />} label="เรียนจบ (บทเรียน)" value={r.coursesCompletedCount} color="bg-primary/5" />
        <StatCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="สอบผ่าน" value={r.examSummary.passed} color="bg-emerald-50" />
        <StatCard icon={<XCircle className="h-4 w-4 text-destructive" />} label="สอบไม่ผ่าน" value={r.examSummary.failed} color="bg-destructive/5" />
      </div>

      {/* Tabs */}
      <div className="border bg-card">
        {/* Tab bar */}
        <div className="flex border-b">
          <TabButton
            active={tab === 'courses'}
            onClick={() => setTab('courses')}
            icon={<BookOpenCheck className="h-4 w-4" />}
            label="คอร์สที่ผ่าน"
            count={r.coursesCompletedCount}
          />
          <TabButton
            active={tab === 'exams'}
            onClick={() => setTab('exams')}
            icon={<ClipboardList className="h-4 w-4" />}
            label="ประวัติการสอบ"
            count={r.examSummary.total}
          />
        </div>

        {/* Tab: Courses */}
        {tab === 'courses' && (
          <div>
            {r.completedCourses.length > 0 && (
              <div className="p-3 border-b">
                <div className="relative max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    placeholder="ค้นหาชื่อคอร์ส…"
                    className="pl-9 h-8 text-sm"
                  />
                </div>
              </div>
            )}
            {filteredCourses.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {courseSearch ? 'ไม่พบคอร์สที่ตรงกับคำค้นหา' : 'ยังไม่มีคอร์สที่เรียนจบ'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5">ชื่อคอร์ส</th>
                      <th className="px-4 py-2.5 text-right">วันที่ผ่าน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredCourses.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-medium">{c.title}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground whitespace-nowrap">{formatDate(c.completedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Exams */}
        {tab === 'exams' && (
          <div>
            {r.recentAttempts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-3 border-b">
                {(['ALL', 'PASSED', 'FAILED', 'PENDING'] as ExamFilter[]).map((f) => (
                  <FilterChip
                    key={f}
                    active={examFilter === f}
                    onClick={() => setExamFilter(f)}
                    label={f === 'ALL' ? 'ทั้งหมด' : f === 'PASSED' ? 'ผ่าน' : f === 'FAILED' ? 'ไม่ผ่าน' : 'รอตรวจ'}
                    count={examCounts[f]}
                  />
                ))}
              </div>
            )}
            {filteredAttempts.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {r.recentAttempts.length === 0 ? 'ยังไม่มีประวัติการสอบ' : 'ไม่มีรายการในหมวดนี้'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] text-sm">
                  <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5">ชื่อข้อสอบ</th>
                      <th className="px-4 py-2.5 text-center">คะแนน</th>
                      <th className="px-4 py-2.5 text-center">ผล</th>
                      <th className="px-4 py-2.5 text-right">วันที่ทำ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredAttempts.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-medium">{a.examTitle}</td>
                        <td className="px-4 py-2.5 text-center tabular-nums text-muted-foreground">
                          {a.scorePct != null ? `${a.scorePct}%` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {a.passed === true ? (
                            <span className="border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">ผ่าน</span>
                          ) : a.passed === false ? (
                            <span className="border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">ไม่ผ่าน</span>
                          ) : (
                            <span className="border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">รอตรวจ</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground whitespace-nowrap">{formatDate(a.submittedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3 border bg-card p-3.5">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center ${color}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xl font-semibold leading-none">{value.toLocaleString()}</div>
        <div className="mt-0.5 text-xs text-muted-foreground leading-tight">{label}</div>
      </div>
    </div>
  );
}

function TabButton({
  active, onClick, icon, label, count,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {label}
      <span className={`border px-1.5 py-0.5 text-[11px] leading-none ${
        active ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground'
      }`}>
        {count}
      </span>
    </button>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'
      }`}
    >
      {label} ({count})
    </button>
  );
}
