import { sendTeamMemberInvite } from '@/lib/email';

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ data: { id: 'email-id' }, error: null }) },
  })),
}));

describe('sendTeamMemberInvite', () => {
  beforeAll(() => { process.env.EMAIL_SERVICE_API_KEY = 'test-key'; });

  test('envoie un email avec lien activation', async () => {
    const result = await sendTeamMemberInvite({
      to: 'test@example.com',
      prenom: 'Marie',
      structureName: 'MECS Les Oliviers',
      role: 'secretariat',
      activationUrl: 'https://app.groupeetdecouverte.fr/structure/activate?token=abc',
      invitedBy: 'direction@example.com',
    });
    // Nouveau contrat L2 — EmailResult discriminé, sent:true attendu.
    expect(result).toEqual({ sent: true, messageId: 'email-id' });
  });

  test('retourne {sent:false, reason:missing_api_key} si pas de clé API', async () => {
    const old = process.env.EMAIL_SERVICE_API_KEY;
    delete process.env.EMAIL_SERVICE_API_KEY;
    const result = await sendTeamMemberInvite({
      to: 'x@y.fr', prenom: 'X', structureName: 'S', role: 'secretariat',
      activationUrl: 'https://x', invitedBy: 'd@e.f',
    });
    // Nouveau contrat L2 — tryResendSend retourne missing_api_key.
    expect(result).toEqual({ sent: false, reason: 'missing_api_key' });
    process.env.EMAIL_SERVICE_API_KEY = old;
  });
});
