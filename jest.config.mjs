import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const PROJECT_ROOT = __dirname;

const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: PROJECT_ROOT });

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
    `${PROJECT_ROOT}/tests/lib/**/*.test.ts`,
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

const jestConfig = async () => {
  const baseConfig = await createJestConfig(customJestConfig)();

  return {
    ...baseConfig,
    roots: [PROJECT_ROOT],
    cacheDirectory: `${PROJECT_ROOT}/.jest-cache`,
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
    transformIgnorePatterns: [
      '/node_modules/(?!(jose|@supabase|uuid)/)',
    ],
  };
};

export default jestConfig;
