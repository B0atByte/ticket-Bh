import type { ErrorEvent } from '@sentry/react';

const sensitiveHeaders = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key']);

function redactRequest(event: ErrorEvent): ErrorEvent {
  const headers = event.request?.headers;
  if (headers) {
    for (const key of Object.keys(headers)) {
      if (sensitiveHeaders.has(key.toLowerCase())) {
        headers[key] = '[Redacted]';
      }
    }
  }

  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
  }

  return event;
}

export const isSentryEnabled = (import.meta.env.VITE_SENTRY_DSN ?? '').trim().length > 0;

if (isSentryEnabled) {
  void import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      sendDefaultPii: false,
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
      beforeSend: redactRequest,
    });
  });
}
