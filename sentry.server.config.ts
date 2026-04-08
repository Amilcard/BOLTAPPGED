import * as Sentry from '@sentry/nextjs';

// RGPD : patterns PII à scrubber avant envoi à Sentry
const PII_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,      // emails
  /\b0[1-9][\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}\b/g, // téléphones FR
  /\b\d{13,16}\b/g,                                           // numéros de carte potentiels
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, // UUIDs (suivi_token etc.)
];

function scrubPii(text: string): string {
  let result = text;
  result = result.replace(PII_PATTERNS[0], '[EMAIL_REDACTED]');
  result = result.replace(PII_PATTERNS[1], '[PHONE_REDACTED]');
  result = result.replace(PII_PATTERNS[2], '[CARD_REDACTED]');
  result = result.replace(PII_PATTERNS[3], '[UUID_REDACTED]');
  return result;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

  // Erreurs à ignorer côté serveur
  ignoreErrors: [
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT',
  ],

  // RGPD : filtrer les données personnelles avant envoi
  beforeSend(event) {
    // Scrub les messages d'erreur
    if (event.message) {
      event.message = scrubPii(event.message);
    }

    // Scrub les exceptions
    if (event.exception?.values) {
      for (const ex of event.exception.values) {
        if (ex.value) ex.value = scrubPii(ex.value);
      }
    }

    // Scrub les breadcrumbs
    if (event.breadcrumbs) {
      for (const bc of event.breadcrumbs) {
        if (bc.message) bc.message = scrubPii(bc.message);
      }
    }

    // Supprimer les données utilisateur (IP, user agent déjà envoyés par défaut)
    delete event.user;

    return event;
  },

  enabled: process.env.NODE_ENV === 'production',
});
