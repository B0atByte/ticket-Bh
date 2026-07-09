import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  Send,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { RichTextView } from '../components/ui/RichTextEditor';
import { useAuthStore } from '../features/auth/auth.store';
import { confirmAction, confirmDanger } from '../lib/confirm';
import { ExamFormDialog } from '../features/admin/ExamFormDialog';
import {
  archiveExam,
  assignQuestion,
  deleteExam,
  getExam,
  listAllExams,
  publishExam,
} from '../features/admin/exams.api';
import { listBanks, listQuestions, type QuestionBank } from '../features/admin/questions.api';

function statusLabel(status: string): string {
  if (status === 'PUBLISHED') return 'เผยแพร่แล้ว';
  if (status === 'DRAFT') return 'ฉบับร่าง';
  if (status === 'ARCHIVED') return 'ถูกเก็บแล้ว';
  return status;
}

export function ExamBuilderListPage() {
  const canCreate = useAuthStore((s) => s.hasPermission('exam.create'));
  const query = useQuery({ queryKey: ['exams', 'admin'], queryFn: listAllExams });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center border bg-card">
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">สร้างข้อสอบ</h1>
            <p className="text-sm text-muted-foreground">
              ข้อสอบทั้งหมด {query.data?.meta.total ?? 0} ชุด
            </p>
          </div>
        </div>
        {canCreate && <ExamFormDialog mode="create" />}
      </div>

      {query.isLoading && (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังโหลด…
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {(query.data?.items ?? []).map((exam) => (
          <Link
            key={exam.id}
            to={`/admin/exams/${exam.id}`}
            className="block border bg-card p-4 transition-colors hover:bg-accent"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{exam.title}</h3>
              <span
                className={`border px-2 py-0.5 text-[10px] font-medium ${
                  exam.status === 'PUBLISHED'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : exam.status === 'DRAFT'
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-border bg-muted text-muted-foreground'
                }`}
              >
                {statusLabel(exam.status)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {exam._count?.questions ?? 0} ข้อ · ผ่านที่ {exam.passingScore}% ·{' '}
              {exam.timeLimitMinutes ? `${exam.timeLimitMinutes} นาที` : 'ไม่จำกัดเวลา'}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ExamBuilderDetailPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canUpdate = useAuthStore((s) => s.hasPermission('exam.update'));
  const canPublish = useAuthStore((s) => s.hasPermission('exam.publish'));
  const canDelete = useAuthStore((s) => s.hasPermission('exam.delete'));
  const [showPicker, setShowPicker] = useState(false);

  const examQuery = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => getExam(examId!),
    enabled: Boolean(examId),
  });

  const publishMut = useMutation({
    mutationFn: () => publishExam(examId!),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['exam', examId] }),
  });
  const archiveMut = useMutation({
    mutationFn: () => archiveExam(examId!),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['exam', examId] }),
  });
  const deleteMut = useMutation({
    mutationFn: () => deleteExam(examId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exams', 'admin'] });
      navigate('/admin/exams');
    },
  });
  const assignMut = useMutation({
    mutationFn: (questionId: string) => assignQuestion(examId!, questionId, 1),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['exam', examId] }),
  });

  if (examQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  if (!examQuery.data) {
    return <div className="border bg-card p-4 text-sm text-destructive">ไม่พบข้อสอบ</div>;
  }
  const exam = examQuery.data;
  const assignedIds = new Set((exam.questions ?? []).map((q) => q.questionId));

  return (
    <div className="space-y-6">
      <section className="border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">{exam.type}</div>
            <h1 className="mt-1 text-2xl font-semibold">{exam.title}</h1>
            {exam.description && (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{exam.description}</p>
            )}
          </div>
          <span
            className={`border px-2 py-0.5 text-[10px] font-medium ${
              exam.status === 'PUBLISHED'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : exam.status === 'DRAFT'
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-border bg-muted text-muted-foreground'
            }`}
          >
            {statusLabel(exam.status)}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">เกณฑ์ผ่าน</dt>
            <dd>{exam.passingScore}%</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">เวลา</dt>
            <dd>{exam.timeLimitMinutes ? `${exam.timeLimitMinutes} นาที` : 'ไม่จำกัด'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">จำนวนครั้งที่ทำได้</dt>
            <dd>{exam.maxAttempts ?? 'ไม่จำกัด'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">จำนวนคำถาม</dt>
            <dd>{exam.questions?.length ?? 0}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
          {canUpdate && (
            <ExamFormDialog
              mode="edit"
              exam={exam}
              trigger={
                <Button variant="secondary">
                  <Pencil className="h-4 w-4" /> แก้ไขการตั้งค่า
                </Button>
              }
            />
          )}
          {canPublish && exam.status === 'DRAFT' && (
            <Button
              onClick={async () => {
                if (await confirmAction('เผยแพร่ข้อสอบ?', `ข้อสอบ <b>${exam.title}</b> จะมองเห็นได้สำหรับผู้เรียน`, 'เผยแพร่'))
                  publishMut.mutate();
              }}
              disabled={publishMut.isPending}
            >
              <Send className="h-4 w-4" /> เผยแพร่
            </Button>
          )}
          {canPublish && exam.status === 'PUBLISHED' && (
            <Button
              variant="secondary"
              onClick={async () => {
                if (await confirmDanger('เก็บถาวรข้อสอบ?', `ข้อสอบ <b>${exam.title}</b> จะถูกซ่อนจากผู้เรียน`, 'เก็บถาวร'))
                  archiveMut.mutate();
              }}
              disabled={archiveMut.isPending}
            >
              <Archive className="h-4 w-4" /> เก็บถาวร
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              onClick={async () => {
                if (await confirmDanger('ลบข้อสอบ?', `ลบ <b>${exam.title}</b> ออกจากระบบ?<br><small>การกระทำนี้ไม่สามารถยกเลิกได้</small>`))
                  deleteMut.mutate();
              }}
            >
              ลบ
            </Button>
          )}
        </div>
      </section>

      <AssignedQuestionsSection
        exam={exam}
        canUpdate={canUpdate}
        showPicker={showPicker}
        toggleShowPicker={() => setShowPicker((v) => !v)}
        onPick={(id) => assignMut.mutate(id)}
        isPending={assignMut.isPending}
        assignedIds={assignedIds}
      />
    </div>
  );
}

// ─── Assigned questions section ──────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const TYPE_LABEL: Record<string, string> = {
  SINGLE_CHOICE: 'เลือกข้อเดียว',
  MULTIPLE_CHOICE: 'หลายข้อ',
  TRUE_FALSE: 'ถูก/ผิด',
  FILL_BLANK: 'เติมคำ',
  SHORT_ANSWER: 'ตอบสั้น',
  ESSAY: 'อัตนัย',
  MATCHING: 'จับคู่',
  ORDERING: 'เรียงลำดับ',
  DRAG_DROP: 'ลาก-วาง',
  HOTSPOT: 'จุดร้อน',
  FILE_UPLOAD: 'อัปโหลดไฟล์',
  LIKERT: 'สเกล',
};

function AssignedQuestionsSection({
  exam,
  canUpdate,
  showPicker,
  toggleShowPicker,
  onPick,
  isPending,
  assignedIds,
}: {
  exam: { questions?: Array<{ id: string; questionId: string; points: number; question?: { id: string; type: string; text: string; difficulty: string } }> };
  canUpdate: boolean;
  showPicker: boolean;
  toggleShowPicker: () => void;
  onPick: (id: string) => void;
  isPending: boolean;
  assignedIds: Set<string>;
}) {
  const items = exam.questions ?? [];
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  // Stats
  const totalPoints = items.reduce((s, q) => s + q.points, 0);
  const typeCounts = items.reduce<Record<string, number>>((acc, q) => {
    const t = q.question?.type ?? 'UNKNOWN';
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  const availableTypes = Object.keys(typeCounts).sort();

  // Filter
  const filtered = items.filter((q) => {
    if (typeFilter && q.question?.type !== typeFilter) return false;
    if (search.trim()) {
      const text = stripHtml(q.question?.text ?? '').toLowerCase();
      if (!text.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });

  const toggleOne = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const isExpanded = (id: string) => allExpanded || expandedIds.has(id);

  return (
    <section className="space-y-3" aria-label="Assigned questions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">คำถามในข้อสอบนี้</h2>
        {canUpdate && (
          <Button variant="secondary" onClick={toggleShowPicker}>
            <Plus className="h-4 w-4" />
            {showPicker ? 'ซ่อนชุดคำถาม' : 'เพิ่มจากชุดคำถาม'}
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="border bg-card p-4 text-sm text-muted-foreground">
          ยังไม่มีคำถามในข้อสอบนี้
        </div>
      ) : (
        <>
          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-4 border bg-card px-4 py-3 text-xs text-muted-foreground">
            <span>
              ทั้งหมด <strong className="text-foreground">{items.length}</strong> ข้อ
            </span>
            <span>
              รวม <strong className="text-foreground">{totalPoints}</strong> คะแนน
            </span>
            {availableTypes.length > 1 && (
              <span className="text-[11px]">
                {availableTypes
                  .map((t) => `${TYPE_LABEL[t] ?? t} ${typeCounts[t]}`)
                  .join(' · ')}
              </span>
            )}
          </div>

          {/* Toolbar — search + filter + expand all */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="ค้นหาในเนื้อคำถาม…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 flex-1 min-w-[180px] border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button
              type="button"
              variant="ghost"
              className="h-9 text-xs text-muted-foreground"
              onClick={() => {
                setAllExpanded((v) => !v);
                if (allExpanded) setExpandedIds(new Set());
              }}
            >
              {allExpanded ? 'ย่อทั้งหมด' : 'ขยายทั้งหมด'}
            </Button>
          </div>

          {/* Type filter chips */}
          {availableTypes.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTypeFilter(null)}
                className={`border px-2.5 py-1 text-xs font-medium transition-colors ${
                  typeFilter === null
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                }`}
              >
                ทั้งหมด · {items.length}
              </button>
              {availableTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t === typeFilter ? null : t)}
                  className={`border px-2.5 py-1 text-xs font-medium transition-colors ${
                    typeFilter === t
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                  }`}
                >
                  {TYPE_LABEL[t] ?? t} · {typeCounts[t]}
                </button>
              ))}
            </div>
          )}

          {/* Question list — compact rows */}
          {filtered.length === 0 ? (
            <div className="border bg-card p-4 text-center text-sm text-muted-foreground">
              ไม่พบคำถามที่ตรงกับเงื่อนไข
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden border bg-card">
              {filtered.map((eq) => {
                const origIndex = items.findIndex((q) => q.id === eq.id);
                const expanded = isExpanded(eq.id);
                const text = stripHtml(eq.question?.text ?? '');
                const typeKey = eq.question?.type ?? 'QUESTION';
                return (
                  <li key={eq.id} className="text-sm">
                    <button
                      type="button"
                      onClick={() => toggleOne(eq.id)}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/30"
                    >
                      <span className="mt-0.5 inline-flex h-6 w-7 flex-shrink-0 items-center justify-center bg-muted text-xs font-semibold text-muted-foreground tabular-nums">
                        {origIndex + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {TYPE_LABEL[typeKey] ?? typeKey}
                          </span>
                          <span className="text-xs text-muted-foreground">{eq.points} คะแนน</span>
                        </div>
                        {!expanded && text && (
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{text}</p>
                        )}
                      </div>
                      {expanded ? (
                        <ChevronDown className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      )}
                    </button>
                    {expanded && eq.question?.text && (
                      <div className="border-t border-border bg-muted/30 px-4 py-3 pl-14">
                        <RichTextView html={eq.question.text} className="text-xs" />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {showPicker && (
        <QuestionPicker
          assignedIds={assignedIds}
          onPick={onPick}
          isPending={isPending}
        />
      )}
    </section>
  );
}

function QuestionPicker({
  assignedIds,
  onPick,
  isPending,
}: {
  assignedIds: Set<string>;
  onPick: (id: string) => void;
  isPending: boolean;
}) {
  const banksQuery = useQuery({ queryKey: ['question-banks'], queryFn: listBanks });

  if (banksQuery.isLoading) {
    return (
      <div className="border bg-card p-4 text-sm text-muted-foreground">
        กำลังโหลดชุดคำถาม…
      </div>
    );
  }
  const banks = banksQuery.data ?? [];

  if (banks.length === 0) {
    return (
      <div className="border bg-card p-4 text-sm text-muted-foreground">
        ยังไม่มีชุดคำถามในระบบ — สร้างชุดคำถามที่หน้า{' '}
        <Link to="/admin/questions" className="underline">
          คลังคำถาม
        </Link>{' '}
        ก่อน
      </div>
    );
  }

  return (
    <div className="border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">ชุดคำถามทั้งหมด</h3>
      <div className="space-y-2 max-h-[28rem] overflow-y-auto">
        {banks.map((bank) => (
          <BankPickerItem
            key={bank.id}
            bank={bank}
            assignedIds={assignedIds}
            onPick={onPick}
            isPending={isPending}
          />
        ))}
      </div>
    </div>
  );
}

function BankPickerItem({
  bank,
  assignedIds,
  onPick,
  isPending,
}: {
  bank: QuestionBank;
  assignedIds: Set<string>;
  onPick: (id: string) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const questionsQuery = useQuery({
    queryKey: ['questions', bank.id],
    queryFn: () => listQuestions({ bankId: bank.id, pageSize: 100 }),
    enabled: expanded,
  });
  const questions = questionsQuery.data?.items ?? [];
  const remaining = questions.filter((q) => !assignedIds.has(q.id));

  return (
    <div className="border bg-background">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="flex flex-1 items-center gap-2 text-left text-sm"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{bank.name}</span>
          <span className="border border-border bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {bank.questionCount}
          </span>
        </button>
        {expanded && remaining.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            className="h-8 text-xs"
            disabled={isPending}
            onClick={async () => {
              if (await confirmAction('เพิ่มคำถามทั้งชุด?', `เพิ่ม <b>${remaining.length}</b> คำถามจากชุด "<b>${bank.name}</b>" เข้าข้อสอบ?`, 'เพิ่ม')) {
                remaining.forEach((q) => onPick(q.id));
              }
            }}
          >
            <Plus className="h-3 w-3" /> เพิ่มทั้งชุด ({remaining.length})
          </Button>
        )}
      </div>

      {expanded && (
        <div className="border-t bg-card/30 p-3">
          {questionsQuery.isLoading && (
            <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-3 w-3 animate-spin" /> กำลังโหลดคำถาม…
            </div>
          )}
          {!questionsQuery.isLoading && questions.length === 0 && (
            <p className="py-3 text-center text-xs text-muted-foreground">
              ยังไม่มีคำถามในชุดนี้
            </p>
          )}
          {questions.length > 0 && (
            <ul className="space-y-2">
              {questions.map((q) => {
                const isAssigned = assignedIds.has(q.id);
                return (
                  <li
                    key={q.id}
                    className="flex items-center justify-between gap-2 border bg-background px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium">
                          {q.type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {q.defaultPoints} คะแนน
                        </span>
                      </div>
                      <div className="mt-1 text-xs">
                        <RichTextView html={q.text} />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant={isAssigned ? 'ghost' : 'default'}
                      disabled={isAssigned || isPending}
                      onClick={() => onPick(q.id)}
                    >
                      {isAssigned ? 'เพิ่มแล้ว' : 'เพิ่ม'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
