/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const nextJest = require('next/jest');

const PROJECT_ROOT = path.resolve(__dirname);

const createJestConfig = nextJest({
  dir: PROJECT_ROOT,
});

const customJestConfig = {
  setupFilesAfterEnv: [`${PROJECT_ROOT}/jest.setup.js`],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': `${PROJECT_ROOT}/$1`,
  },
  testMatch: [
    `${PROJECT_ROOT}/tests/unit/**/*.test.ts`,
    `${PROJECT_ROOT}/tests/unit/**/*.test.tsx`,
    `${PROJECT_ROOT}/tests/api/**/*.test.ts`,
  ],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
};

// Wrapper async : applique les restrictions APRÈS que next/jest a construit
// sa config de base. On utilise __dirname (absolu) pour éviter que
// jest-haste-map remonte l'arborescence et scanne des projets voisins
// (ex: /Users/laidhamoudi/InKlusifApp).
module.exports = async () => {
  const baseConfig = await createJestConfig(customJestConfig)();

  return {
    ...baseConfig,

    // Chemins absolus — pas de token <rootDir> non résolu au démarrage haste-map.
    roots: [PROJECT_ROOT],

    // Cache local au projet — évite toute contamination cross-projet.
    cacheDirectory: `${PROJECT_ROOT}/.jest-cache`,

    // Exclusions redondantes par sécurité.
    modulePathIgnorePatterns: [
      `${PROJECT_ROOT}/node_modules`,
      `${PROJECT_ROOT}/.next`,
      '/InKlusifApp/',
    ],
    watchPathIgnorePatterns: [
      `${PROJECT_ROOT}/node_modules`,
      `${PROJECT_ROOT}/.next`,
      '/InKlusifApp/',
    ],
    testPathIgnorePatterns: [
      `${PROJECT_ROOT}/node_modules`,
      `${PROJECT_ROOT}/.next`,
      '/InKlusifApp/',
    ],

    // ESM packages : jose, @supabase/*, uuid — doivent être transformés par Jest
    transformIgnorePatterns: [
      '/node_modules/(?!(jose|@supabase|uuid)/)',
    ],
  };
};
