import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import './lib/i18n';
import './lib/sentry';
import './index.css';
import App from './App';
import { setAuthFailureHandler, setRefreshHandler } from './lib/api';
import { refresh } from './features/auth/auth.api';
import { useAuthStore } from './features/auth/auth.store';

// Wire the refresh-token flow into the axios interceptor. On a 401 the interceptor
// calls this handler once (rotating the session cookies server-side), then retries
// the original request.
setRefreshHandler(refresh);
// If refresh fails (refresh token expired/revoked), drop the session; ProtectedRoute
// then redirects to /login on the next render.
setAuthFailureHandler(() => {
  useAuthStore.setState({ user: null });
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', color: '#dc2626' }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Runtime Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, background: '#fef2f2', padding: 16, borderRadius: 8 }}>
            {(this.state.error as Error).message}
            {'\n\n'}
            {(this.state.error as Error).stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 16, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            ลองใหม่
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
