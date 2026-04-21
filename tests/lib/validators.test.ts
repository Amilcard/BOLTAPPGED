/** @jest-environment node */
import { UUID_RE, EMAIL_REGEX, isUuid, isEmail, isSafeImageUrl } from '@/lib/validators';

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

describe('isSafeImageUrl', () => {
  test('accepte URL https absolue', () => {
    expect(isSafeImageUrl('https://iirfvndgzutbxwfdwawu.supabase.co/storage/v1/object/public/stays/hero.jpg')).toBe(true);
    expect(isSafeImageUrl('https://example.com/img.png')).toBe(true);
  });
  test('rejette http, protocoles dangereux, relatifs', () => {
    expect(isSafeImageUrl('http://example.com/img.jpg')).toBe(false);
    expect(isSafeImageUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeImageUrl('data:image/png;base64,iVBOR')).toBe(false);
    expect(isSafeImageUrl('/relative/path.jpg')).toBe(false);
    expect(isSafeImageUrl('')).toBe(false);
  });
  test('rejette chars de break-out attribut (XSS)', () => {
    expect(isSafeImageUrl('https://evil.com/x.jpg" onerror="alert(1)')).toBe(false);
    expect(isSafeImageUrl('https://evil.com/<script>')).toBe(false);
    expect(isSafeImageUrl('https://evil.com/x\'.jpg')).toBe(false);
    expect(isSafeImageUrl('https://evil.com/ x.jpg')).toBe(false);
  });
  test('rejette types non-string et overflow', () => {
    expect(isSafeImageUrl(null)).toBe(false);
    expect(isSafeImageUrl(undefined)).toBe(false);
    expect(isSafeImageUrl(123)).toBe(false);
    expect(isSafeImageUrl('https://x.com/' + 'a'.repeat(2100))).toBe(false);
  });
});
