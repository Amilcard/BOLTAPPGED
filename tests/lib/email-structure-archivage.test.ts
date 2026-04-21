/**
 * Tests unitaires — sendStructureArchivageEmail (lib/email.ts)
 *
 * Vérifie : envoi via Resend, fallback no-op si clé API absente,
 * fallback no-op si structureEmail vide, contenu HTML + texte.
 */

const mockSend = jest.fn().mockResolvedValue({ data: { id: 'email-archive-id' }, error: null });

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

import { sendStructureArchivageEmail } from '@/lib/email';

describe('sendStructureArchivageEmail', () => {
  beforeEach(() => {
    mockSend.mockClear();
    process.env.EMAIL_SERVICE_API_KEY = 'test-key';
  });

  test('envoie email à structureEmail avec sujet contenant nom + référence', async () => {
    const result = await sendStructureArchivageEmail({
      structureEmail: 'secretariat@mecs.fr',
      jeunePrenom: 'Lucas',
      jeuneNom: 'Martin',
      dossierRef: 'DOS-2026-001',
      pdfLink: 'https://app.groupeetdecouverte.fr/api/dossier-enfant/abc/pdf?token=xyz&type=bulletin',
    });

    // Nouveau contrat L2 : EmailResult discriminé {sent:true, messageId}
    expect(result).toEqual({ sent: true, messageId: 'email-archive-id' });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe('secretariat@mecs.fr');
    expect(call.subject).toContain('Lucas Martin');
    expect(call.subject).toContain('DOS-2026-001');
    expect(call.subject).toContain('archivage');
    // HTML
    expect(call.html).toContain('Lucas Martin');
    expect(call.html).toContain('https://app.groupeetdecouverte.fr/api/dossier-enfant/abc/pdf?token=xyz&type=bulletin');
    expect(call.html).toContain('Télécharger le récapitulatif PDF');
    // Texte plain (accessible / fallback client mail)
    expect(call.text).toContain('Lucas Martin');
    expect(call.text).toContain('DOS-2026-001');
    expect(call.text).toContain('https://app.groupeetdecouverte.fr/api/dossier-enfant/abc/pdf?token=xyz&type=bulletin');
  });

  test('omet la référence dans le sujet/corps si dossierRef absent', async () => {
    await sendStructureArchivageEmail({
      structureEmail: 'sec@x.fr',
      jeunePrenom: 'Léa',
      jeuneNom: 'Dupont',
      pdfLink: 'https://example.org/pdf',
    });
    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toContain('Léa Dupont');
    expect(call.subject).not.toContain('réf.');
    expect(call.text).toContain('Léa Dupont');
    // pas de "(réf. …)" inséré
    expect(call.text).not.toContain('(réf.');
  });

  test('retourne {sent:false, reason:invalid_input} si structureEmail vide (pas d\'envoi)', async () => {
    const result = await sendStructureArchivageEmail({
      structureEmail: '',
      jeunePrenom: 'X',
      jeuneNom: 'Y',
      pdfLink: 'https://example.org/pdf',
    });
    // Nouveau contrat L2 — guard input-invalide avant tryResendSend.
    expect(result).toEqual({ sent: false, reason: 'invalid_input' });
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('retourne {sent:false, reason:missing_api_key} si EMAIL_SERVICE_API_KEY absente', async () => {
    const old = process.env.EMAIL_SERVICE_API_KEY;
    delete process.env.EMAIL_SERVICE_API_KEY;
    const result = await sendStructureArchivageEmail({
      structureEmail: 'sec@x.fr',
      jeunePrenom: 'X',
      jeuneNom: 'Y',
      pdfLink: 'https://example.org/pdf',
    });
    // Nouveau contrat L2 — tryResendSend retourne missing_api_key.
    expect(result).toEqual({ sent: false, reason: 'missing_api_key' });
    expect(mockSend).not.toHaveBeenCalled();
    process.env.EMAIL_SERVICE_API_KEY = old;
  });

  test('échappe le HTML dans nom/prénom (XSS)', async () => {
    await sendStructureArchivageEmail({
      structureEmail: 'sec@x.fr',
      jeunePrenom: '<script>alert(1)</script>',
      jeuneNom: 'Dupont',
      pdfLink: 'https://example.org/pdf',
    });
    const call = mockSend.mock.calls[0][0];
    // Pas de balise script brute dans le HTML
    expect(call.html).not.toContain('<script>alert(1)</script>');
    expect(call.html).toContain('&lt;script&gt;');
  });

  test('retourne {sent:false, reason:provider_error} si Resend lance une erreur (catch interne via tryResendSend)', async () => {
    mockSend.mockRejectedValueOnce(new Error('SMTP boom'));
    const result = await sendStructureArchivageEmail({
      structureEmail: 'sec@x.fr',
      jeunePrenom: 'X',
      jeuneNom: 'Y',
      pdfLink: 'https://example.org/pdf',
    });
    // Nouveau contrat L2 — provider_error (jamais throw, jamais PII dans reason).
    expect(result).toEqual({ sent: false, reason: 'provider_error' });
  });
});
