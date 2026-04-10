import * as Sentry from '@sentry/nextjs';

// RGPD : patterns PII à scrubber avant envoi à Sentry
const PII_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  /\b0[1-9][\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}\b/g,
  /\b\d{13,16}\b/g,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
];

function scrubPii(text: string): string {
  let result = text;
  result = result.replace(PII_PATTERNS[0], '[EMAIL_REDACTED]');
  result = result.replace(PII_PATTERNS[1], '[PHONE_REDACTED]');
  result = result.replace(PII_PATTERNS[2], '[CARD_REDACTED]');
  result = result.replace(PII_PATTERNS[3], '[UUID_REDACTED]');
  return result;
}

export const onRequestError = Sentry.captureRequestError;

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
      ignoreErrors: ['NEXT_NOT_FOUND', 'NEXT_REDIRECT'],
      beforeSend(event) {
        if (event.message) event.message = scrubPii(event.message);
        if (event.exception?.values) {
          for (const ex of event.exception.values) {
            if (ex.value) ex.value = scrubPii(ex.value);
          }
        }
        if (event.breadcrumbs) {
          for (const bc of event.breadcrumbs) {
            if (bc.message) bc.message = scrubPii(bc.message);
          }
        }
        delete event.user;
        return event;
      },
      enabled: process.env.NODE_ENV === 'production',
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0,
      enabled: process.env.NODE_ENV === 'production',
    });
  }
}
