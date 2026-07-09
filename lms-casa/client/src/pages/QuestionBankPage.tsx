import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  ClipboardList,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { getApiErrorMessage } from '../lib/api-error';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { RichTextView } from '../components/ui/RichTextEditor';
import { QuestionFormDialog } from '../features/admin/QuestionFormDialog';
import { QuestionBulkImportDialog } from '../features/admin/QuestionBulkImportDialog';
import {
  createBank,
  deleteBank,
  deleteQuestion,
  listBanks,
  listQuestions,
  updateBank,
  type QuestionBank,
} from '../features/admin/questions.api';
import { useAuthStore } from '../features/auth/auth.store';
import { alertWarning, confirmDanger } from '../lib/confirm';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

// ─── Bank form dialog ─────────────────────────────────────────────────────────

function BankFormDialog({
  mode,
  bank,
  onClose,
}: {
  mode: 'create' | 'edit';
  bank?: QuestionBank;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(bank?.name ?? '');
  const [description, setDescription] = useState(bank?.description ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'create'
        ? createBank({ name, description: description || undefined })
        : updateBank(bank!.id, { name, description: description || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['question-banks'] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'สร้างชุดคำถามใหม่' : 'แก้ไขชุดคำถาม'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="bank-name">ชื่อชุดคำถาม</Label>
            <Input
              id="bank-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น ความปลอดภัยในการทำงาน"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bank-desc">คำอธิบาย (ไม่บังคับ)</Label>
            <Input
              id="bank-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="อธิบายเนื้อหาของชุดคำถามนี้"
            />
          </div>
          {mutation.isError && (
            <p className="text-sm text-destructive">
              {getApiErrorMessage(mutation.error, 'เกิดข้อผิดพลาด')}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            ยกเลิก
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'สร้าง' : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function QuestionBankPage() {
  const canCreate = useAuthStore((s) => s.hasPermission('question.create'));
  const canUpdate = useAuthStore((s) => s.hasPermission('question.update'));
  const canDelete = useAuthStore((s) => s.hasPermission('question.delete'));
  const queryClient = useQueryClient();

  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [bankDialog, setBankDialog] = useState<{ mode: 'create' | 'edit'; bank?: QuestionBank } | null>(null);
  const [searchQ, setSearchQ] = useState('');

  // ── Banks ──────────────────────────────────────────────────────────────────
  const banksQuery = useQuery({
    queryKey: ['question-banks'],
    queryFn: listBanks,
  });

  const deleteBankMut = useMutation({
    mutationFn: (id: string) => deleteBank(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ['question-banks'] });
      if (selectedBankId === id) setSelectedBankId(null);
    },
  });

  // ── Questions in selected bank ─────────────────────────────────────────────
  const questionsQuery = useQuery({
    queryKey: ['questions', selectedBankId, searchQ],
    queryFn: () =>
      listQuestions({ bankId: selectedBankId ?? undefined, q: searchQ || undefined, pageSize: 100 }),
    enabled: selectedBankId !== null,
  });

  const deleteQuestionMut = useMutation({
    mutationFn: (id: string) => deleteQuestion(id),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['questions', selectedBankId, searchQ] }),
  });

  const banks = banksQuery.data ?? [];
  const selectedBank = banks.find((b) => b.id === selectedBankId) ?? null;

  return (
    <div className="flex h-full gap-0">
      {/* ── Left panel: bank list ─────────────────────────────────────────── */}
      <aside className="flex w-64 shrink-0 flex-col border-r bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">ชุดคำถาม</span>
          {canCreate && (
            <Button
              variant="ghost"
              className="h-7 w-7 px-0"
              aria-label="สร้างชุดคำถามใหม่"
              onClick={() => setBankDialog({ mode: 'create' })}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {banksQuery.isLoading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-1">
          {banks.map((bank) => {
            const active = bank.id === selectedBankId;
            return (
              <div
                key={bank.id}
                className={[
                  'group flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-accent text-foreground',
                ].join(' ')}
                onClick={() => setSelectedBankId(bank.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedBankId(bank.id)}
                aria-current={active ? 'page' : undefined}
              >
                <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{bank.name}</span>
                <span className="shrink-0 border border-border bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {bank.questionCount}
                </span>
                {active && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary" />}

                {/* Edit / Delete buttons — show on hover */}
                {(canUpdate || canDelete) && (
                  <span
                    className="ml-auto hidden shrink-0 items-center gap-0.5 group-hover:flex"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canUpdate && (
                      <button
                        className="rounded p-0.5 hover:bg-accent"
                        aria-label="แก้ไขชุดคำถาม"
                        onClick={() => setBankDialog({ mode: 'edit', bank })}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="rounded p-0.5 text-destructive hover:bg-destructive/10"
                        aria-label="ลบชุดคำถาม"
                        onClick={async () => {
                          if (bank.questionCount > 0) {
                            await alertWarning('ไม่สามารถลบได้', `ชุดคำถาม "<b>${bank.name}</b>" ยังมีคำถามอยู่ ${bank.questionCount} ข้อ<br>กรุณาลบคำถามทั้งหมดก่อน`);
                            return;
                          }
                          if (await confirmDanger('ลบชุดคำถาม?', `ลบ "<b>${bank.name}</b>" ออกจากระบบ?`)) {
                            deleteBankMut.mutate(bank.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                )}
              </div>
            );
          })}

          {!banksQuery.isLoading && banks.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              ยังไม่มีชุดคำถาม
              {canCreate && (
                <>
                  <br />
                  กด <Plus className="inline h-3 w-3" /> เพื่อสร้าง
                </>
              )}
            </p>
          )}
        </nav>
      </aside>

      {/* ── Right panel: questions ────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {!selectedBank ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <ClipboardList className="h-10 w-10 opacity-30" />
            <p className="text-sm">เลือกชุดคำถามทางซ้ายเพื่อดูคำถาม</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between gap-4 border-b bg-card px-5 py-3">
              <div>
                <h1 className="text-lg font-semibold">{selectedBank.name}</h1>
                {selectedBank.description && (
                  <p className="text-xs text-muted-foreground">{selectedBank.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {questionsQuery.data?.meta.total ?? selectedBank.questionCount} คำถาม
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="ค้นหาคำถาม…"
                  className="h-8 w-48 text-sm"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                />
                {canCreate && (
                  <>
                    <QuestionBulkImportDialog
                      bankId={selectedBank.id}
                      onSuccess={() => {
                        void queryClient.invalidateQueries({ queryKey: ['questions', selectedBankId, searchQ] });
                        void queryClient.invalidateQueries({ queryKey: ['question-banks'] });
                      }}
                    />
                    <QuestionFormDialog
                      mode="create"
                      defaultBankId={selectedBankId ?? undefined}
                      onSuccess={() => {
                        void queryClient.invalidateQueries({ queryKey: ['questions', selectedBankId, searchQ] });
                        void queryClient.invalidateQueries({ queryKey: ['question-banks'] });
                      }}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Question list */}
            <div className="flex-1 overflow-y-auto p-5">
              {questionsQuery.isLoading && (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังโหลด…
                </div>
              )}

              {!questionsQuery.isLoading && (questionsQuery.data?.items.length ?? 0) === 0 && (
                <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                  ยังไม่มีคำถามในชุดนี้
                  {canCreate && ' — กดปุ่ม "สร้างคำถาม" เพื่อเริ่ม'}
                </div>
              )}

              <div className="space-y-3">
                {(questionsQuery.data?.items ?? []).map((q) => (
                  <article key={q.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-medium">
                          {q.type}
                        </span>
                        <span className="rounded bg-secondary/60 px-2 py-0.5 text-[10px]">
                          {q.difficulty}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {q.defaultPoints} คะแนน · {q.options.length} ตัวเลือก
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {canUpdate && (
                          <QuestionFormDialog
                            mode="edit"
                            question={q}
                            trigger={
                              <Button
                                variant="ghost"
                                className="h-8 w-8 px-0"
                                aria-label="แก้ไขคำถาม"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            }
                            onSuccess={() => {
                              void queryClient.invalidateQueries({ queryKey: ['questions', selectedBankId, searchQ] });
                            }}
                          />
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            className="h-8 w-8 px-0 text-destructive hover:bg-destructive/10"
                            onClick={async () => {
                              if (await confirmDanger('ลบคำถาม?', 'ลบคำถามนี้ออกจากระบบ?'))
                                deleteQuestionMut.mutate(q.id);
                            }}
                            aria-label="ลบคำถาม"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      <RichTextView html={q.text} className="text-sm" />
                    </div>
                    {q.options.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {q.options.map((opt) => (
                          <li
                            key={opt.id}
                            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${
                              opt.isCorrect ? 'border-emerald-300 bg-emerald-50' : ''
                            }`}
                          >
                            <span
                              className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                                opt.isCorrect ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                              }`}
                            />
                            <span className="flex-1">{opt.text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Bank form dialog */}
      {bankDialog && (
        <BankFormDialog
          mode={bankDialog.mode}
          bank={bankDialog.bank}
          onClose={() => setBankDialog(null)}
        />
      )}
    </div>
  );
}
