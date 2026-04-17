/** @jest-environment node */
import { UUID_RE, EMAIL_REGEX, isUuid, isEmail } from '@/lib/validators';

describe('UUID_RE', () => {
  test('valide UUID v4', () => {
    expect(UUID_RE.test('00000000-0000-4000-8000-000000000001')).toBe(true);
    expect(isUuid('4d5e6f70-1234-4abc-8def-123456789abc')).toBe(true);
  });
  test('rejette non-UUID', () => {
    expect(UUID_RE.test('abc')).toBe(false);
    expect(UUID_RE.test('')).toBe(false);
    expect(isUuid(null as unknown as string)).toBe(false);
  });
});

describe('EMAIL_REGEX', () => {
  test('valide email', () => {
    expect(EMAIL_REGEX.test('a@b.fr')).toBe(true);
    expect(isEmail('user.name+tag@sub.domain.tld')).toBe(true);
  });
  test('rejette invalide', () => {
    expect(EMAIL_REGEX.test('pas-email')).toBe(false);
    expect(EMAIL_REGEX.test('@y.fr')).toBe(false);
    expect(isEmail(null as unknown as string)).toBe(false);
  });
});
