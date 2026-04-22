import { defineConfig, devices } from '@playwright/test';

// ── SÉCURITÉ : empêcher tout lancement E2E contre la production ─────────────
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
if (baseURL.includes('groupeetdecouverte.fr') || baseURL.includes('vercel.app')) {
  throw new Error(
    '[ERROR] PLAYWRIGHT_BASE_URL pointe vers la production !\n' +
    `   URL détectée : ${baseURL}\n` +
    '   Les tests E2E créent de vraies inscriptions — ne jamais lancer contre la prod.\n' +
    '   Utilisez http://localhost:3000 ou un environnement staging.'
  );
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['html'], ['list'], ['json', { outputFile: 'test-results/results.json' }]]
    : 'html',

  use: {
    baseURL,
    // retain-on-failure > on-first-retry : trace chaque run qui fail, pas juste le 1er retry
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
