import '@testing-library/jest-dom';

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NODE_ENV = 'test';

// Mock global auditLog — fire-and-forget, ne doit pas bloquer les tests
jest.mock('@/lib/audit-log', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));

// Mock global rate-limit — les tests unitaires ne doivent pas taper la DB
// Les tests qui vérifient le rate-limiting peuvent override avec jest.mocked()
jest.mock('@/lib/rate-limit', () => ({
  isRateLimited: jest.fn().mockResolvedValue(false),
  getClientIpFromHeaders: jest.fn().mockReturnValue('127.0.0.1'),
}));

jest.mock('@/lib/rate-limit-structure', () => ({
  structureRateLimitGuard: jest.fn().mockResolvedValue(null),
  isStructureRateLimited: jest.fn().mockResolvedValue(false),
  getStructureClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));
