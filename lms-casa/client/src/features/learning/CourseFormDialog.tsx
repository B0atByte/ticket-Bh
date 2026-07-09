import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Loader2, Plus, X } from 'lucide-react';
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
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { Textarea } from '../../components/ui/textarea';
import { getApiErrorMessage } from '../../lib/api-error';
import { toastSuccess } from '../../lib/confirm';
import { createCourse, listAllCourses, updateCourse, uploadCourseCover, type CreateCourseInput } from './learning.api';

const CourseFormSchema = z.object({
  title: z.string().trim().min(1, 'จำเป็น').max(255),
  summary: z.string().trim().max(500).optional().or(z.literal('')),
  description: z.string().max(50_000).optional().or(z.literal('')),
  visibility: z.enum(['PUBLIC', 'INTERNAL', 'PRIVATE']),
  estimatedMinutes: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  passingScore: z.coerce.number().int().min(0).max(100).optional().or(z.literal('')),
  antiAfkEnabled: z.boolean(),
  unlockNextCourseId: z.string().optional().or(z.literal('')),
  coverImageUrl: z.string().optional().or(z.literal('')),
});

type CourseFormValues = z.input<typeof CourseFormSchema>;

interface Props {
  mode: 'create' | 'edit';
  course?: {
    id: string;
    title: string;
    summary?: string | null;
    description?: string | null;
    visibility?: 'PUBLIC' | 'INTERNAL' | 'PRIVATE';
    estimatedMinutes?: number | null;
    passingScore?: number | null;
    antiAfkEnabled?: boolean;
    unlockNextCourseId?: string | null;
    coverImageUrl?: string | null;
  };
  trigger?: React.ReactNode;
}

