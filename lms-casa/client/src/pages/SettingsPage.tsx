import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { getApiErrorMessage } from '../lib/api-error';
import { toastSuccess } from '../lib/confirm';
import {
  applyBranding,
  getAntiAfk,
  getBranding,
  updateAntiAfk,
  updateBranding,
  uploadLogo,
  type AntiAfkConfig,
} from '../features/admin/admin.api';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['branding'], queryFn: getBranding });
  const [form, setForm] = useState({ name: 'LMS Casa', primaryColor: '#1B7E5D', logoUrl: '' });

  const afkQuery = useQuery({ queryKey: ['anti-afk-config'], queryFn: getAntiAfk });
  const [afk, setAfk] = useState<AntiAfkConfig>({
    enabled: true,
    minIntervalSec: 20,
    maxIntervalSec: 45,
    answerTimeoutSec: 10,
  });
  const afkMutation = useMutation({
    mutationFn: updateAntiAfk,
    onSuccess: (cfg) => {
      queryClient.setQueryData(['anti-afk-config'], cfg);
      void toastSuccess('บันทึก Anti-AFK แล้ว');
    },
  });
  useEffect(() => {
    if (afkQuery.data) setAfk(afkQuery.data);
  }, [afkQuery.data]);
  const updateMutation = useMutation({
    mutationFn: updateBranding,
    onSuccess: (branding) => {
      applyBranding(branding);
      queryClient.setQueryData(['branding'], branding);
      void toastSuccess('บันทึก branding แล้ว');
    },
  });
  const uploadMutation = useMutation({
    mutationFn: uploadLogo,
    onSuccess: (branding) => {
      applyBranding(branding);
      setForm({
        name: branding.name,
        primaryColor: branding.primaryColor,
        logoUrl: branding.logoUrl ?? '',
      });
      queryClient.setQueryData(['branding'], branding);
      void toastSuccess('อัปโหลดโลโก้แล้ว');
    },
  });

  useEffect(() => {
    if (!query.data) return;
    setForm({
      name: query.data.name,
      primaryColor: query.data.primaryColor,
      logoUrl: query.data.logoUrl ?? '',
    });
    applyBranding(query.data);
  }, [query.data]);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">ตั้งค่าระบบ</h1>
        <p className="mt-1 text-sm text-muted-foreground">ปรับ branding ของระบบ (ชื่อ, สี, โลโก้) — มีผลทันที</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form
          className="space-y-4 border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            updateMutation.mutate({
              name: form.name,
              primaryColor: form.primaryColor,
              logoUrl: form.logoUrl || null,
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="brand-name">ชื่อระบบ</Label>
            <Input id="brand-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primary-color">สีหลัก</Label>
            <div className="flex gap-2">
              <Input
                id="primary-color"
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
              />
              <input
                aria-label="เลือกสีหลัก"
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="h-10 w-12 border bg-background"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">อัปโหลดโลโก้</Label>
            <Input
              id="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadMutation.mutate(file);
              }}
            />
          </div>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            บันทึก branding
          </Button>
        </form>

        <aside className="border bg-card p-4">
          <div className="text-sm font-medium text-muted-foreground">ตัวอย่าง</div>
          <div className="mt-4 border p-4">
            <div className="flex items-center gap-3">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="" className="h-10 w-10 object-contain" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground">
                  <Upload className="h-5 w-5" />
                </div>
              )}
              <div className="font-semibold">{form.name}</div>
            </div>
            <Button className="mt-4 w-full">ปุ่มหลัก (ตัวอย่าง)</Button>
          </div>
        </aside>
      </section>

      <section className="max-w-2xl space-y-4 border bg-card p-4">
        <div>
          <h2 className="font-semibold">Anti-AFK (กันหลับระหว่างดูวิดีโอ)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            สุ่มเด้งคำถามระหว่างเล่นวิดีโอ — ปรับช่วงเวลาเด้งและเวลาตอบได้ มีผลทันทีกับผู้เรียนทุกคน
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            afkMutation.mutate(afk);
          }}
        >
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={afk.enabled}
              onChange={(e) => setAfk({ ...afk, enabled: e.target.checked })}
              className="h-4 w-4"
            />
            เปิดใช้งาน Anti-AFK
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="afk-min">เด้งเร็วสุด (วินาที)</Label>
              <Input
                id="afk-min"
                type="number"
                min={5}
                value={afk.minIntervalSec}
                onChange={(e) => setAfk({ ...afk, minIntervalSec: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="afk-max">เด้งช้าสุด (วินาที)</Label>
              <Input
                id="afk-max"
                type="number"
                min={5}
                value={afk.maxIntervalSec}
                onChange={(e) => setAfk({ ...afk, maxIntervalSec: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="afk-timeout">เวลาตอบ (วินาที)</Label>
              <Input
                id="afk-timeout"
                type="number"
                min={3}
                value={afk.answerTimeoutSec}
                onChange={(e) => setAfk({ ...afk, answerTimeoutSec: Number(e.target.value) })}
              />
            </div>
          </div>
          {afkMutation.isError && (
            <p className="text-sm text-destructive">{getApiErrorMessage(afkMutation.error, 'บันทึกไม่สำเร็จ')}</p>
          )}
          <Button type="submit" disabled={afkMutation.isPending}>
            {afkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            บันทึก Anti-AFK
          </Button>
        </form>
      </section>
    </div>
  );
}
