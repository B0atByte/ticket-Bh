import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
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
import { Textarea } from '../../components/ui/textarea';
import { listAllCourses } from '../learning/learning.api';
import { listBanks } from './questions.api';
import { getApiErrorMessage } from '../../lib/api-error';
import { toastSuccess } from '../../lib/confirm';
import { createExam, updateExam, type CreateExamInput, type ExamDetail } from './exams.api';

const FormSchema = z.object({
  title: z.string().trim().min(1, 'จำเป็น').max(255),
  description: z.string().max(20_000).optional().or(z.literal('')),
  courseId: z.string().optional().or(z.literal('')),
  type: z.enum(['QUIZ', 'ASSESSMENT', 'PRE_TEST', 'POST_TEST', 'CERTIFICATION', 'SURVEY']),
  passingScore: z.coerce.number().int().min(0).max(100),
  timeLimitMinutes: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  secondsPerQuestion: z.coerce.number().int().min(5, 'อย่างน้อย 5 วินาที').max(3600).optional().or(z.literal('')),
  maxAttempts: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  cooldownMinutes: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  randomFromBankId: z.string().optional().or(z.literal('')),
  randomCount: z.coerce.number().int().positive('ต้องมากกว่า 0').max(500).optional().or(z.literal('')),
});

type FormValues = z.input<typeof FormSchema>;

interface Props {
  mode: 'create' | 'edit';
  exam?: ExamDetail;
  trigger?: React.ReactNode;
}

