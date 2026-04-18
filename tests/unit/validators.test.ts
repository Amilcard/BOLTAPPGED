import { validateBase64Image, validateUploadSize, isUuid, isEmail } from '@/lib/validators';

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

describe('validateUploadSize', () => {
  test('rejette valeur vide ou non-fichier', () => {
    expect(validateUploadSize(null)).toEqual({ ok: false, reason: 'missing' });
    expect(validateUploadSize(undefined)).toEqual({ ok: false, reason: 'missing' });
    expect(validateUploadSize('string')).toEqual({ ok: false, reason: 'missing' });
    expect(validateUploadSize({})).toEqual({ ok: false, reason: 'missing' });
    expect(validateUploadSize({ size: 'not-a-number' })).toEqual({ ok: false, reason: 'missing' });
    expect(validateUploadSize({ size: -1 })).toEqual({ ok: false, reason: 'missing' });
  });

  test('accepte fichier dans la limite', () => {
    const r = validateUploadSize({ size: 3_000_000 }, { max: 5_000_000 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.bytes).toBe(3_000_000);
  });

  test('rejette fichier > max', () => {
    const r = validateUploadSize({ size: 10_000_000 }, { max: 5_000_000 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('too_large');
      expect(r.actual).toBe(10_000_000);
    }
  });

  test('défaut 5 MB', () => {
    const r1 = validateUploadSize({ size: 5_000_000 });
    expect(r1.ok).toBe(true);
    const r2 = validateUploadSize({ size: 5_000_001 });
    expect(r2.ok).toBe(false);
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
