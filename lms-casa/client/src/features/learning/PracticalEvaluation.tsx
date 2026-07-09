import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, ClipboardList, GripVertical, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { getApiErrorMessage } from '../../lib/api-error';
import { confirmDanger, toastSuccess } from '../../lib/confirm';
import {
  createPracticalCriterion,
  deletePracticalCriterion,
  getEnrollmentPracticalEvaluation,
  getMyPracticalEvaluation,
  listPracticalCriteria,
  reorderPracticalCriteria,
  submitPracticalEvaluation,
  updatePracticalCriterion,
  type PracticalEvalResult,
} from './practical-evaluations.api';

const RESULT_LABEL: Record<PracticalEvalResult, string> = {
  PENDING: 'รอการประเมิน',
  PASSED: 'ผ่านภาคปฏิบัติ',
  FAILED: 'ไม่ผ่านภาคปฏิบัติ',
};

const RESULT_BADGE_CLS: Record<PracticalEvalResult, string> = {
  PENDING: 'border-border bg-muted text-muted-foreground',
  PASSED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  FAILED: 'border-destructive/20 bg-destructive/10 text-destructive',
};

export function PracticalResultBadge({ result }: { result: PracticalEvalResult }) {
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 text-xs font-medium ${RESULT_BADGE_CLS[result]}`}>
      {RESULT_LABEL[result]}
    </span>
  );
}

// ─── Admin: checklist criteria management ──────────────────────────────────

export function PracticalCriteriaManager({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const criteriaQuery = useQuery({
    queryKey: ['practical-criteria', courseId],
    queryFn: () => listPracticalCriteria(courseId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['practical-criteria', courseId] });

  const createMut = useMutation({
    mutationFn: (title: string) => createPracticalCriterion(courseId, title),
    onSuccess: () => {
      setNewTitle('');
      void invalidate();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => updatePracticalCriterion(id, title),
    onSuccess: () => {
      setEditingId(null);
      void invalidate();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePracticalCriterion(id),
    onSuccess: () => void invalidate(),
  });

  const reorderMut = useMutation({
    mutationFn: (orderedIds: string[]) => reorderPracticalCriteria(courseId, orderedIds),
    onSuccess: () => void invalidate(),
  });

  const criteria = criteriaQuery.data ?? [];

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= criteria.length) return;
    const ids = criteria.map((c) => c.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorderMut.mutate(ids);
  }

  return (
    <section className="space-y-3" aria-label="หัวข้อประเมินภาคปฏิบัติ">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">หัวข้อประเมินภาคปฏิบัติ</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        กำหนดเช็คลิสต์หัวข้อที่ผู้สอนจะใช้ประเมินผู้เรียนแต่ละคนในหลักสูตรนี้
      </p>

      {criteriaQuery.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : criteria.length === 0 ? (
        <div className="border border-border bg-card p-4 text-sm text-muted-foreground">
          ยังไม่มีหัวข้อประเมิน
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border bg-card">
          {criteria.map((c, idx) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2">
              <GripVertical className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="flex flex-shrink-0 flex-col">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0 || reorderMut.isPending}
                  aria-label="เลื่อนขึ้น"
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  onClick={() => move(idx, 1)}
                  disabled={idx === criteria.length - 1 || reorderMut.isPending}
                  aria-label="เลื่อนลง"
                >
                  ▼
                </button>
              </div>
              {editingId === c.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    className="h-8"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() => updateMut.mutate({ id: c.id, title: editingTitle.trim() })}
                    disabled={!editingTitle.trim() || updateMut.isPending}
                  >
                    บันทึก
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    ยกเลิก
                  </Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm">{c.title}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(c.id);
                      setEditingTitle(c.title);
                    }}
                    aria-label="แก้ไข"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={async () => {
                      if (await confirmDanger('ลบหัวข้อประเมิน?', `ลบ "${c.title}" ออกจากเช็คลิสต์?`, 'ลบ')) {
                        deleteMut.mutate(c.id);
                      }
                    }}
                    aria-label="ลบ"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="หัวข้อประเมินใหม่ เช่น ปฏิบัติตามขั้นตอนความปลอดภัย"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newTitle.trim()) createMut.mutate(newTitle.trim());
          }}
        />
        <Button onClick={() => createMut.mutate(newTitle.trim())} disabled={!newTitle.trim() || createMut.isPending}>
          {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          เพิ่ม
        </Button>
      </div>
    </section>
  );
}

// ─── Instructor / admin: evaluate a learner ────────────────────────────────

export function PracticalEvaluationDialog({
  enrollmentId,
  courseId,
  learnerName,
  trigger,
}: {
  enrollmentId: string;
  courseId: string;
  learnerName: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const evalQuery = useQuery({
    queryKey: ['practical-evaluation', enrollmentId],
    queryFn: () => getEnrollmentPracticalEvaluation(enrollmentId),
    enabled: open,
  });

  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!evalQuery.data) return;
    setChecked(Object.fromEntries(evalQuery.data.criteria.map((c) => [c.id, c.checked])));
  }, [evalQuery.data]);

  const criteria = evalQuery.data?.criteria ?? [];
  const result: PracticalEvalResult =
    criteria.length > 0 && criteria.every((c) => checked[c.id]) ? 'PASSED' : 'FAILED';

  const submitMut = useMutation({
    mutationFn: () =>
      submitPracticalEvaluation(enrollmentId, {
        result,
        items: criteria.map((c) => ({ criterionId: c.id, checked: checked[c.id] ?? false })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrollments', courseId] });
      void queryClient.invalidateQueries({ queryKey: ['practical-evaluation', enrollmentId] });
      void toastSuccess('บันทึกผลการประเมินแล้ว');
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ประเมินภาคปฏิบัติ</DialogTitle>
          <DialogDescription>ผู้เรียน: {learnerName}</DialogDescription>
        </DialogHeader>

        {evalQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {criteria.length === 0 ? (
              <p className="text-sm text-muted-foreground">หลักสูตรนี้ยังไม่มีหัวข้อประเมิน</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>หัวข้อประเมิน</Label>
                  <PracticalResultBadge result={result} />
                </div>
                <ul className="divide-y divide-border border border-border">
                  {criteria.map((c) => {
                    const isChecked = checked[c.id] ?? false;
                    return (
                      <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="flex-1">{c.title}</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setChecked((prev) => ({ ...prev, [c.id]: true }))}
                            className={`border px-2.5 py-1 text-xs font-medium transition-colors ${
                              isChecked ? RESULT_BADGE_CLS.PASSED : 'border-border bg-card text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            ผ่าน
                          </button>
                          <button
                            type="button"
                            onClick={() => setChecked((prev) => ({ ...prev, [c.id]: false }))}
                            className={`border px-2.5 py-1 text-xs font-medium transition-colors ${
                              !isChecked ? RESULT_BADGE_CLS.FAILED : 'border-border bg-card text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            ไม่ผ่าน
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-xs text-muted-foreground">
                  ผ่านครบทุกหัวข้อ = ผ่านภาคปฏิบัติ (ได้ดาว) — ถ้ามีหัวข้อที่เลือก "ไม่ผ่าน" จะบันทึกเป็นไม่ผ่าน
                </p>
              </div>
            )}

            {submitMut.isError && (
              <div className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {getApiErrorMessage(submitMut.error, 'บันทึกไม่สำเร็จ')}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitMut.isPending}>
            ยกเลิก
          </Button>
          <Button
            type="button"
            onClick={() => submitMut.mutate()}
            disabled={submitMut.isPending || evalQuery.isLoading || criteria.length === 0}
          >
            {submitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            บันทึกผลการประเมิน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Learner: read-only view ────────────────────────────────────────────────

export function MyPracticalEvaluationCard({ courseId, enabled }: { courseId: string; enabled: boolean }) {
  const evalQuery = useQuery({
    queryKey: ['practical-evaluation', 'me', courseId],
    queryFn: () => getMyPracticalEvaluation(courseId),
    enabled,
  });

  const evaluation = evalQuery.data;
  if (!evaluation || evaluation.criteria.length === 0) return null;

  return (
    <section className="border border-border bg-card p-4" aria-label="ผลภาคปฏิบัติ">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ClipboardList className="h-4 w-4 text-muted-foreground" /> ภาคปฏิบัติ
        </span>
        <PracticalResultBadge result={evaluation.result} />
      </div>
      <ul className="space-y-1.5">
        {evaluation.criteria.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-sm">
            {c.checked ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
            ) : (
              <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            )}
            <span className={c.checked ? 'text-foreground/80' : 'text-muted-foreground'}>{c.title}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
