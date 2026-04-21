/**
 * Tests unitaires — infra EmailResult (lot L1/6).
 *
 * Vérifie :
 * - Type EmailResult + tryResendSend importables et compilent
 * - tryResendSend returns {sent:true, messageId} sur succès Resend
 * - tryResendSend returns {sent:false, reason:'provider_error'} sur error Resend
 * - tryResendSend returns {sent:false, reason:'provider_error'} sur exception throw
 * - tryResendSend returns {sent:false, reason:'missing_api_key'} si clé absente
 *
 * Ne touche PAS aux 24 fonctions existantes (tests email-team-invite,
 * email-structure-archivage restent verts sans modification).
 */

const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

import { tryResendSend, type EmailResult } from '@/lib/email';

describe('EmailResult / tryResendSend (infra L1/6)', () => {
  beforeEach(() => {
    mockSend.mockReset();
    process.env.EMAIL_SERVICE_API_KEY = 'test-key';
  });

  test('compile — type EmailResult discriminé importable', () => {
    const ok: EmailResult = { sent: true, messageId: 'abc' };
    const ko: EmailResult = { sent: false, reason: 'missing_api_key' };
    expect(ok.sent).toBe(true);
    expect(ko.sent).toBe(false);
  });

  test('retourne {sent:true, messageId} sur succès Resend', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'mock' }, error: null });
    const result = await tryResendSend({
      from: 'noreply@test.fr',
      to: 'user@test.fr',
      subject: 'Test',
      html: '<p>ok</p>',
    });
    expect(result).toEqual({ sent: true, messageId: 'mock' });
  });

  test('retourne {sent:false, reason:provider_error} sur error Resend', async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });
    const result = await tryResendSend({
      from: 'noreply@test.fr',
      to: 'user@test.fr',
      subject: 'Test',
      html: '<p>ok</p>',
    });
    expect(result).toEqual({ sent: false, reason: 'provider_error' });
  });

  test('retourne {sent:false, reason:provider_error} sur exception throw', async () => {
    mockSend.mockRejectedValueOnce(new Error('network boom'));
    const result = await tryResendSend({
      from: 'noreply@test.fr',
      to: 'user@test.fr',
      subject: 'Test',
      html: '<p>ok</p>',
    });
    expect(result).toEqual({ sent: false, reason: 'provider_error' });
  });

  test('retourne {sent:false, reason:missing_api_key} si EMAIL_SERVICE_API_KEY absente', async () => {
    const old = process.env.EMAIL_SERVICE_API_KEY;
    delete process.env.EMAIL_SERVICE_API_KEY;
    const result = await tryResendSend({
      from: 'noreply@test.fr',
      to: 'user@test.fr',
      subject: 'Test',
      html: '<p>ok</p>',
    });
    expect(result).toEqual({ sent: false, reason: 'missing_api_key' });
    expect(mockSend).not.toHaveBeenCalled();
    process.env.EMAIL_SERVICE_API_KEY = old;
  });

  test('retourne {sent:false, reason:missing_api_key} si clé = placeholder', async () => {
    const old = process.env.EMAIL_SERVICE_API_KEY;
    process.env.EMAIL_SERVICE_API_KEY = 'YOUR_EMAIL_API_KEY_HERE';
    const result = await tryResendSend({
      from: 'noreply@test.fr',
      to: 'user@test.fr',
      subject: 'Test',
      html: '<p>ok</p>',
    });
    expect(result).toEqual({ sent: false, reason: 'missing_api_key' });
    expect(mockSend).not.toHaveBeenCalled();
    process.env.EMAIL_SERVICE_API_KEY = old;
  });

  test('reason ne contient JAMAIS de PII (enum fermé)', async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: 'user@secret.fr invalid recipient' },
    });
    const result = await tryResendSend({
      from: 'noreply@test.fr',
      to: 'user@secret.fr',
      subject: 'Test',
      html: '<p>ok</p>',
    });
    expect(result.sent).toBe(false);
    if (!result.sent) {
      expect(result.reason).toBe('provider_error');
      // Aucun champ exposant l'email dans reason
      expect(JSON.stringify(result)).not.toContain('user@secret.fr');
    }
  });
});
