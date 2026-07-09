import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { getOidcStatus, login, me } from './auth.api';
import { useAuthStore } from './auth.store';
import { DevQuickLogin, type DevAccount } from './DevQuickLogin';

const LoginSchema = z.object({
  identifier: z.string().trim().min(1).max(255),
  password:   z.string().min(1).max(128),
});
type LoginForm = z.infer<typeof LoginSchema>;

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    if (error.code === 'ERR_NETWORK')
      return 'ไม่สามารถเชื่อมต่อ API ได้ กรุณาเปิด backend ที่ localhost:4000 แล้วลองอีกครั้ง';
    return error.response?.data?.error?.message ?? fallback;
  }
  return fallback;
}

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate    = useNavigate();
  const location    = useLocation();
  const setUser     = useAuthStore((state) => state.setUser);
  const [showPw, setShowPw] = useState(false);

  const oidcStatus = useQuery({
    queryKey: ['auth', 'oidc-status'],
    queryFn:  getOidcStatus,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  // Session is httpOnly-cookie-based — probe /auth/me to detect an existing login.
  const sessionQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: me,
    retry: false,
  });
  const form = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { identifier: '', password: '' },
  });
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/dashboard';

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (session) => {
      setUser(session.user);
      navigate(from, { replace: true });
    },
  });

  if (sessionQuery.isSuccess) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Language toggle */}
      <div className="flex justify-end p-4">
        <Button
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          onClick={() => i18n.changeLanguage(i18n.language === 'th' ? 'en' : 'th')}
        >
          {i18n.language === 'th' ? 'EN' : 'TH'}
        </Button>
      </div>

      {/* Centered card */}
      <div className="flex flex-1 items-start justify-center px-5 pt-[8vh] pb-10">
        <div className="w-full max-w-[380px] animate-fade-up">

          {/* Brand */}
          <div className="mb-10 flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center bg-primary">
              <span className="font-serif text-xl text-primary-foreground">L</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">LMS Casa</h1>
            <p className="mt-1 text-sm text-muted-foreground">เข้าสู่ระบบเพื่อเริ่มต้นการเรียนรู้</p>
          </div>

          {/* Form */}
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <div className="space-y-1.5">
              <Label htmlFor="identifier" className="text-sm text-foreground/80">
                {t('auth.identifier')}
              </Label>
              <Input
                id="identifier"
                autoComplete="username"
                placeholder={t('auth.identifierPlaceholder')}
                className="h-11 bg-card"
                {...form.register('identifier')}
              />
              {form.formState.errors.identifier && (
                <p className="text-xs text-destructive">{form.formState.errors.identifier.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm text-foreground/80">
                {t('auth.password')}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-11 bg-card pr-11"
                  {...form.register('password')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            {mutation.isError && (
              <div
                className="border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                {errorMessage(mutation.error, t('auth.loginFailed'))}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={mutation.isPending}
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('auth.login')}
            </Button>
          </form>

          {oidcStatus.data?.enabled && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground/60">{t('auth.or')}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <Button asChild variant="outline" className="h-11 w-full">
                <a href="/api/v1/auth/oidc/authorize">
                  <ShieldCheck className="h-4 w-4" />
                  {t('auth.loginWithSso')}
                </a>
              </Button>
            </div>
          )}

          <DevQuickLogin
            pending={mutation.isPending}
            onPick={(account: DevAccount) => {
              form.setValue('identifier', account.identifier);
              form.setValue('password', account.password);
              mutation.mutate({ identifier: account.identifier, password: account.password });
            }}
          />

          <p className="mt-10 text-center text-[11px] text-muted-foreground/50">
            LMS Casa &copy; {new Date().getFullYear()} — Enterprise Learning Management System
          </p>
        </div>
      </div>
    </div>
  );
}
