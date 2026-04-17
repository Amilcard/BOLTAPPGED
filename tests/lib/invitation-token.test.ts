import { generateInvitationToken, computeInvitationExpiry, isInvitationExpired } from '@/lib/invitation-token';

describe('invitation token', () => {
  test('generateInvitationToken retourne UUID v4', () => {
    const token = generateInvitationToken();
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('computeInvitationExpiry retourne ~48h dans le futur', () => {
    const expiry = computeInvitationExpiry();
    const deltaMs = new Date(expiry).getTime() - Date.now();
    expect(deltaMs).toBeGreaterThan(47 * 3600 * 1000);
    expect(deltaMs).toBeLessThan(49 * 3600 * 1000);
  });

  test('isInvitationExpired true si date passée', () => {
    expect(isInvitationExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
  });

  test('isInvitationExpired false si date future', () => {
    expect(isInvitationExpired(new Date(Date.now() + 3600000).toISOString())).toBe(false);
  });

  test('isInvitationExpired true si null', () => {
    expect(isInvitationExpired(null)).toBe(true);
  });
});
