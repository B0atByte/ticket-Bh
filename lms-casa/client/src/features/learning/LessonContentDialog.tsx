import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ExternalLink,
  FileAudio,
  FileText,
  Film,
  Image as ImageIcon,
  Layers,
  Link as LinkIcon,
  Loader2,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { toastSuccess } from '../../lib/confirm';
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
  addLessonContent,
  getLesson,
  removeLessonContent,
  uploadLessonMaterial,
  type LessonContentType,
} from './learning.api';

const TYPES: { value: LessonContentType; label: string; icon: typeof Film; needsUrl: boolean; needsBody: boolean }[] = [
  { value: 'VIDEO', label: 'วิดีโอ (YouTube/Vimeo/MP4)', icon: Film, needsUrl: true, needsBody: false },
  { value: 'PDF', label: 'เอกสาร PDF', icon: FileText, needsUrl: true, needsBody: false },
  { value: 'SLIDES', label: 'สไลด์ (Google/PowerPoint)', icon: Layers, needsUrl: true, needsBody: false },
  { value: 'AUDIO', label: 'เสียง', icon: FileAudio, needsUrl: true, needsBody: false },
  { value: 'LINK', label: 'ลิงก์ภายนอก', icon: LinkIcon, needsUrl: true, needsBody: false },
  { value: 'TEXT', label: 'ข้อความ', icon: Type, needsUrl: false, needsBody: true },
];

interface Props {
  lessonId: string;
  lessonTitle: string;
  trigger: React.ReactNode;
}

export function LessonContentDialog({ lessonId, lessonTitle, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const [type, setType] = useState<LessonContentType>('VIDEO');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  async function onPdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setError(null);
    setUploadingPdf(true);
    try {
      const uploadedUrl = await uploadLessonMaterial(file);
      setUrl(uploadedUrl);
    } catch {
      setError('อัปโหลดไฟล์ไม่สำเร็จ — ต้องเป็น PDF ขนาดไม่เกิน 20MB');
    } finally {
      setUploadingPdf(false);
    }
  }

  const lessonQuery = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => getLesson(lessonId),
    enabled: open,
  });

  const addMut = useMutation({
    mutationFn: () => {
      const cfg = TYPES.find((t) => t.value === type);
      if (cfg?.needsUrl && !url.trim()) throw new Error(`เนื้อหาประเภท ${type} ต้องระบุ URL`);
      if (cfg?.needsBody && !body.trim()) throw new Error(`เนื้อหาประเภท ${type} ต้องกรอกข้อความ`);
      return addLessonContent(lessonId, {
        type,
        title: title.trim() || undefined,
        url: url.trim() || undefined,
        body: body.trim() || undefined,
      });
    },
    onSuccess: () => {
      setTitle('');
      setUrl('');
      setBody('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] });
    },
    onError: (e: { message?: string }) => setError(e?.message ?? 'เพิ่มเนื้อหาไม่สำเร็จ'),
  });

  const removeMut = useMutation({
    mutationFn: (contentId: string) => removeLessonContent(lessonId, contentId),
    onSuccess: () => {
      setConfirmDeleteId(null);
      void queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] });
      void toastSuccess('ลบเนื้อหาแล้ว');
    },
    onError: () => {
      setConfirmDeleteId(null);
      setError('ลบเนื้อหาไม่สำเร็จ กรุณาลองใหม่');
    },
  });

  const currentTypeCfg = TYPES.find((t) => t.value === type);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>เนื้อหา: {lessonTitle}</DialogTitle>
          <DialogDescription>
            เพิ่มวิดีโอ, PDF, สไลด์, หรือข้อความให้บทเรียนนี้ —
            วิดีโอตัวแรกจะแสดงใน player, ประเภทอื่นแสดงเป็นการ์ดด้านล่าง
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3" aria-label="Existing contents">
          <h3 className="text-sm font-semibold">เนื้อหาที่มี</h3>
          {lessonQuery.isLoading ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              กำลังโหลด…
            </div>
          ) : (lessonQuery.data?.contents ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีเนื้อหา</p>
          ) : (
            <ul className="space-y-2">
              {(lessonQuery.data?.contents ?? []).map((c) => {
                const Icon = TYPES.find((t) => t.value === c.type)?.icon ?? ImageIcon;
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-medium">
                      {c.type}
                    </span>
                    <span className="flex-1 truncate">{c.title ?? '(ไม่มีชื่อ)'}</span>
                    {c.url && (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {confirmDeleteId === c.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-destructive">ลบ?</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-6 px-2 text-xs"
                          disabled={removeMut.isPending}
                          onClick={() => removeMut.mutate(c.id)}
                        >
                          ยืนยัน
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          ยกเลิก
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-7 w-7 px-0 text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmDeleteId(c.id)}
                        aria-label={`ลบเนื้อหา ${c.type}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-md border border-dashed p-3" aria-label="Add new content">
          <h3 className="text-sm font-semibold">เพิ่มเนื้อหาใหม่</h3>

          <div className="space-y-2">
            <Label>ประเภท</Label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {TYPES.map((t) => {
                const Icon = t.icon;
                const active = type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={`flex items-center gap-2 rounded-md border px-2 py-2 text-xs transition-colors ${
                      active
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'bg-background hover:bg-accent'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lc-title">ชื่อ (ไม่บังคับ)</Label>
            <Input
              id="lc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น บทที่ 1 — แนะนำบริษัท"
            />
          </div>

          {currentTypeCfg?.needsUrl && (
            <div className="space-y-2">
              <Label htmlFor="lc-url">{type === 'PDF' ? 'อัปโหลดไฟล์ หรือวาง URL *' : 'URL *'}</Label>

              {type === 'PDF' && (
                <div className="flex items-center gap-2">
                  <label className={`inline-flex cursor-pointer items-center gap-2 border border-input bg-background px-3 py-2 text-sm transition hover:bg-accent ${uploadingPdf ? 'pointer-events-none opacity-60' : ''}`}>
                    {uploadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploadingPdf ? 'กำลังอัปโหลด…' : 'อัปโหลดไฟล์ PDF'}
                    <input type="file" accept="application/pdf" className="hidden" onChange={onPdfUpload} disabled={uploadingPdf} />
                  </label>
                  {url && <span className="truncate text-xs text-emerald-600">อัปโหลดแล้ว</span>}
                </div>
              )}

              <Input
                id="lc-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  type === 'VIDEO'
                    ? 'https://www.youtube.com/watch?v=... หรือ https://your-cdn/video.mp4'
                    : type === 'PDF'
                    ? 'หรือวางลิงก์ PDF (เช่น Google Drive)'
                    : 'https://...'
                }
              />
              <p className="text-[10px] text-muted-foreground">
                {type === 'VIDEO'
                  ? 'รองรับลิงก์ YouTube, Vimeo หรือไฟล์ MP4/HLS โดยตรง — ระบบจะ embed อัตโนมัติ'
                  : type === 'PDF'
                  ? 'อัปโหลดไฟล์ PDF เข้าระบบโดยตรง (ไม่เกิน 20MB) หรือวางลิงก์ PDF จากที่อื่น'
                  : 'ต้องเป็น HTTPS'}
              </p>
            </div>
          )}

          {currentTypeCfg?.needsBody && (
            <div className="space-y-2">
              <Label>เนื้อหา *</Label>
              <RichTextEditor value={body} onChange={setBody} minHeight={160} />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => addMut.mutate()}
              disabled={addMut.isPending}
            >
              {addMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              เพิ่มเนื้อหา
            </Button>
          </div>
        </section>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            เสร็จสิ้น
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