export function CourseFormDialog({ mode, course, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const coursesQuery = useQuery({
    queryKey: ['courses', 'all'],
    queryFn: listAllCourses,
    enabled: open,
  });

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(CourseFormSchema),
    defaultValues: {
      title: course?.title ?? '',
      summary: course?.summary ?? '',
      description: course?.description ?? '',
      visibility: course?.visibility ?? 'INTERNAL',
      estimatedMinutes: course?.estimatedMinutes ?? '',
      passingScore: course?.passingScore ?? '',
      antiAfkEnabled: course?.antiAfkEnabled ?? true,
      unlockNextCourseId: course?.unlockNextCourseId ?? '',
      coverImageUrl: course?.coverImageUrl ?? '',
    },
  });

  async function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setCoverError(null);
    setUploadingCover(true);
    try {
      const url = await uploadCourseCover(file);
      form.setValue('coverImageUrl', url, { shouldDirty: true });
    } catch {
      setCoverError('อัปโหลดรูปไม่สำเร็จ — รองรับ PNG/JPG/WEBP/SVG ขนาดไม่เกิน 2MB');
    } finally {
      setUploadingCover(false);
    }
  }

  const mutation = useMutation({
    mutationFn: async (values: CourseFormValues) => {
      const cleaned: CreateCourseInput = {
        title: values.title,
        summary: values.summary || undefined,
        description: values.description || undefined,
        visibility: values.visibility,
        estimatedMinutes: values.estimatedMinutes === '' ? undefined : Number(values.estimatedMinutes),
        passingScore: values.passingScore === '' ? undefined : Number(values.passingScore),
        antiAfkEnabled: values.antiAfkEnabled,
        unlockNextCourseId: values.unlockNextCourseId ? values.unlockNextCourseId : null,
        coverImageUrl: values.coverImageUrl || undefined,
      };
      if (mode === 'edit' && course) {
        return updateCourse(course.id, cleaned);
      }
      return createCourse(cleaned);
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
      void queryClient.invalidateQueries({ queryKey: ['course', created.id] });
      setOpen(false);
      void toastSuccess(mode === 'create' ? 'สร้างหลักสูตรแล้ว' : 'บันทึกหลักสูตรแล้ว');
      if (mode === 'create') {
        navigate(`/courses/${created.id}`);
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> สร้างหลักสูตร
        </Button>
      )}
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'สร้างหลักสูตร' : 'แก้ไขหลักสูตร'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'กรอกข้อมูลพื้นฐาน — เพิ่มบทเรียนและหัวข้อได้ที่หน้า Builder ภายหลัง'
              : 'แก้ไขข้อมูลหลักสูตร — บทเรียนและหัวข้อจัดการที่หน้า Builder'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="course-title">ชื่อหลักสูตร *</Label>
            <Input id="course-title" {...form.register('title')} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="course-summary">สรุปย่อ</Label>
            <Textarea id="course-summary" rows={2} {...form.register('summary')} />
          </div>
          <div className="space-y-2">
            <Label>รูปปกหลักสูตร</Label>
            {form.watch('coverImageUrl') ? (
              <div className="relative w-fit">
                <img
                  src={form.watch('coverImageUrl')}
                  alt="รูปปกหลักสูตร"
                  className="h-32 w-56 rounded-md border object-cover"
                />
                <button
                  type="button"
                  onClick={() => form.setValue('coverImageUrl', '', { shouldDirty: true })}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
                  aria-label="ลบรูปปก"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex h-32 w-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground transition-colors hover:bg-accent">
                {uploadingCover ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="h-6 w-6" />
                    <span>อัปโหลดรูปปก</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={onCoverChange}
                  disabled={uploadingCover}
                />
              </label>
            )}
            {coverError && <p className="text-xs text-destructive">{coverError}</p>}
            <p className="text-xs text-muted-foreground">PNG/JPG/WEBP/SVG ไม่เกิน 2MB</p>
          </div>
          <div className="space-y-2">
            <Label>คำอธิบายเต็ม</Label>
            <RichTextEditor
              value={form.watch('description') ?? ''}
              onChange={(html) => form.setValue('description', html, { shouldDirty: true })}
              minHeight={140}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="course-visibility">การมองเห็น</Label>
              <select
                id="course-visibility"
                {...form.register('visibility')}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="INTERNAL">ภายในองค์กร</option>
                <option value="PUBLIC">สาธารณะ</option>
                <option value="PRIVATE">ส่วนตัว</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-minutes">ระยะเวลาประมาณ (นาที)</Label>
              <Input id="course-minutes" type="number" min={0} {...form.register('estimatedMinutes')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-passing">เกณฑ์ผ่าน (%)</Label>
              <Input
                id="course-passing"
                type="number"
                min={0}
                max={100}
                {...form.register('passingScore')}
              />
            </div>
          </div>
          <label className="flex items-start gap-2.5 border border-border bg-muted/30 p-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" {...form.register('antiAfkEnabled')} />
            <span>
              <span className="font-medium">เปิดระบบกันหลับ (Anti-AFK)</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                เด้งคำถามสุ่มระหว่างดูวิดีโอในคอร์สนี้ เพื่อเช็คว่าผู้เรียนยังดูอยู่ — ปิดได้ถ้าไม่ต้องการให้รบกวน
              </span>
            </span>
          </label>
          <div className="space-y-2">
            <Label htmlFor="course-next">หลักสูตรถัดไป (ปลดล็อกด้วยโค้ดเมื่อสอบผ่านหลักสูตรนี้)</Label>
            <select
              id="course-next"
              {...form.register('unlockNextCourseId')}
              className="h-10 w-full border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">— ไม่มี (ไม่ปลดล็อกอะไร) —</option>
              {(coursesQuery.data?.items ?? [])
                .filter((c) => c.id !== course?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
            </select>
            <p className="text-xs text-muted-foreground">
              เมื่อผู้เรียนสอบผ่านหลักสูตรนี้ ระบบจะออกโค้ดให้นำไปกรอกเพื่อเข้าเรียนหลักสูตรถัดไป
            </p>
          </div>
          {mutation.isError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getApiErrorMessage(mutation.error, 'บันทึกไม่สำเร็จ')}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
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