export function ExamFormDialog({ mode, exam, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const coursesQuery = useQuery({
    queryKey: ['courses', 'all'],
    queryFn: listAllCourses,
    enabled: open,
  });

  const banksQuery = useQuery({
    queryKey: ['question-banks'],
    queryFn: listBanks,
    enabled: open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      title: exam?.title ?? '',
      description: exam?.description ?? '',
      courseId: exam?.courseId ?? '',
      type: exam?.type ?? 'QUIZ',
      passingScore: exam?.passingScore ?? 70,
      timeLimitMinutes: exam?.timeLimitMinutes ?? '',
      secondsPerQuestion: exam?.secondsPerQuestion ?? '',
      maxAttempts: exam?.maxAttempts ?? '',
      cooldownMinutes: exam?.cooldownMinutes ?? '',
      shuffleQuestions: exam?.shuffleQuestions ?? false,
      shuffleOptions: exam?.shuffleOptions ?? false,
      randomFromBankId: exam?.randomFromBankId ?? '',
      randomCount: exam?.randomCount ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: CreateExamInput = {
        title: values.title,
        description: values.description || undefined,
        courseId: values.courseId || undefined,
        type: values.type,
        // PRE_TEST disables the passing-score input → react-hook-form drops it (undefined/NaN).
        // Fall back to a valid number so the request never sends null.
        passingScore: Number.isFinite(Number(values.passingScore)) ? Number(values.passingScore) : 70,
        timeLimitMinutes:
          values.timeLimitMinutes === '' ? undefined : Number(values.timeLimitMinutes),
        secondsPerQuestion:
          values.secondsPerQuestion === '' ? undefined : Number(values.secondsPerQuestion),
        maxAttempts: values.maxAttempts === '' ? undefined : Number(values.maxAttempts),
        cooldownMinutes: values.cooldownMinutes === '' ? undefined : Number(values.cooldownMinutes),
        shuffleQuestions: values.shuffleQuestions,
        shuffleOptions: values.shuffleOptions,
        randomFromBankId: values.randomFromBankId || undefined,
        randomCount: values.randomCount === '' ? undefined : Number(values.randomCount),
      };
      if (mode === 'create') return createExam(payload);
      if (!exam) throw new Error('ไม่พบข้อมูลข้อสอบที่ต้องการแก้ไข');
      return updateExam(exam.id, payload);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['exams'] });
      void queryClient.invalidateQueries({ queryKey: ['exam', saved.id] });
      setOpen(false);
      void toastSuccess(mode === 'create' ? 'สร้างข้อสอบแล้ว' : 'บันทึกข้อสอบแล้ว');
      if (mode === 'create') {
        navigate(`/admin/exams/${saved.id}`);
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> สร้างข้อสอบ
        </Button>
      )}
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'สร้างข้อสอบ' : 'แก้ไขข้อสอบ'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'กำหนดค่าพื้นฐานของข้อสอบ จากนั้นไปเพิ่มคำถามและเผยแพร่ในหน้าสร้างข้อสอบ'
              : 'อัปเดตการตั้งค่าข้อสอบ'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="e-title">ชื่อข้อสอบ *</Label>
            <Input id="e-title" {...form.register('title')} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-desc">คำอธิบาย</Label>
            <Textarea id="e-desc" rows={2} {...form.register('description')} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="e-course">ผูกกับหลักสูตร (ไม่บังคับ)</Label>
              <select
                id="e-course"
                {...form.register('courseId')}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— ไม่ผูกกับหลักสูตร —</option>
                {(coursesQuery.data?.items ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-type">ประเภท</Label>
              <select
                id="e-type"
                {...form.register('type')}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="QUIZ">แบบทดสอบสั้น (Quiz)</option>
                <option value="ASSESSMENT">การประเมิน (Assessment)</option>
                <option value="PRE_TEST">ทดสอบก่อนเรียน (Pre-test)</option>
                <option value="POST_TEST">ทดสอบหลังเรียน (Post-test)</option>
                <option value="CERTIFICATION">แบบทดสอบรับรอง (Certification)</option>
                <option value="SURVEY">แบบสำรวจ</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="e-pass">เกณฑ์ผ่าน (%)</Label>
              <Input
                id="e-pass"
                type="number"
                min={0}
                max={100}
                disabled={form.watch('type') === 'PRE_TEST'}
                {...form.register('passingScore')}
              />
              {form.watch('type') === 'PRE_TEST' && (
                <p className="text-xs text-muted-foreground">ทดสอบก่อนเรียนไม่ใช้เกณฑ์ผ่าน — ทำได้เท่าไหร่ก็ถือว่าผ่าน</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-time">เวลาทำข้อสอบ (นาที)</Label>
              <Input id="e-time" type="number" min={0} {...form.register('timeLimitMinutes')} />
              <p className="text-xs text-muted-foreground">เว้นว่าง = ไม่จำกัดเวลา</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-spq">จับเวลารายข้อ (วินาที/ข้อ)</Label>
              <Input id="e-spq" type="number" min={5} placeholder="เช่น 30" {...form.register('secondsPerQuestion')} />
              {form.formState.errors.secondsPerQuestion && (
                <p className="text-xs text-destructive">{form.formState.errors.secondsPerQuestion.message}</p>
              )}
              <p className="text-xs text-muted-foreground">ใส่ขั้นต่ำ 5 วินาที = ทำทีละข้อ มีเวลาจำกัดต่อข้อ · เว้นว่าง = ปิด (ทำทั้งชุดพร้อมกัน)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-max">จำนวนครั้งที่ทำได้</Label>
              <Input id="e-max" type="number" min={0} {...form.register('maxAttempts')} />
              <p className="text-xs text-muted-foreground">เว้นว่าง = ไม่จำกัดจำนวนครั้ง</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-cooldown">เวลาพักก่อนสอบใหม่ (นาที)</Label>
              <Input id="e-cooldown" type="number" min={0} {...form.register('cooldownMinutes')} />
              <p className="text-xs text-muted-foreground">เว้นว่าง = สอบใหม่ได้ทันที</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="e-bank">สุ่มคำถามจากคลังคำถาม (ไม่บังคับ)</Label>
              <select
                id="e-bank"
                {...form.register('randomFromBankId')}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— ไม่สุ่ม ใช้คำถามที่กำหนดไว้ —</option>
                {(banksQuery.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.questionCount} ข้อ)
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">เลือกแล้ว ระบบจะสุ่มคำถามจากคลังนี้ใหม่ทุกครั้งที่เริ่มทำข้อสอบ</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-random-count">จำนวนข้อที่สุ่ม</Label>
              <Input
                id="e-random-count"
                type="number"
                min={1}
                max={500}
                placeholder="เช่น 20"
                disabled={!form.watch('randomFromBankId')}
                {...form.register('randomCount')}
              />
              {form.formState.errors.randomCount && (
                <p className="text-xs text-destructive">{form.formState.errors.randomCount.message}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('shuffleQuestions')} className="h-4 w-4" />
              สลับลำดับคำถาม
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('shuffleOptions')} className="h-4 w-4" />
              สลับลำดับตัวเลือก
            </label>
          </div>
          {mutation.isError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getApiErrorMessage(mutation.error, 'บันทึกไม่สำเร็จ')}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === 'create' ? 'สร้าง' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
