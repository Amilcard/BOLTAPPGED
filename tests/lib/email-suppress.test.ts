/**
 * Tests unitaires — suppression email temporaire (Cordée + Clairière).
 *
 * Vérifie :
 * - Match exact (case-insensitive)
 * - Match suffix de domaine
 * - Champs to/cc/bcc (scalar, array, objet Resend {email})
 * - Non impactés : Thanh, GED internes, autres structures
 * - Helper isEmailSuppressed + anyRecipientSuppressed
 * - Intégration avec tryResendSend (short-circuit avant provider call)
 */

// jest.mock DOIT être au top-level pour que Jest hoist correctement.
// Placé avant tout import de @/lib/email pour garantir que le singleton Resend
// utilise bien ce mock (pas un module déjà résolu).
const mockSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

import { isEmailSuppressed, anyRecipientSuppressed, EMAIL_SUPPRESSION_RULES } from '@/lib/email-suppress';
import { tryResendSend } from '@/lib/email';

describe('email-suppress — règles', () => {
  test('EMAIL_SUPPRESSION_RULES contient bien les 3 entrées attendues (2026-04-22)', () => {
    expect(EMAIL_SUPPRESSION_RULES).toContain('o.geoffroy.lce@gmail.com');
    expect(EMAIL_SUPPRESSION_RULES).toContain('@fondationdiaconesses.org');
    expect(EMAIL_SUPPRESSION_RULES).toContain('@mecs-laclairiere.fr');
  });
});

describe('isEmailSuppressed', () => {
  test('match exact (case-insensitive) — CDS Cordée', () => {
    expect(isEmailSuppressed('o.geoffroy.lce@gmail.com')).toBe(true);
    expect(isEmailSuppressed('O.GEOFFROY.LCE@GMAIL.COM')).toBe(true);
    expect(isEmailSuppressed('  o.geoffroy.lce@gmail.com  ')).toBe(true);
  });

  test('match suffix domaine @fondationdiaconesses.org — toute Clairière', () => {
    expect(isEmailSuppressed('mehdi.elhakour@fondationdiaconesses.org')).toBe(true);
    expect(isEmailSuppressed('Christelle.ETIENNE@fondationdiaconesses.org')).toBe(true);
    expect(isEmailSuppressed('lena.cottret@fondationdiaconesses.org')).toBe(true);
    expect(isEmailSuppressed('N.IMPORTE.QUI@FONDATIONDIACONESSES.ORG')).toBe(true);
  });

  test('match suffix domaine @mecs-laclairiere.fr', () => {
    expect(isEmailSuppressed('direction@mecs-laclairiere.fr')).toBe(true);
    expect(isEmailSuppressed('quelquun@mecs-laclairiere.fr')).toBe(true);
  });

  test('ne matche PAS — Thanh (testeur prod)', () => {
    expect(isEmailSuppressed('thanh@example.com')).toBe(false);
    expect(isEmailSuppressed('thanh.test@partenaire.fr')).toBe(false);
  });

  test('ne matche PAS — GED internes', () => {
    expect(isEmailSuppressed('contact@groupeetdecouverte.fr')).toBe(false);
    expect(isEmailSuppressed('groupeetdecouverte@gmail.com')).toBe(false);
  });

  test('ne matche PAS — gmail.com hors email exact Cordée', () => {
    // Vérifie que le match Cordée reste exact et NE bloque PAS tout @gmail.com
    expect(isEmailSuppressed('random@gmail.com')).toBe(false);
    expect(isEmailSuppressed('autre.educ@gmail.com')).toBe(false);
  });

  test('ne matche PAS — sous-string qui contient un domaine mais ne termine pas dessus', () => {
    // Évite les faux positifs du type "@fondationdiaconesses.org.attacker.com"
    expect(isEmailSuppressed('victim@fondationdiaconesses.org.attacker.com')).toBe(false);
  });

  test('ne matche PAS — chaîne vide, whitespace, email malformé', () => {
    expect(isEmailSuppressed('')).toBe(false);
    expect(isEmailSuppressed('   ')).toBe(false);
    expect(isEmailSuppressed('pas-un-email')).toBe(false);
  });

  test('matche domaine "nu" (sans local-part) — comportement attendu', () => {
    // Un payload malformé type `to: '@fondationdiaconesses.org'` bloque aussi (conservateur)
    expect(isEmailSuppressed('@fondationdiaconesses.org')).toBe(true);
    expect(isEmailSuppressed('@mecs-laclairiere.fr')).toBe(true);
  });
});

