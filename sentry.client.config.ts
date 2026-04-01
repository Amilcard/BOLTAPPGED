import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Capturer 10% des transactions (performance)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

  // Ne pas spammer Sentry avec des erreurs normales
  ignoreErrors: [
    'NEXT_NOT_FOUND',
    'AbortError',
    'ResizeObserver loop limit exceeded',
  ],

  // Ne pas envoyer en développement local
  enabled: process.env.NODE_ENV === 'production',
});
