import { z } from 'zod';

/**
 * Validation centralisée des variables d'environnement.
 *
 * Utilisation dans les routes API :
 *   import { serverEnv } from '@/lib/env';
 *   const supabase = createClient(serverEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY);
 *
 * Utilisation côté client :
 *   import { clientEnv } from '@/lib/env';
 *   const supabase = createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
 *
 * Remplace les `process.env.XXX!` (non-null assertion) qui crashent
 * silencieusement si la variable est absente.
 */

// ── Variables publiques (accessibles côté client + serveur) ──────────────────

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_TEST_MODE: z.enum(['true', 'false']).optional(),
  NEXT_PUBLIC_EMAIL_STRUCTURE_LOCKED: z.enum(['true', 'false']).optional(),
  NEXT_PUBLIC_DEFAULT_STRUCTURE_EMAIL: z.string().email().optional(),
});

// ── Variables serveur (jamais exposées côté client) ──────────────────────────

const serverSchema = clientSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  NEXTAUTH_SECRET: z.string().min(16),
  EMAIL_SERVICE_API_KEY: z.string().min(5),
  ADMIN_NOTIFICATION_EMAIL: z.string().optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  // Coordonnées bancaires (optionnelles, pour les emails virement)
  ORG_BANK_HOLDER: z.string().optional(),
  ORG_BANK_IBAN: z.string().optional(),
  ORG_BANK_BIC: z.string().optional(),
  ORG_BANK_BRANCH: z.string().optional(),
});

// ── Parsing sécurisé ─────────────────────────────────────────────────────────

function parseEnv<T extends z.ZodTypeAny>(schema: T, label: string): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `❌ Variables d'environnement invalides (${label}) :\n${missing}\n\n` +
      `Vérifiez votre .env.local ou les variables Vercel.`
    );
  }
  return result.data;
}

/**
 * Variables publiques — utilisables côté client ET serveur.
 * Lazy-loaded au premier accès pour ne pas bloquer le build.
 */
let _clientEnv: z.infer<typeof clientSchema> | null = null;
export function getClientEnv() {
  if (!_clientEnv) _clientEnv = parseEnv(clientSchema, 'client');
  return _clientEnv;
}

/**
 * Variables serveur — utilisables UNIQUEMENT dans les routes API / middleware.
 * Inclut les variables publiques + les secrets.
 * Lazy-loaded au premier accès.
 */
let _serverEnv: z.infer<typeof serverSchema> | null = null;
export function getServerEnv() {
  if (!_serverEnv) _serverEnv = parseEnv(serverSchema, 'server');
  return _serverEnv;
}

// Alias pratiques pour l'import destructuré
export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;
