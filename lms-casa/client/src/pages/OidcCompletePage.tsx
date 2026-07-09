/**
 * OidcCompletePage — Phase 6 SSO
 *
 * The backend redirects here after a successful OIDC callback:
 *   /auth/oidc/complete?code=...
 *
 * This page:
 *   1. Reads the one-time exchange code from URL search params
 *   2. Exchanges it via POST /auth/oidc/exchange (server sets session cookies)
 *   3. Fetches /auth/me to populate the auth store
 *   4. Redirects to /dashboard (or shows an error if something went wrong)
 *
 * User never sees this page — it renders a brief "Loading..." while redirecting.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { exchangeOidcCode, me } from '../features/auth/auth.api';
import { useAuthStore } from '../features/auth/auth.store';

export function OidcCompletePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    // Strict-mode guard — run once only
    if (ran.current) return;
    ran.current = true;

    const code = searchParams.get('code');
    const ssoError = searchParams.get('sso_error');

    if (ssoError) {
      setError(ssoError);
      return;
    }

    if (!code) {
      setError('Missing exchange code from SSO callback. Please try again.');
      return;
    }

    // Exchange the one-time code for session tokens (stores them via writeStoredTokens)
    exchangeOidcCode(code)
      .then(() => me())
      .then((user) => {
        setUser(user);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        setError('SSO login failed or your session could not be loaded. Please try again.');
      });
  }, [navigate, searchParams, setUser]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex max-w-sm flex-col items-center gap-4 border bg-card p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <h1 className="text-lg font-semibold">SSO Login Failed</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <a
            href="/login"
            className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Back to login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Completing login…
      </div>
    </main>
  );
}
