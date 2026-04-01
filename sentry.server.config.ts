import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

  // Erreurs à ignorer côté serveur
  ignoreErrors: [
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT',
  ],

  enabled: process.env.NODE_ENV === 'production',
});
