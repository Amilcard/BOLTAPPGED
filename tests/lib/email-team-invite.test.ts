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
    expect(result).toBeDefined();
  });

  test('retourne null si pas de clé API', async () => {
    const old = process.env.EMAIL_SERVICE_API_KEY;
    delete process.env.EMAIL_SERVICE_API_KEY;
    const result = await sendTeamMemberInvite({
      to: 'x@y.fr', prenom: 'X', structureName: 'S', role: 'secretariat',
      activationUrl: 'https://x', invitedBy: 'd@e.f',
    });
    expect(result).toBeNull();
    process.env.EMAIL_SERVICE_API_KEY = old;
  });
});
