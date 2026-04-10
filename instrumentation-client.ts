import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  ignoreErrors: [
    'NEXT_NOT_FOUND',
    'AbortError',
    'ResizeObserver loop limit exceeded',
  ],
  beforeSend(event) {
    delete event.user;
    return event;
  },
  enabled: process.env.NODE_ENV === 'production',
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
