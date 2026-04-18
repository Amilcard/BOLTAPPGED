import { validateBase64Image, isUuid, isEmail } from '@/lib/validators';

describe('validateBase64Image', () => {
  const small = 'data:image/png;base64,' + 'A'.repeat(400);

  test('rejette valeur vide', () => {
    expect(validateBase64Image('')).toEqual({ ok: false, reason: 'empty' });
    expect(validateBase64Image(null)).toEqual({ ok: false, reason: 'empty' });
    expect(validateBase64Image(undefined)).toEqual({ ok: false, reason: 'empty' });
  });

  test('rejette format non data URL', () => {
    expect(validateBase64Image('http://x.png')).toEqual({ ok: false, reason: 'format' });
    expect(validateBase64Image('base64,abc')).toEqual({ ok: false, reason: 'format' });
  });

  test('rejette MIME non autorisé', () => {
    const svg = 'data:image/svg+xml;base64,AAAA';
    expect(validateBase64Image(svg)).toEqual({ ok: false, reason: 'mime' });
  });

  test('rejette payload > max', () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(800_000);
    const r = validateBase64Image(big, { max: 500_000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('too_large');
  });

  test('accepte data URL PNG dans la limite', () => {
    const r = validateBase64Image(small);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.bytes).toBeGreaterThan(0);
  });

  test('cap custom max', () => {
    const payload = 'data:image/png;base64,' + 'A'.repeat(1000);
    const r = validateBase64Image(payload, { max: 100 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('too_large');
  });

  test('MIME JPEG accepté si whitelist étendue', () => {
    const jpg = 'data:image/jpeg;base64,' + 'A'.repeat(200);
    const r = validateBase64Image(jpg, { mimes: ['image/png', 'image/jpeg'] });
    expect(r.ok).toBe(true);
  });
});

describe('isUuid / isEmail — sanity', () => {
  test('isUuid valide', () => {
    expect(isUuid('11111111-2222-3333-4444-555555555555')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });
  test('isEmail valide', () => {
    expect(isEmail('a@b.c')).toBe(true);
    expect(isEmail('no-at')).toBe(false);
  });
});
