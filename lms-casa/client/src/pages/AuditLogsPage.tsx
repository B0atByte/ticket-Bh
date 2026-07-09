import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, FileText, Loader2, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { downloadAuditLogs, listAuditLogs, type AuditLogFilters, type AuditLogItem } from '../features/admin/admin.api';

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

const ENTITY_LABELS: Record<string, string> = {
  user: 'ผู้ใช้',
  course: 'หลักสูตร',
  module: 'หมวดบทเรียน',
  lesson: 'บทเรียน',
  exam: 'แบบทดสอบ',
  attempt: 'การสอบ',
  question: 'คำถาม',
  question_bank: 'คลังคำถาม',
  department: 'แผนก',
  notification: 'การแจ้งเตือน',
  settings: 'ตั้งค่าระบบ',
  audit_log: 'บันทึกกิจกรรม',
  report: 'รายงาน',
  me: 'บัญชีของฉัน',
  auth: 'เข้าสู่ระบบ',
};

const ACTION_LABELS: Record<string, string> = {
  'auth.register': 'สร้างบัญชีผู้ใช้',
  'auth.login': 'เข้าสู่ระบบ',
  'auth.login.fail': 'เข้าสู่ระบบไม่สำเร็จ',
  'auth.logout': 'ออกจากระบบ',
  'auth.oidc.login': 'เข้าสู่ระบบด้วย SSO',
  'audit.export': 'ส่งออกบันทึกกิจกรรม',
  'user.password_change': 'เปลี่ยนรหัสผ่านผู้ใช้',
  'me.data_export': 'ดาวน์โหลดข้อมูลส่วนตัว',
  'me.anonymize': 'ลบบัญชีตามสิทธิส่วนบุคคล',
  'exam.question.assign': 'เพิ่มคำถามในแบบทดสอบ',
  'attempt.response.save': 'บันทึกคำตอบ',
  'settings.branding.update': 'แก้ไขแบรนด์ระบบ',
  'settings.branding.logo.upload': 'อัปโหลดโลโก้ระบบ',
  'notification.self_test': 'ทดสอบการแจ้งเตือน',
  'lesson.afk_failed': 'ไม่ผ่านการตรวจ Anti-AFK',
  'question.import': 'นำเข้าคำถาม',
  'report.export': 'ส่งออกรายงาน',
};

const VERB_LABELS: Record<string, string> = {
  create: 'สร้าง',
  update: 'แก้ไข',
  delete: 'ลบ',
  publish: 'เผยแพร่',
  archive: 'เก็บถาวร',
  reorder: 'จัดลำดับ',
  start: 'เริ่ม',
  submit: 'ส่งคำตอบ',
};

function clean(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function startOfDay(value: string): string | undefined {
  const date = clean(value);
  return date ? `${date}T00:00:00.000` : undefined;
}

function endOfDay(value: string): string | undefined {
  const date = clean(value);
  return date ? `${date}T23:59:59.999` : undefined;
}

function actorLabel(item: AuditLogItem): string {
  if (item.actor) {
    const name = `${item.actor.firstName} ${item.actor.lastName}`.trim();
    return name ? `${name} (${item.actor.email})` : item.actor.email;
  }
  return item.actorId ?? 'ระบบ';
}

function hasDetails(item: AuditLogItem): boolean {
  return Boolean(item.ipAddress || item.userAgent || item.changes || item.metadata);
}

function formatDetails(item: AuditLogItem): string {
  return JSON.stringify(
    {
      ipAddress: item.ipAddress ?? undefined,
      userAgent: item.userAgent ?? undefined,
      changes: item.changes ?? undefined,
      metadata: item.metadata ?? undefined,
    },
    null,
    2,
  );
}

function entityLabel(entityType?: string | null): string {
  if (!entityType) return 'ระบบ';
  return ENTITY_LABELS[entityType] ?? entityType;
}

function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const [entity, verb] = action.split('.');
  const verbText = verb ? VERB_LABELS[verb] : undefined;
  const entityText = entityLabel(entity);
  return verbText ? `${verbText}${entityText}` : action;
}

