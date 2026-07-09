import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Loader2, Sparkles, ClipboardPaste, Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '../../lib/api-error';
import { listAllCourses } from '../learning/learning.api';
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
import {
  commitQuestionImport,
  generateFromCourse,
  generateQuestionDrafts,
  parseQuestionText,
  type CreateQuestionInput,
  type Difficulty,
} from './questions.api';

interface Props {
  bankId: string;
  onSuccess?: () => void;
}

function validateInput(text: string, mode: 'parse' | 'generate', count: number): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return mode === 'parse'
      ? 'กรุณาวางข้อสอบลงในช่องด้านบนก่อน'
      : 'กรุณาพิมพ์หัวข้อหรือเนื้อหาที่ต้องการออกข้อสอบก่อน';
  }
  if (mode === 'parse' && trimmed.length < 20) {
    return `ข้อความสั้นเกินไป (${trimmed.length} ตัวอักษร) — วางข้อสอบที่มีคำถามและตัวเลือกครบถ้วน (อย่างน้อย 20 ตัวอักษร)`;
  }
  if (mode === 'generate' && trimmed.length < 10) {
    return `ข้อความสั้นเกินไป (${trimmed.length} ตัวอักษร) — พิมพ์หัวข้อหรือเนื้อหาอย่างน้อย 10 ตัวอักษร`;
  }
  if (mode === 'generate' && count < 1) return 'จำนวนข้อต้องมากกว่า 0';
  if (mode === 'generate' && count > 20) return 'สร้างได้สูงสุด 20 ข้อต่อครั้ง';
  return null;
}