describe('anyRecipientSuppressed — couvre to/cc/bcc', () => {
  test('to scalaire — suppressé', () => {
    expect(anyRecipientSuppressed({ to: 'lena.cottret@fondationdiaconesses.org' })).toBe(true);
  });

  test('to scalaire — non suppressé', () => {
    expect(anyRecipientSuppressed({ to: 'thanh@example.com' })).toBe(false);
  });

  test('to array — au moins un suppressé bloque tout', () => {
    expect(
      anyRecipientSuppressed({
        to: ['thanh@example.com', 'lena.cottret@fondationdiaconesses.org'],
      })
    ).toBe(true);
  });

  test('to array — aucun suppressé', () => {
    expect(
      anyRecipientSuppressed({
        to: ['thanh@example.com', 'contact@groupeetdecouverte.fr'],
      })
    ).toBe(false);
  });

  test('cc suppressé — bloque même si to est safe', () => {
    expect(
      anyRecipientSuppressed({
        to: 'safe@example.com',
        cc: 'direction@mecs-laclairiere.fr',
      })
    ).toBe(true);
  });

  test('bcc suppressé — bloque même si to + cc sont safe', () => {
    expect(
      anyRecipientSuppressed({
        to: 'safe@example.com',
        cc: 'other@example.com',
        bcc: ['o.geoffroy.lce@gmail.com'],
      })
    ).toBe(true);
  });

  test('cc/bcc undefined — pas de crash', () => {
    expect(anyRecipientSuppressed({ to: 'safe@example.com' })).toBe(false);
  });

  test('tous les champs vides — false', () => {
    expect(anyRecipientSuppressed({})).toBe(false);
  });

  test('valeurs non-string dans array — ignorées sans crash', () => {
    expect(
      anyRecipientSuppressed({
        to: ['safe@example.com', 123 as unknown as string, null as unknown as string],
      })
    ).toBe(false);
  });
});

describe('tryResendSend — intégration suppression', () => {
  beforeEach(() => {
    mockSend.mockReset();
    process.env.EMAIL_SERVICE_API_KEY = 'test-key';
  });

  test('short-circuit avant provider.send — destinataire suppressé', async () => {
    const result = await tryResendSend({
      from: 'noreply@test.fr',
      to: 'lena.cottret@fondationdiaconesses.org',
      subject: 'Test notif',
      html: '<p>x</p>',
    });
    expect(result).toEqual({ sent: false, reason: 'suppressed' });
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('passe normalement si aucun destinataire suppressé (Thanh)', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'mock-ok' }, error: null });
    const result = await tryResendSend({
      from: 'noreply@test.fr',
      to: 'thanh@example.com',
      subject: 'Test Thanh',
      html: '<p>x</p>',
    });
    expect(result).toEqual({ sent: true, messageId: 'mock-ok' });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('bloque aussi si destinataire passé sous forme objet Resend {email}', async () => {
    const result = await tryResendSend({
      from: 'noreply@test.fr',
      to: [{ name: 'Lena', email: 'lena.cottret@fondationdiaconesses.org' } as unknown as string],
      subject: 'Test objet',
      html: '<p>x</p>',
    });
    expect(result).toEqual({ sent: false, reason: 'suppressed' });
    expect(mockSend).not.toHaveBeenCalled();
  });
});
