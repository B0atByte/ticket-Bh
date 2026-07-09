import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { getApiErrorMessage } from '../../lib/api-error';
import { toastSuccess } from '../../lib/confirm';
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
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import {
  createQuestion,
  updateQuestion,
  type Difficulty,
  type Question,
  type QuestionType,
} from './questions.api';

const SUPPORTED_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'SINGLE_CHOICE', label: 'เลือกคำตอบเดียว' },
  { value: 'MULTIPLE_CHOICE', label: 'เลือกหลายคำตอบ (มี partial credit)' },
  { value: 'TRUE_FALSE', label: 'ถูก / ผิด' },
];

interface OptionDraft {
  text: string;
  isCorrect: boolean;
}

interface Props {
  mode: 'create' | 'edit';
  question?: Question;
  trigger?: React.ReactNode;
  defaultBankId?: string;
  onSuccess?: () => void;
}

export function QuestionFormDialog({ mode, question, trigger, defaultBankId, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const [type, setType] = useState<QuestionType>(question?.type ?? 'SINGLE_CHOICE');
  const [difficulty, setDifficulty] = useState<Difficulty>(question?.difficulty ?? 'MEDIUM');
  const [text, setText] = useState(question?.text ?? '');
  const [explanation, setExplanation] = useState(question?.explanation ?? '');
  const [points, setPoints] = useState(question?.defaultPoints ?? 1);
  const [options, setOptions] = useState<OptionDraft[]>(
    question?.options?.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) ??
      (question?.type === 'TRUE_FALSE'
        ? [
            { text: 'ถูก', isCorrect: true },
            { text: 'ผิด', isCorrect: false },
          ]
        : [
            { text: '', isCorrect: true },
            { text: '', isCorrect: false },
          ]),
  );
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      setError(null);
      const trimmedText = text.replace(/<[^>]*>/g, '').trim();
      if (!trimmedText) throw new Error('กรุณากรอกข้อความคำถาม');
      const cleanOptions = options
        .map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect }))
        .filter((o) => o.text.length > 0);
      if (cleanOptions.length < 2) throw new Error('ต้องมีตัวเลือกอย่างน้อย 2 ตัว');
      const correctCount = cleanOptions.filter((o) => o.isCorrect).length;
      if (type === 'SINGLE_CHOICE' && correctCount !== 1) {
        throw new Error('แบบเลือกคำตอบเดียวต้องมีคำตอบถูกหนึ่งข้อ');
      }
      if (type === 'MULTIPLE_CHOICE' && correctCount < 1) {
        throw new Error('แบบเลือกหลายคำตอบต้องมีคำตอบถูกอย่างน้อยหนึ่งข้อ');
      }
      if (type === 'TRUE_FALSE' && (cleanOptions.length !== 2 || correctCount !== 1)) {
        throw new Error('แบบถูก/ผิดต้องมีตัวเลือก 2 ตัวและคำตอบถูก 1 ข้อ');
      }
      const payload = {
        type,
        difficulty,
        text,
        explanation: explanation || undefined,
        defaultPoints: points,
        options: cleanOptions,
        bankId: defaultBankId,
      };
      if (mode === 'create') return createQuestion(payload);
      if (!question) throw new Error('ไม่พบคำถามที่ต้องการแก้ไข');
      return updateQuestion(question.id, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['questions'] });
      onSuccess?.();
      setOpen(false);
      void toastSuccess(mode === 'create' ? 'เพิ่มคำถามแล้ว' : 'บันทึกคำถามแล้ว');
    },
    onError: (e: unknown) => setError(getApiErrorMessage(e, 'บันทึกไม่สำเร็จ')),
  });

  const addOption = () => setOptions((prev) => [...prev, { text: '', isCorrect: false }]);
  const removeOption = (idx: number) =>
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  const updateOption = (idx: number, patch: Partial<OptionDraft>) =>
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  const setCorrect = (idx: number) => {
    if (type === 'SINGLE_CHOICE' || type === 'TRUE_FALSE') {
      setOptions((prev) => prev.map((o, i) => ({ ...o, isCorrect: i === idx })));
    } else {
      updateOption(idx, { isCorrect: !(options[idx]?.isCorrect ?? false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> สร้างคำถาม
        </Button>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'สร้างคำถาม' : 'แก้ไขคำถาม'}</DialogTitle>
          <DialogDescription>
            ประเภทที่รองรับใน UI: เลือกคำตอบเดียว, เลือกหลายคำตอบ (partial credit), ถูก/ผิด.
            ประเภทอื่นใช้ผ่าน API ก่อน
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>ประเภท *</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as QuestionType)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {SUPPORTED_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>ระดับความยาก</Label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="EASY">ง่าย</option>
                <option value="MEDIUM">กลาง</option>
                <option value="HARD">ยาก</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-points">คะแนน</Label>
              <Input
                id="q-points"
                type="number"
                min={1}
                max={100}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>ข้อความคำถาม *</Label>
            <RichTextEditor value={text} onChange={setText} minHeight={120} />
          </div>

          <div className="space-y-2">
            <Label>ตัวเลือก</Label>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type={type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'}
                    name="correct"
                    checked={opt.isCorrect}
                    onChange={() => setCorrect(idx)}
                    className="h-4 w-4"
                    aria-label={`เลือกเป็นคำตอบที่ถูกในตัวเลือกที่ ${idx + 1}`}
                  />
                  <Input
                    value={opt.text}
                    onChange={(e) => updateOption(idx, { text: e.target.value })}
                    placeholder={`ตัวเลือกที่ ${idx + 1}`}
                    className="flex-1"
                  />
                  {type !== 'TRUE_FALSE' && options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 w-8 px-0 text-destructive"
                      onClick={() => removeOption(idx)}
                      aria-label={`ลบตัวเลือกที่ ${idx + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {type !== 'TRUE_FALSE' && options.length < 10 && (
                <Button type="button" variant="ghost" onClick={addOption}>
                  <Plus className="h-4 w-4" /> เพิ่มตัวเลือก
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>คำอธิบาย (ไม่บังคับ)</Label>
            <RichTextEditor value={explanation} onChange={setExplanation} minHeight={80} />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            ยกเลิก
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === 'create' ? 'สร้าง' : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
