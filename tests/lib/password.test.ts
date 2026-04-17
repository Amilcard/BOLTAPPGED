// tests/lib/password.test.ts
import { hashPassword, verifyPassword } from '@/lib/password';

describe('password helper', () => {
  test('hashPassword retourne un hash bcrypt', async () => {
    const hash = await hashPassword('MotDePasse123!');
    expect(hash).toMatch(/^\$2[ayb]\$.{56}$/);
    expect(hash).not.toContain('MotDePasse123!');
  });

  test('verifyPassword accepte le bon password', async () => {
    const hash = await hashPassword('MotDePasse123!');
    expect(await verifyPassword('MotDePasse123!', hash)).toBe(true);
  });

  test('verifyPassword rejette un mauvais password', async () => {
    const hash = await hashPassword('MotDePasse123!');
    expect(await verifyPassword('Mauvais', hash)).toBe(false);
  });

  test('verifyPassword retourne false si hash null', async () => {
    expect(await verifyPassword('x', null)).toBe(false);
  });
});