export function QuestionBulkImportDialog({ bankId, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [result, setResult] = useState<CreateQuestionInput[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [courseId, setCourseId] = useState('');
  const [activeMode, setActiveMode] = useState<'parse' | 'generate' | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const coursesQuery = useQuery({
    queryKey: ['courses', 'all'],
    queryFn: listAllCourses,
    enabled: open,
  });

  const parseMutation = useMutation({
    mutationFn: () => parseQuestionText(inputText),
    onSuccess: (r) => { setResult(r.questions); setProvider(r.provider); setSkipped(r.skipped ?? 0); },
    onError: () => setActiveMode(null),
  });

  const generateMutation = useMutation({
    mutationFn: () => generateQuestionDrafts({ sourceText: inputText, count, difficulty }),
    onSuccess: (r) => { setResult(r.questions); setProvider(r.provider); setSkipped(r.skipped ?? 0); },
    onError: () => setActiveMode(null),
  });

  const courseMutation = useMutation({
    mutationFn: () => generateFromCourse({ courseId, count, difficulty }),
    onSuccess: (r) => { setResult(r.questions); setProvider(r.provider); setSkipped(r.skipped ?? 0); },
    onError: () => setActiveMode(null),
  });

  const isRunning = parseMutation.isPending || generateMutation.isPending || courseMutation.isPending;

  useEffect(() => {
    if (isRunning) {
      setProgress(0);
      const estimatedMs = activeMode === 'generate'
        ? Math.max(count * 1200, 4000)
        : 6000;
      const stepMs = 300;
      const stepSize = (90 / estimatedMs) * stepMs;
      timerRef.current = setInterval(() => {
        setProgress((prev) => Math.min(prev + stepSize, 90));
      }, stepMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (parseMutation.isSuccess || generateMutation.isSuccess || courseMutation.isSuccess) setProgress(100);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning, parseMutation.isSuccess, generateMutation.isSuccess, courseMutation.isSuccess, activeMode, count]);

  function handleAction(mode: 'parse' | 'generate') {
    const err = validateInput(inputText, mode, count);
    if (err) { setValidationError(err); return; }
    setValidationError(null);
    setResult([]);
    setProvider(null);
    setActiveMode(mode);
    if (mode === 'parse') parseMutation.mutate();
    else generateMutation.mutate();
  }

  const commitMutation = useMutation({
    mutationFn: (questions: CreateQuestionInput[]) => commitQuestionImport(bankId, questions),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['questions'] });
      void queryClient.invalidateQueries({ queryKey: ['question-banks'] });
      onSuccess?.();
      setOpen(false);
      resetAll();
    },
  });

  function resetAll() {
    setInputText('');
    setResult([]);
    setProvider(null);
    setSkipped(0);
    setCourseId('');
    setActiveMode(null);
    setValidationError(null);
    setProgress(0);
  }

  const failedError = parseMutation.error ?? generateMutation.error ?? courseMutation.error ?? commitMutation.error;
  const apiError = failedError ? getApiErrorMessage(failedError) : undefined;

  const progressLabel =
    progress < 30 ? 'กำลังวิเคราะห์...'
    : progress < 60 ? activeMode === 'parse' ? 'กำลังจัดโครงสร้างคำถาม...' : 'กำลังร่างคำถามและตัวเลือก...'
    : progress < 85 ? 'กำลังตรวจคำตอบและเฉลย...'
    : 'เกือบเสร็จแล้ว...';

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetAll(); }}>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4" />
        นำเข้า / AI
      </Button>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>นำเข้าข้อสอบหลายข้อ</DialogTitle>
          <DialogDescription>
            วางข้อสอบที่มีอยู่แล้วให้ AI แปลง หรือพิมพ์หัวข้อ/เนื้อหาให้ AI สร้างใหม่
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* hint box */}
          <div className="flex gap-2 border border-primary/30 bg-primary/5 px-3 py-2.5 text-xs text-primary">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">วิธีใช้</p>
              <p>
                <span className="font-medium">วางข้อสอบ</span> — วางข้อสอบที่มีอยู่ได้ทุกรูปแบบ
                (เลข + ตัวเลือก ก-ง, A-D, หรือแบบอื่นๆ) AI จะแปลงให้อัตโนมัติ
              </p>
              <p>
                <span className="font-medium">สร้างด้วย AI</span> — พิมพ์หัวข้อหรือวางเนื้อหาบทเรียน
                AI จะออกข้อสอบใหม่ตามจำนวนและระดับที่กำหนด (สูงสุด 20 ข้อ/ครั้ง)
              </p>
            </div>
          </div>

          {/* generate from an existing course's content */}
          <div className="space-y-2 border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <BookOpen className="h-4 w-4" /> สร้างจากเนื้อหาในหลักสูตร
            </div>
            <p className="text-xs text-muted-foreground">
              เลือกหลักสูตร แล้วให้ AI ออกข้อสอบจากบทเรียนทั้งหมดในนั้น (ใช้จำนวน/ระดับด้านล่าง)
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <select
                aria-label="เลือกหลักสูตร"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                disabled={isRunning}
                className="h-10 flex-1 min-w-[180px] border border-input bg-background px-3 text-sm"
              >
                <option value="">— เลือกหลักสูตร —</option>
                {(coursesQuery.data?.items ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <Button
                onClick={() => {
                  if (!courseId) { setValidationError('กรุณาเลือกหลักสูตรก่อน'); return; }
                  setValidationError(null);
                  setResult([]);
                  setProvider(null);
                  setActiveMode('generate');
                  courseMutation.mutate();
                }}
                disabled={isRunning}
              >
                {courseMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Sparkles className="h-4 w-4" />}
                สร้างจากหลักสูตร ({count} ข้อ)
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> หรือวาง/พิมพ์เอง <div className="h-px flex-1 bg-border" />
          </div>

          {/* main textarea */}
          <div className="space-y-1.5">
            <Label htmlFor="main-input">ข้อสอบหรือเนื้อหา</Label>
            <textarea
              id="main-input"
              className="min-h-[200px] w-full border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                setValidationError(null);
                setResult([]);
                setProvider(null);
              }}
              disabled={isRunning}
              placeholder={`ตัวอย่างรูปแบบที่รองรับ:\n\n1. กาแฟชนิดใดมีนมมากที่สุด?\nก. Espresso  ข. Latte  ค. Americano  ง. Ristretto\nเฉลย: ข\n\nหรือจะพิมพ์แค่หัวข้อก็ได้:\nพนักงานร้านกาแฟ ควรรู้เรื่องกาแฟและการบริการลูกค้า`}
            />
          </div>

          {/* controls for generate mode */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gen-count">จำนวนข้อ (สำหรับสร้างใหม่)</Label>
              <Input
                id="gen-count"
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(Number(e.target.value) || 1)}
                className="w-28"
                disabled={isRunning}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gen-difficulty">ระดับ</Label>
              <select
                id="gen-difficulty"
                className="h-10 border border-input bg-background px-3 text-sm"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                disabled={isRunning}
              >
                <option value="EASY">ง่าย</option>
                <option value="MEDIUM">กลาง</option>
                <option value="HARD">ยาก</option>
              </select>
            </div>
            <div className="flex gap-2 pb-0.5">
              <Button
                variant="outline"
                onClick={() => handleAction('parse')}
                disabled={isRunning}
              >
                {parseMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <ClipboardPaste className="h-4 w-4" />}
                แปลงข้อสอบที่วางมา
              </Button>
              <Button
                onClick={() => handleAction('generate')}
                disabled={isRunning}
              >
                {generateMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Sparkles className="h-4 w-4" />}
                สร้างด้วย AI ({count} ข้อ)
              </Button>
            </div>
          </div>

          {/* validation error */}
          {validationError && (
            <div className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {validationError}
            </div>
          )}

          {/* progress bar */}
          {isRunning && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progressLabel}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* api error */}
          {apiError && (
            <div className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {apiError}
            </div>
          )}

          {/* answer-key filter notice */}
          {skipped > 0 && (
            <div className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              ตัดออก {skipped} ข้อที่ AI สร้างเฉลยไม่สมบูรณ์ (ไม่มีคำตอบถูก หรือถูกทุกข้อ) — แสดงเฉพาะข้อที่เฉลยถูกต้อง
            </div>
          )}

          {/* preview */}
          {result.length > 0 && provider && (
            <PreviewTable questions={result} provider={provider} />
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => { setOpen(false); resetAll(); }}
            disabled={commitMutation.isPending}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={() => commitMutation.mutate(result)}
            disabled={result.length === 0 || commitMutation.isPending}
          >
            {commitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            บันทึก {result.length} ข้อ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewTable({ questions, provider }: { questions: CreateQuestionInput[]; provider: string }) {
  const providerLabel =
    provider === 'deepseek' ? 'DeepSeek' : provider === 'openai' ? 'OpenAI' : 'Local';
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{questions.length} ข้อพร้อมบันทึก</span>
        <span className="text-xs text-muted-foreground">Provider: {providerLabel}</span>
      </div>
      <div className="max-h-64 overflow-auto border">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="px-3 py-2">ประเภท</th>
              <th className="px-3 py-2">คำถาม</th>
              <th className="px-3 py-2">คำตอบถูก</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q, i) => (
              <tr key={`${q.text}-${i}`} className="border-t">
                <td className="whitespace-nowrap px-3 py-2 align-top">{q.type}</td>
                <td className="px-3 py-2 align-top">{stripHtml(q.text)}</td>
                <td className="px-3 py-2 align-top">
                  {(q.options ?? []).filter((o) => o.isCorrect).map((o) => o.text).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim();
}