function actionTone(action: string): string {
  if (action.includes('fail') || action.includes('delete') || action.includes('anonymize') || action.includes('afk_failed')) {
    return 'border border-destructive/20 bg-destructive/5 text-destructive';
  }
  if (action.includes('export') || action.includes('download')) {
    return 'border border-primary/30 bg-primary/5 text-primary';
  }
  if (action.includes('create') || action.includes('publish') || action.includes('login')) {
    return 'border border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  return 'border border-border bg-secondary text-secondary-foreground';
}

export function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1, pageSize: 50 });
  const [draft, setDraft] = useState({ q: '', action: '', entityType: '', actorId: '', from: '', to: '' });
  const query = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => listAuditLogs(filters),
    placeholderData: (previous) => previous,
  });
  const exportMutation = useMutation({
    mutationFn: () => downloadAuditLogs({ ...filters, page: undefined, pageSize: undefined }),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });

  function applyFilters(): void {
    setFilters({
      page: 1,
      pageSize: filters.pageSize,
      q: clean(draft.q),
      action: clean(draft.action),
      entityType: clean(draft.entityType),
      actorId: clean(draft.actorId),
      from: startOfDay(draft.from),
      to: endOfDay(draft.to),
    });
  }

  function resetFilters(): void {
    setDraft({ q: '', action: '', entityType: '', actorId: '', from: '', to: '' });
    setFilters({ page: 1, pageSize: filters.pageSize });
  }

  function setPage(page: number): void {
    setFilters((current) => ({ ...current, page }));
  }

  function setPageSize(pageSize: number): void {
    setFilters((current) => ({ ...current, page: 1, pageSize }));
  }

  const items = query.data?.items ?? [];
  const meta = query.data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const currentPage = meta?.page ?? filters.page ?? 1;
  const pageSize = meta?.pageSize ?? filters.pageSize ?? 50;
  const range = useMemo(() => {
    const total = meta?.total ?? 0;
    if (total === 0) return '0 รายการ';
    const start = ((currentPage - 1) * pageSize) + 1;
    const end = Math.min(currentPage * pageSize, total);
    return `${start.toLocaleString('th-TH')}-${end.toLocaleString('th-TH')} จาก ${total.toLocaleString('th-TH')} รายการ`;
  }, [currentPage, meta?.total, pageSize]);
  const failedOnPage = items.filter((item) => item.action.includes('fail')).length;
  const systemOnPage = items.filter((item) => !item.actorId).length;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">บันทึกกิจกรรม</h1>
        <p className="mt-1 text-sm text-muted-foreground">ตรวจสอบกิจกรรมในระบบและ export ไฟล์ตามตัวกรอง</p>
      </section>

      <section className="border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Input placeholder="ค้นหาผู้ใช้ / กิจกรรม / IP" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
          <Input placeholder="กิจกรรม เช่น login, course.create" value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} />
          <Input placeholder="ส่วนของระบบ เช่น course, exam" value={draft.entityType} onChange={(e) => setDraft({ ...draft, entityType: e.target.value })} />
          <Input placeholder="User ID ผู้ใช้งาน" value={draft.actorId} onChange={(e) => setDraft({ ...draft, actorId: e.target.value })} />
          <Input type="date" aria-label="จากวันที่" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          <Input type="date" aria-label="ถึงวันที่" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={applyFilters}>
            <Search className="h-4 w-4" />
            กรอง
          </Button>
          <Button variant="outline" onClick={resetFilters}>
            <X className="h-4 w-4" />
            ล้างตัวกรอง
          </Button>
          <Button variant="outline" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
            {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            ส่งออก Excel
          </Button>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span>แสดงต่อหน้า</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-8 border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="บันทึกทั้งหมด" value={(meta?.total ?? 0).toLocaleString('th-TH')} />
        <SummaryCard label="รายการในหน้านี้" value={items.length.toLocaleString('th-TH')} />
        <SummaryCard label="รายการที่ควรตรวจ" value={failedOnPage.toLocaleString('th-TH')} hint={systemOnPage > 0 ? `ระบบทำงานเอง ${systemOnPage.toLocaleString('th-TH')} รายการ` : undefined} />
      </section>

      <section className="overflow-hidden border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>{range}</span>
            {query.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
          </div>
          <PaginationControls
            page={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            disabled={query.isFetching}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">เวลา</th>
                <th className="px-4 py-3">ผู้ใช้งาน</th>
                <th className="px-4 py-3">สิ่งที่ทำ</th>
                <th className="px-4 py-3">รายการที่เกี่ยวข้อง</th>
                <th className="px-4 py-3">ข้อมูลเพิ่มเติม</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr><td className="px-4 py-6" colSpan={5}><Loader2 className="h-5 w-5 animate-spin text-primary" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td className="px-4 py-6 text-muted-foreground" colSpan={5}>ไม่พบบันทึกกิจกรรม</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b align-top last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="font-medium text-foreground">{new Date(item.createdAt).toLocaleDateString('th-TH')}</div>
                      <div className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleTimeString('th-TH')}</div>
                    </td>
                    <td className="max-w-[280px] px-4 py-3">
                      <span className="line-clamp-2 font-medium text-foreground">{actorLabel(item)}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{item.actorId ? `ID: ${item.actorId}` : 'System'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold ${actionTone(item.action)}`}>
                        {actionLabel(item.action)}
                      </span>
                      <div className="mt-1 font-mono text-[11px] text-muted-foreground">{item.action}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{entityLabel(item.entityType)}</div>
                      {item.entityId && <div className="text-xs text-muted-foreground">ID: {item.entityId}</div>}
                    </td>
                    <td className="w-[260px] px-4 py-3">
                      <div className="text-xs text-muted-foreground">IP: {item.ipAddress ?? '-'}</div>
                      {hasDetails(item) ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">ข้อมูลเทคนิค</summary>
                          <pre className="mt-2 max-h-64 overflow-auto bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
                            {formatDetails(item)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground">{range}</span>
          <PaginationControls
            page={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            disabled={query.isFetching}
          />
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border bg-card p-4 shadow-warm-sm">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function PaginationControls({
  page,
  totalPages,
  onPageChange,
  disabled,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  const canPrev = page > 1;
  const canNext = page < totalPages;
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" className="h-8 w-8" disabled={disabled || !canPrev} onClick={() => onPageChange(1)} aria-label="หน้าแรก">
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" disabled={disabled || !canPrev} onClick={() => onPageChange(page - 1)} aria-label="หน้าก่อนหน้า">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="px-3 text-xs text-muted-foreground">
        หน้า {page.toLocaleString('th-TH')} / {totalPages.toLocaleString('th-TH')}
      </span>
      <Button variant="outline" size="icon" className="h-8 w-8" disabled={disabled || !canNext} onClick={() => onPageChange(page + 1)} aria-label="หน้าถัดไป">
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" disabled={disabled || !canNext} onClick={() => onPageChange(totalPages)} aria-label="หน้าสุดท้าย">
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
