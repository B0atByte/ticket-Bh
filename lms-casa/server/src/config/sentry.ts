import * as Sentry from '@sentry/node';
import { env } from './env.js';

const sensitiveHeaders = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key']);

function redactRequest(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
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

export const isSentryEnabled = env.SENTRY_DSN.trim().length > 0;

if (isSentryEnabled) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend: redactRequest,
  });
}

export { Sentry };
