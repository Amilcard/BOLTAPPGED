/**
 * @jest-environment node
 *
 * Tests configuration — lib/env.ts (getServerEnv)
 *
 * Vérifie que les gardes Zod détectent les variables manquantes / malformées
 * avant déploiement prod.
 *
 * Technique :
 *   - beforeEach / afterEach pour isoler chaque test
 *   - jest.resetModules() + dynamic import pour bypasser le cache singleton
 *
 * Scénarios :
 *  1. SUPABASE_URL absente  → throw mentionnant la variable
 *  2. SUPABASE_URL non-URL  → throw mentionnant la variable
 *  3. STRIPE_SECRET_KEY sans préfixe sk_ → throw
 *  4. NEXTAUTH_SECRET trop court (< 16 chars) → throw
 *  5. Toutes les variables valides → retourne l'objet sans throw
 */

// ── Variables minimales valides ───────────────────────────────────────────────

const VALID_ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon-key-long-enough-ok',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service-role-long-enough',
  STRIPE_SECRET_KEY: 'sk_test_fakekeyfortesting',
  STRIPE_WEBHOOK_SECRET: 'whsec_testfakewebhooksecret',
  NEXTAUTH_SECRET: 'test-secret-at-least-16-chars!',
  EMAIL_SERVICE_API_KEY: 'email-api-key-ok',
};

// Clés à gérer (y compris optionnelles pouvant être invalides dans l'env de test)
const MANAGED_KEYS = [
  ...Object.keys(VALID_ENV),
  'NEXT_PUBLIC_DEFAULT_STRUCTURE_EMAIL',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_TEST_MODE',
  'NEXT_PUBLIC_EMAIL_STRUCTURE_LOCKED',
  'ADMIN_NOTIFICATION_EMAIL',
  'NEXTAUTH_URL',
];

let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  // Sauvegarder les valeurs courantes
  savedEnv = {};
  for (const key of MANAGED_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key]; // table rase pour chaque test
  }
  // Appliquer les vars valides de base
  Object.assign(process.env, VALID_ENV);
});

afterEach(() => {
  // Restaurer l'env original
  for (const [key, val] of Object.entries(savedEnv)) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
  jest.resetModules();
});

async function freshGetServerEnv() {
  jest.resetModules();
  const mod = await import('@/lib/env');
  return mod.getServerEnv;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('getServerEnv() — variables manquantes ou invalides', () => {
  it('1. NEXT_PUBLIC_SUPABASE_URL absente → throw avec son nom', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const getServerEnv = await freshGetServerEnv();
    expect(() => getServerEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('2. NEXT_PUBLIC_SUPABASE_URL non-URL → throw avec son nom', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-url';
    const getServerEnv = await freshGetServerEnv();
    expect(() => getServerEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('3. STRIPE_SECRET_KEY sans préfixe sk_ → throw', async () => {
    process.env.STRIPE_SECRET_KEY = 'rk_test_wrong_prefix';
    const getServerEnv = await freshGetServerEnv();
    expect(() => getServerEnv()).toThrow(/STRIPE_SECRET_KEY/);
  });

  it('4. NEXTAUTH_SECRET trop court → throw', async () => {
    process.env.NEXTAUTH_SECRET = 'tooshort';
    const getServerEnv = await freshGetServerEnv();
    expect(() => getServerEnv()).toThrow(/NEXTAUTH_SECRET/);
  });

  it('5. toutes les variables valides → retourne l\'objet sans throw', async () => {
    const getServerEnv = await freshGetServerEnv();
    expect(() => getServerEnv()).not.toThrow();
    const env = getServerEnv();
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test.supabase.co');
    expect(env.STRIPE_SECRET_KEY).toMatch(/^sk_/);
    expect(env.NEXTAUTH_SECRET.length).toBeGreaterThanOrEqual(16);
  });
});
