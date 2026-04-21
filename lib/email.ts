import { Resend } from 'resend';
import { isSafeImageUrl } from '@/lib/validators';

// Lazy singleton — prevents top-level crash when EMAIL_SERVICE_API_KEY is absent at build time.
let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.EMAIL_SERVICE_API_KEY);
  return _resend;
}

// ============================================================
// EmailResult — type discriminé pour les retours des 24 fonctions
// d'envoi email. Introduction lot L1/6, refactor des fonctions
// dans lots L2-L5. Ne casse rien en L1 (type non encore utilisé).
// ============================================================
export type EmailResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: 'missing_api_key' | 'provider_error' | 'invalid_input' | 'rate_limited' };

// Payload générique — aligné sur la forme réelle du SDK Resend v6
// (from, to, subject, html/text, etc.). Typé ouvert pour accepter
// tous les champs optionnels du SDK (cc, bcc, reply_to, headers, attachments).
export type ResendSendPayload = {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  [key: string]: unknown;
};

/**
 * Helper interne — JAMAIS throw, JAMAIS de PII dans reason.
 * Wrapper unique autour de resend.emails.send pour normaliser le retour.
 * Lecture dynamique de process.env.EMAIL_SERVICE_API_KEY (compatible tests
 * qui suppriment/restaurent la clé entre appels).
 *
 * Usage (dans les lots L2-L5) :
 *   return await tryResendSend({ from, to, subject, html });
 */
export async function tryResendSend(payload: ResendSendPayload): Promise<EmailResult> {
  const apiKey = process.env.EMAIL_SERVICE_API_KEY;
  if (!apiKey || apiKey === 'YOUR_EMAIL_API_KEY_HERE') {
    console.error('[email] EMAIL_SERVICE_API_KEY missing — silent no-op avoided');
    return { sent: false, reason: 'missing_api_key' };
  }
  try {
    // Cast vers le type attendu par le SDK Resend — ResendSendPayload est un
    // superset structurel compatible. Évite de dépendre du type interne du SDK
    // qui peut changer entre versions mineures.
    const result = await getResend().emails.send(payload as Parameters<ReturnType<typeof getResend>['emails']['send']>[0]);
    if (result.error || !result.data?.id) {
      console.error('[email] provider_error', result.error);
      return { sent: false, reason: 'provider_error' };
    }
    return { sent: true, messageId: result.data.id };
  } catch (err) {
    console.error('[email] provider_error exception', err);
    return { sent: false, reason: 'provider_error' };
  }
}

// Échappement HTML — prévient injection XSS dans les templates email
const htmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Domaine groupeetdecouverte.fr vérifié sur Resend
const FROM_EMAIL = 'Groupe & Découverte <noreply@groupeetdecouverte.fr>';
const ADMIN_EMAIL = (process.env.ADMIN_NOTIFICATION_EMAIL || 'contact@groupeetdecouverte.fr,groupeetdecouverte@gmail.com')
  .split(',').map(e => e.trim()).filter(Boolean);

interface InscriptionEmailData {
  referentNom: string;
  referentEmail: string;
  jeunePrenom: string;
  jeuneNom: string;
  sejourSlug: string;
  sessionDate: string;
  cityDeparture: string;
  priceTotal: number;
  paymentMethod?: string;
  paymentReference?: string;
  // Phase 1 — parcours pro
  dossierRef?: string;
  organisation?: string;
  suiviUrl?: string | null;
}

/**
 * Email de confirmation d'inscription envoyé au référent
 *
 * Refactor L2/6 — délègue à tryResendSend (wrapper unique, retour EmailResult).
 */
export async function sendInscriptionConfirmation(data: InscriptionEmailData): Promise<EmailResult> {
  // PII supprimé — RGPD Art. 32 : aucun log avec email/nom.
  return await tryResendSend({
    from: FROM_EMAIL,
    to: data.referentEmail,
    subject: `Confirmation d'inscription - Réf. ${data.dossierRef || 'en cours'}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2a383f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Groupe &amp; Découverte</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #2a383f; margin-top: 0;">Inscription enregistrée</h2>
            <p>Bonjour ${htmlEscape(data.referentNom)},</p>
            <p>L'inscription de <strong>${htmlEscape(data.jeunePrenom)} ${htmlEscape(data.jeuneNom)}</strong> a bien été enregistrée.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Séjour</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${data.sejourSlug.replace(/-/g, ' ')}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Session</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.sessionDate}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Départ</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.cityDeparture.replace(/_/g, ' ')}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Montant</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${data.priceTotal.toFixed(2)} €</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Mode de paiement</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.paymentMethod === 'bank_transfer' ? 'Virement bancaire' : data.paymentMethod === 'cheque' ? 'Chèque' : 'Carte bancaire'}</td></tr>
              ${data.paymentReference ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Référence paiement</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${data.paymentReference}</td></tr>` : ''}
              ${data.dossierRef ? `<tr><td style="padding: 8px; color: #6b7280;">N° de dossier</td><td style="padding: 8px; font-weight: bold; font-family: monospace;">${data.dossierRef}</td></tr>` : ''}
            </table>

            ${data.suiviUrl ? `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <h3 style="color: #166534; margin: 0 0 8px 0; font-size: 15px;">Suivi de votre dossier</h3>
              <p style="margin: 0 0 12px 0; color: #15803d; font-size: 14px;">Retrouvez à tout moment l'état de votre inscription et des éventuels autres dossiers liés à votre structure :</p>
              <a href="${data.suiviUrl}" style="display: inline-block; background: #166534; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">Accéder au suivi</a>
              <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 12px;">Ce lien est personnel et réservé à votre structure. Conservez-le précieusement.</p>
            </div>
            ` : ''}

            ${data.paymentMethod === 'bank_transfer' ? `
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <h3 style="color: #1e40af; margin: 0 0 8px 0; font-size: 15px;">Instructions de virement bancaire</h3>
              <p style="margin: 0 0 8px 0; color: #1e3a8a; font-size: 14px;">Merci d'effectuer le virement en mentionnant votre référence <strong>${data.paymentReference || ''}</strong> en libellé.</p>
              <table style="font-size: 13px; color: #1e3a8a;">
                <tr><td style="padding: 2px 8px 2px 0; color: #6b7280;">Titulaire</td><td><strong>${process.env.ORG_BANK_HOLDER || 'GROUPE ET DECOUVERTE'}</strong></td></tr>
                <tr><td style="padding: 2px 8px 2px 0; color: #6b7280;">IBAN</td><td><strong>${process.env.ORG_BANK_IBAN || 'Contactez-nous pour les coordonnées bancaires'}</strong></td></tr>
                <tr><td style="padding: 2px 8px 2px 0; color: #6b7280;">BIC</td><td><strong>${process.env.ORG_BANK_BIC || ''}</strong></td></tr>
                <tr><td style="padding: 2px 8px 2px 0; color: #6b7280;">Domiciliation</td><td>${process.env.ORG_BANK_BRANCH || ''}</td></tr>
                <tr><td style="padding: 2px 8px 2px 0; color: #6b7280;">Libellé</td><td><strong>${data.paymentReference || data.jeunePrenom}</strong></td></tr>
              </table>
              <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 12px;">Attention :Votre inscription sera validée à réception du règlement.</p>
            </div>
            ` : ''}

            ${data.paymentMethod === 'cheque' ? `
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <h3 style="color: #92400e; margin: 0 0 8px 0; font-size: 15px;">Instructions chèque</h3>
              <p style="margin: 0 0 8px 0; color: #78350f; font-size: 14px;">Merci d'adresser votre chèque à l'ordre de <strong>Groupe &amp; Découverte</strong>, en inscrivant la référence <strong>${data.paymentReference || ''}</strong> au dos.</p>
              <table style="font-size: 13px; color: #78350f;">
                <tr><td style="padding: 2px 8px 2px 0; color: #6b7280;">À l'ordre de</td><td><strong>GROUPE ET DECOUVERTE</strong></td></tr>
                <tr><td style="padding: 2px 8px 2px 0; color: #6b7280;">Adresse</td><td><strong>3 rue Flobert — 42000 Saint-Étienne</strong></td></tr>
                <tr><td style="padding: 2px 8px 2px 0; color: #6b7280;">Référence au dos</td><td><strong>${data.paymentReference || data.jeunePrenom}</strong></td></tr>
              </table>
              <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 12px;">Attention :Votre inscription sera validée à réception du chèque.</p>
            </div>
            ` : ''}

            <p style="color: #6b7280; font-size: 14px;">Votre inscription est en attente de validation. Vous recevrez un email de confirmation une fois le paiement reçu et validé.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">Groupe &amp; Découverte — Séjours de vacances pour enfants et adolescents</p>
            <p style="font-size:11px;color:#6b7280;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px;">
              Securite :Les données collectées sont traitées conformément au RGPD et hébergées en Union européenne.
              Elles sont accessibles uniquement aux personnes habilitées et conservées pour la durée strictement nécessaire.
              Pour exercer vos droits : <a href="mailto:dpo@groupeetdecouverte.fr" style="color: #6b7280;">dpo@groupeetdecouverte.fr</a>
            </p>
          </div>
        </div>
      `,
  });
}

/**
 * Notification admin pour nouvelle inscription
 */
export async function sendAdminNewInscriptionNotification(data: InscriptionEmailData): Promise<EmailResult> {
  return await tryResendSend({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `Nouvelle inscription - Réf. ${data.dossierRef || 'en cours'}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2a383f;">Nouvelle inscription reçue</h2>
          <ul>
            <li><strong>Jeune :</strong> ${htmlEscape(data.jeunePrenom)} ${htmlEscape(data.jeuneNom)}</li>
            <li><strong>Référent :</strong> ${htmlEscape(data.referentNom)} (${data.referentEmail})</li>
            ${data.organisation ? `<li><strong>Structure :</strong> ${htmlEscape(data.organisation)}</li>` : ''}
            ${data.dossierRef ? `<li><strong>Dossier :</strong> <code>${data.dossierRef}</code></li>` : ''}
            <li><strong>Séjour :</strong> ${data.sejourSlug}</li>
            <li><strong>Session :</strong> ${data.sessionDate}</li>
            <li><strong>Départ :</strong> ${data.cityDeparture}</li>
            <li><strong>Montant :</strong> ${data.priceTotal.toFixed(2)} €</li>
            ${data.paymentMethod ? `<li><strong>Paiement :</strong> ${data.paymentMethod}</li>` : ''}
          </ul>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.groupeetdecouverte.fr'}/admin/demandes" style="background: #2a383f; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Voir dans l'admin</a></p>
        </div>
      `,
  });
}

/**
 * Notification admin quand un paiement Stripe est confirmé
 */
export async function sendPaymentConfirmedAdminNotification(data: {
  inscriptionId: string;
  referentNom: string;
  jeunePrenom: string;
  jeuneNom: string;
  sejourSlug: string;
  dossierRef: string;
  amount: number;
  subject?: string;
}): Promise<EmailResult> {
  return await tryResendSend({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: data.subject || `Paiement confirmé — Réf. ${data.dossierRef || 'N/A'} (${data.amount.toFixed(2)} €)`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #16a34a; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">Paiement CB confirmé</h2>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #6b7280;">Jeune</td><td style="padding: 6px 0; font-weight: bold;">${htmlEscape(data.jeunePrenom)} ${htmlEscape(data.jeuneNom)}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Référent</td><td style="padding: 6px 0;">${htmlEscape(data.referentNom)}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Séjour</td><td style="padding: 6px 0;">${data.sejourSlug.replace(/-/g, ' ')}</td></tr>
              ${data.dossierRef ? `<tr><td style="padding: 6px 0; color: #6b7280;">Dossier</td><td style="padding: 6px 0; font-family: monospace;">${data.dossierRef}</td></tr>` : ''}
              <tr><td style="padding: 6px 0; color: #6b7280;">Montant</td><td style="padding: 6px 0; font-weight: bold; color: #16a34a;">${data.amount.toFixed(2)} €</td></tr>
            </table>
            <p style="margin-top: 16px;"><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.groupeetdecouverte.fr'}/admin/demandes" style="background: #2a383f; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">Voir dans l'admin</a></p>
          </div>
        </div>
      `,
  });
}

/**
 * Email de confirmation de paiement CB envoyé au référent client.
 * Distinct de sendInscriptionConfirmation (qui contient les instructions virement/chèque).
 * Appelé par le webhook Stripe après payment_intent.succeeded.
 */
export async function sendPaymentConfirmedClient(data: {
  referentEmail: string;
  referentNom: string;
  jeunePrenom: string;
  jeuneNom: string;
  sejourSlug: string;
  dossierRef: string;
  amount: number;
  suiviUrl?: string | null;
  paymentMethod?: string;
}): Promise<EmailResult> {
  // Guard spécifique — si le référent n'a pas d'email, inutile d'appeler Resend.
  if (!data.referentEmail) {
    console.warn('[EMAIL] sendPaymentConfirmedClient: referentEmail manquant');
    return { sent: false, reason: 'invalid_input' };
  }
  return await tryResendSend({
    from: FROM_EMAIL,
    to: data.referentEmail,
    subject: `Paiement reçu — Réf. ${data.dossierRef || 'votre inscription'}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #16a34a; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 22px;">Paiement reçu</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <p>Bonjour ${htmlEscape(data.referentNom)},</p>
            <p>Nous avons bien reçu votre paiement pour l'inscription de <strong>${htmlEscape(data.jeunePrenom)} ${htmlEscape(data.jeuneNom)}</strong>.</p>

            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Séjour</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${data.sejourSlug.replace(/-/g, ' ')}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Montant</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #16a34a;">${data.amount.toFixed(2)} €</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Méthode</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">Carte bancaire</td></tr>
              ${data.dossierRef ? `<tr><td style="padding: 8px; color: #6b7280;">Référence dossier</td><td style="padding: 8px; font-weight: bold; font-family: monospace;">${data.dossierRef}</td></tr>` : ''}
            </table>

            ${data.suiviUrl ? `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <h3 style="color: #166534; margin: 0 0 8px 0; font-size: 15px;">Suivi de votre dossier</h3>
              <p style="margin: 0 0 12px 0; color: #15803d; font-size: 14px;">Retrouvez à tout moment l'état de votre inscription :</p>
              <a href="${data.suiviUrl}" style="display: inline-block; background: #166534; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">Accéder au suivi</a>
            </div>
            ` : ''}

            <p style="color: #6b7280; font-size: 14px;">Votre inscription est désormais confirmée. Vous recevrez d'autres communications au fur et à mesure de l'organisation du séjour.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">Groupe &amp; Découverte — Séjours de vacances pour enfants et adolescents</p>
            <p style="font-size:11px;color:#6b7280;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px;">
              Securite :Les données collectées sont traitées conformément au RGPD et hébergées en Union européenne.
              Pour exercer vos droits : <a href="mailto:dpo@groupeetdecouverte.fr" style="color: #6b7280;">dpo@groupeetdecouverte.fr</a>
            </p>
          </div>
        </div>
      `,
  });
}

/**
 * Email de changement de statut d'inscription
 */
export async function sendStatusChangeEmail(
  referentEmail: string,
  referentNom: string,
  jeunePrenom: string,
  jeuneNom: string,
  newStatus: string
): Promise<EmailResult> {
  const statusLabels: Record<string, { label: string; color: string; message: string }> = {
    validee: { label: 'Validée', color: '#16a34a', message: 'Votre inscription a été validée. Le séjour est confirmé !' },
    refusee: { label: 'Refusée', color: '#dc2626', message: 'Votre inscription n\'a malheureusement pas pu être retenue. N\'hésitez pas à nous contacter pour plus d\'informations.' },
    annulee: { label: 'Annulée', color: '#de7356', message: 'Votre inscription a été annulée.' },
  };

  const statusInfo = statusLabels[newStatus];
  // Statut inconnu → input invalide, pas d'appel Resend.
  if (!statusInfo) return { sent: false, reason: 'invalid_input' };

  return await tryResendSend({
    from: FROM_EMAIL,
    to: referentEmail,
    subject: `Inscription ${statusInfo.label.toLowerCase()}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2a383f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Groupe &amp; Découverte</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: ${statusInfo.color};">Inscription ${statusInfo.label}</h2>
            <p>Bonjour ${htmlEscape(referentNom)},</p>
            <p>${statusInfo.message}</p>
            <p><strong>Jeune concerné :</strong> ${htmlEscape(jeunePrenom)} ${htmlEscape(jeuneNom)}</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">Groupe &amp; Découverte — Séjours de vacances pour enfants et adolescents</p>
            <p style="font-size:11px;color:#6b7280;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px;">
              Securite :Les données collectées sont traitées conformément au RGPD et hébergées en Union européenne.
              Elles sont accessibles uniquement aux personnes habilitées et conservées pour la durée strictement nécessaire.
              Pour exercer vos droits : <a href="mailto:dpo@groupeetdecouverte.fr" style="color: #6b7280;">dpo@groupeetdecouverte.fr</a>
            </p>
          </div>
        </div>
      `,
  });
}

// ============================================================
// Notification souhait kid → éducateur
// ============================================================

interface SouhaitEmailData {
  educateurEmail: string;
  educateurPrenom?: string;
  kidPrenom: string;
  sejourTitre: string;
  sejourImageUrl?: string;
  motivation: string;
  lienReponse: string;
  lienTousSouhaits?: string;
}

export async function sendSouhaitNotificationEducateur(data: SouhaitEmailData): Promise<EmailResult> {
  const prenom = data.educateurPrenom ? ` ${htmlEscape(data.educateurPrenom)}` : '';
  // P2.1 — image hero séjour si fournie ET URL validée (guard XSS attribut src)
  const imageBlock = isSafeImageUrl(data.sejourImageUrl)
    ? `<img src="${data.sejourImageUrl}" alt="${htmlEscape(data.sejourTitre)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;text-decoration:none;" />`
    : '';
  return await tryResendSend({
    from: FROM_EMAIL,
    to: data.educateurEmail,
    subject: `Nouveau souhait de séjour — ${htmlEscape(data.sejourTitre)}`,
    html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="background: #2a383f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 20px;">Groupe &amp; Découverte</h1>
          </div>
          ${imageBlock}
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #2a383f;">Un souhait de séjour à traiter</h2>
            <p>Bonjour${prenom},</p>
            <p><strong>${htmlEscape(data.kidPrenom)}</strong> a noté un souhait pour le séjour :</p>
            <div style="background: #f9fafb; border-left: 4px solid #de7356; padding: 16px; margin: 16px 0; border-radius: 4px;">
              <p style="margin: 0 0 8px; font-weight: bold; color: #2a383f;">${htmlEscape(data.sejourTitre)}</p>
              <p style="margin: 0; color: #4b5563; font-style: italic;">&laquo; ${htmlEscape(data.motivation)} &raquo;</p>
            </div>
            <p>Cliquez sur le bouton ci-dessous pour consulter ce souhait et y répondre :</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${data.lienReponse}"
                 style="display: inline-block; background: #de7356; color: white; padding: 14px 28px; border-radius: 9999px; text-decoration: none; font-weight: bold; font-size: 15px;">
                Voir le souhait et répondre
              </a>
            </div>
            ${data.lienTousSouhaits ? `
            <div style="text-align: center; margin: 8px 0 24px;">
              <a href="${data.lienTousSouhaits}"
                 style="color: #6b7280; font-size: 13px; text-decoration: underline;">
                Voir tous mes souhaits reçus
              </a>
            </div>
            ` : ''}
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>
              <span style="color: #6b7280;">${data.lienReponse}</span>
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">Groupe &amp; Découverte — Séjours de vacances pour enfants et adolescents</p>
            <p style="font-size:11px;color:#6b7280;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px;">
              Securite :Les données collectées sont traitées conformément au RGPD et hébergées en Union européenne.
              Elles sont accessibles uniquement aux personnes habilitées et conservées pour la durée strictement nécessaire.
              Pour exercer vos droits : <a href="mailto:dpo@groupeetdecouverte.fr" style="color: #6b7280;">dpo@groupeetdecouverte.fr</a>
            </p>
          </div>
        </div>
      `,
  });
}

/**
 * Notification admin GED — dossier enfant soumis complet
 * Envoyée lors du clic "Envoyer mon dossier" par le référent.
 * Inclut des liens directs vers les PDFs individuels (pas d'assemblage).
 */
export async function sendDossierGedAdminNotification(data: {
  referentNom: string;
  referentEmail: string;
  jeunePrenom: string;
  jeuneNom: string;
  dossierRef?: string;
  sejourSlug: string;
  sessionDate: string;
  inscriptionId: string;
  adminUrl: string;
}): Promise<EmailResult> {
  return await tryResendSend({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `Nouveau dossier reçu - Réf. ${data.dossierRef || 'en cours'}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #166534; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">Dossier enfant soumis</h2>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin-bottom: 16px;">
              <tr><td style="padding: 6px 0; color: #6b7280;">Jeune</td><td style="padding: 6px 0; font-weight: bold;">${htmlEscape(data.jeunePrenom)} ${htmlEscape(data.jeuneNom)}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Référent</td><td style="padding: 6px 0;">${htmlEscape(data.referentNom)} (${data.referentEmail})</td></tr>
              ${data.dossierRef ? `<tr><td style="padding: 6px 0; color: #6b7280;">N° dossier</td><td style="padding: 6px 0; font-family: monospace; font-weight: bold;">${data.dossierRef}</td></tr>` : ''}
              <tr><td style="padding: 6px 0; color: #6b7280;">Séjour</td><td style="padding: 6px 0;">${data.sejourSlug.replace(/-/g, ' ')}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Session</td><td style="padding: 6px 0;">${data.sessionDate}</td></tr>
            </table>
            <p style="font-size: 14px; margin: 0 0 12px 0;"><a href="${data.adminUrl}" style="background: #2a383f; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">Voir dans l'admin</a></p>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">Le dossier est complet et a été soumis par le référent.</p>
          </div>
        </div>
      `,
  });
}

/**
 * Email de rappel dossier incomplet — envoyé manuellement par l'admin
 * Guard : ne jamais appeler si ged_sent_at IS NOT NULL (vérification côté route)
 */
export async function sendRappelDossierIncomplet(data: {
  referentEmail: string;
  referentNom: string;
  dossierRef?: string;
  suiviToken: string;
}): Promise<EmailResult> {
  const suiviUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.groupeetdecouverte.fr'}/suivi/${data.suiviToken}`;
  const refLabel = data.dossierRef ? ` ${data.dossierRef}` : '';

  return await tryResendSend({
    from: FROM_EMAIL,
    to: data.referentEmail,
    subject: `Rappel - Votre dossier${refLabel} est incomplet`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2a383f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Groupe &amp; Découverte</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #b45309; margin-top: 0;">Dossier incomplet</h2>
            <p>Bonjour ${htmlEscape(data.referentNom)},</p>
            <p>Nous n'avons pas encore reçu votre dossier complet. Votre espace de suivi est toujours accessible.</p>
            ${data.dossierRef ? `<p>Référence du dossier : <strong style="font-family: monospace;">${data.dossierRef}</strong></p>` : ''}
            <div style="text-align: center; margin: 24px 0;">
              <a href="${suiviUrl}"
                 style="display: inline-block; background: #2a383f; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px;">
                Accéder à mon espace de suivi
              </a>
            </div>
            <p style="color: #6b7280; font-size: 13px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/><span style="color: #374151;">${suiviUrl}</span></p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 12px;">Ce lien est personnel et réservé à votre usage. Ne le partagez pas. Il reste valide pendant toute la durée du séjour.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">Groupe &amp; Découverte — Séjours de vacances pour enfants et adolescents</p>
            <p style="font-size:11px;color:#6b7280;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px;">
              Securite :Les données collectées sont traitées conformément au RGPD et hébergées en Union européenne.
              Elles sont accessibles uniquement aux personnes habilitées et conservées pour la durée strictement nécessaire.
              Pour exercer vos droits : <a href="mailto:dpo@groupeetdecouverte.fr" style="color: #6b7280;">dpo@groupeetdecouverte.fr</a>
            </p>
          </div>
        </div>
      `,
  });
}

/**
 * Notification admin GED — relance envoyée manuellement vers un référent
 * Appelée en fire-and-forget depuis la route POST /api/admin/inscriptions/[id]/relance
 */
export async function sendRelanceAdminNotification(data: {
  referentNom: string;
  referentEmail: string;
  structureNom?: string;
  dossierRef?: string;
  inscriptionId: string;
}): Promise<EmailResult> {
  const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.groupeetdecouverte.fr'}/admin/demandes/${data.inscriptionId}`;
  const dateRelance = new Date().toLocaleDateString('fr-FR');

  return await tryResendSend({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `[Relance envoyée] Dossier ${data.dossierRef || data.inscriptionId} — ${htmlEscape(data.referentNom)}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #b45309; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">Relance dossier incomplet envoyée</h2>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin-bottom: 16px;">
              <tr><td style="padding: 6px 0; color: #6b7280;">Référent</td><td style="padding: 6px 0; font-weight: bold;">${htmlEscape(data.referentNom)}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td style="padding: 6px 0;">${data.referentEmail}</td></tr>
              ${data.structureNom ? `<tr><td style="padding: 6px 0; color: #6b7280;">Structure</td><td style="padding: 6px 0;">${htmlEscape(data.structureNom)}</td></tr>` : ''}
              ${data.dossierRef ? `<tr><td style="padding: 6px 0; color: #6b7280;">Dossier</td><td style="padding: 6px 0; font-family: monospace; font-weight: bold;">${data.dossierRef}</td></tr>` : ''}
              <tr><td style="padding: 6px 0; color: #6b7280;">Date de relance</td><td style="padding: 6px 0;">${dateRelance}</td></tr>
            </table>
            <p style="font-size: 14px; margin: 0 0 12px 0;"><a href="${adminUrl}" style="background: #2a383f; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">Voir le dossier dans l'admin</a></p>
          </div>
        </div>
      `,
  });
}

/**
 * Email de complétude du dossier enfant envoyé au référent
 */
export async function sendDossierCompletEmail(data: {
  referentEmail: string;
  referentNom: string;
  jeunePrenom: string;
  jeuneNom: string;
  dossierRef?: string;
  /**
   * Copie carbone invisible — utilisée quand le staff structure (secrétariat,
   * direction, CDS) soumet le dossier en mode dépannage. Garde le référent
   * comme destinataire principal, mais donne au staff une preuve d'envoi.
   */
  bcc?: string;
}): Promise<EmailResult> {
  const shouldBcc = data.bcc && data.bcc !== data.referentEmail;
  return await tryResendSend({
    from: FROM_EMAIL,
    to: data.referentEmail,
    ...(shouldBcc ? { bcc: data.bcc as string } : {}),
    subject: `Dossier complété - Réf. ${data.dossierRef || 'en cours'}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2a383f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Groupe &amp; Découverte</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
              <h2 style="color: #166534; margin: 0 0 8px 0; font-size: 18px;">Dossier complet</h2>
              <p style="margin: 0; color: #15803d; font-size: 14px;">Tous les documents ont bien été reçus.</p>
            </div>
            <p>Bonjour ${htmlEscape(data.referentNom)},</p>
            <p>Le dossier de <strong>${htmlEscape(data.jeunePrenom)} ${htmlEscape(data.jeuneNom)}</strong> est désormais complet. Nous avons bien reçu l'ensemble des documents requis (bulletin complémentaire, fiche sanitaire, fiche de liaison et pièces jointes).</p>
            ${data.dossierRef ? `<p>Référence du dossier : <strong style="font-family: monospace;">${data.dossierRef}</strong></p>` : ''}
            <p>Notre équipe procédera à la vérification des documents et vous contactera si nécessaire.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">Groupe &amp; Découverte — Séjours de vacances pour enfants et adolescents</p>
            <p style="font-size:11px;color:#6b7280;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px;">
              Securite :Les données collectées sont traitées conformément au RGPD et hébergées en Union européenne.
              Elles sont accessibles uniquement aux personnes habilitées et conservées pour la durée strictement nécessaire.
              Pour exercer vos droits : <a href="mailto:dpo@groupeetdecouverte.fr" style="color: #6b7280;">dpo@groupeetdecouverte.fr</a>
            </p>
          </div>
        </div>
      `,
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Email — Code structure (Phase 1 espace structure)
// ═══════════════════════════════════════════════════════════════════════

interface StructureCodeEmailData {
  recipientEmail: string;
  structureName: string;
  structureCode: string;
  educateurPrenom: string;
}

// ── Alerte nouvel éducateur détecté sur même CP ──────────────────────────

interface NewEducateurAlertData {
  adminEmail?: string;
  existingStructures: Array<{ name: string; code: string; city: string }>;
  newEducateurNom: string;
  newEducateurEmail: string;
  structureDeclaredName: string;
  postalCode: string;
}

export async function sendNewEducateurAlert(data: NewEducateurAlertData): Promise<EmailResult> {
  const structList = data.existingStructures
    .map(s => `<li><strong>${s.name}</strong> (${s.city}) — code : <code>${s.code}</code></li>`)
    .join('');

  return await tryResendSend({
    from: FROM_EMAIL,
    to: data.adminEmail || ADMIN_EMAIL,
    subject: `[Structure] Nouvel éducateur détecté — ${data.postalCode} — ${data.structureDeclaredName}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #D4AC0D; color: #333; padding: 16px 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">Attention :Nouvel éducateur sans code structure</h2>
          </div>
          <div style="padding: 24px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
            <p><strong>${data.newEducateurNom}</strong> (${data.newEducateurEmail}) vient d'inscrire un enfant pour la structure "<strong>${data.structureDeclaredName}</strong>" (CP ${data.postalCode}).</p>
            <p>Il existe déjà ${data.existingStructures.length > 1 ? 'des structures' : 'une structure'} enregistrée(s) sur ce code postal :</p>
            <ul>${structList}</ul>
            <p style="margin-top: 16px;">Actions possibles :</p>
            <ul>
              <li>Si c'est la même structure → transmettre le code à l'éducateur ou rattacher manuellement dans l'admin</li>
              <li>Si c'est une structure différente → aucune action, une nouvelle structure a été créée</li>
            </ul>
            <p style="color: #666; font-size: 13px; margin-top: 24px;">Email automatique — Groupe & Découverte</p>
          </div>
        </div>
      `,
  });
}

export async function sendStructureCodeEmail(data: StructureCodeEmailData): Promise<EmailResult> {
  return await tryResendSend({
    from: FROM_EMAIL,
    to: data.recipientEmail,
    subject: `Votre code structure Groupe & Découverte : ${data.structureCode}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1A5276; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 22px;">Groupe & Découverte</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
            <p>Bonjour,</p>
            <p>La structure <strong>${htmlEscape(data.structureName)}</strong> est désormais enregistrée sur Groupe & Découverte.</p>
            <div style="background: #1A5276; color: white; text-align: center; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 5px 0; font-size: 14px;">Votre code structure</p>
              <p style="margin: 0; font-size: 32px; font-weight: bold; letter-spacing: 4px;">${data.structureCode}</p>
            </div>
            <p><strong>Transmettez ce code à vos collègues</strong> pour regrouper les inscriptions de votre structure. Ils pourront le saisir lors de leur prochaine inscription ou depuis leur espace de suivi.</p>
            <p style="color: #666; font-size: 13px; margin-top: 30px;">Cet email a été envoyé suite à l'inscription réalisée par ${htmlEscape(data.educateurPrenom)}. Si vous n'êtes pas concerné(e), vous pouvez ignorer ce message.</p>
          </div>
        </div>
      `,
  });
}

// ─── Demande de tarifs sans compte ──────────────────────────────────────────

interface PriceInquiryData {
  prenom: string;
  structureName: string;
  email: string;
  sejourTitle: string;
  sejourSlug: string;
  prixFrom?: number | null;
}

/**
 * Email à l'éducateur avec indication tarifaire et CTA contact
 */
export async function sendPriceInquiryToEducateur(data: PriceInquiryData): Promise<EmailResult> {
  const prixSection = data.prixFrom
    ? `<div style="background: #eaf4ec; border-left: 4px solid #2d8a4e; padding: 14px 18px; border-radius: 0 6px 6px 0; margin: 20px 0;">
         <p style="margin: 0; font-size: 15px; color: #1a5e35;"><strong>À partir de ${data.prixFrom}&nbsp;€</strong> par enfant</p>
       </div>`
    : `<div style="background: #f5f5f5; border-left: 4px solid #888; padding: 14px 18px; border-radius: 0 6px 6px 0; margin: 20px 0;">
         <p style="margin: 0; font-size: 15px; color: #555;">Tarif sur devis selon votre structure</p>
       </div>`;

  return await tryResendSend({
    from: FROM_EMAIL,
    to: data.email,
    subject: `Tarifs — ${htmlEscape(data.sejourTitle)}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #2a383f; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 22px;">Groupe &amp; Découverte</h1>
          </div>
          <div style="padding: 30px 28px; background: #fafafa; border-radius: 0 0 8px 8px;">
            <p>Bonjour ${htmlEscape(data.prenom)},</p>
            <p>Merci pour votre intérêt pour le séjour <strong>${htmlEscape(data.sejourTitle)}</strong>.</p>
            <p>Voici l'information tarifaire pour votre structure :</p>
            ${prixSection}
            <p style="color: #444;">Ces tarifs sont adaptés selon votre type de structure (ASE, MECS, foyer). Accédez à l'espace professionnel pour inscrire un enfant sur ce séjour.</p>
            <div style="text-align:center;margin:24px 0">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.groupeetdecouverte.fr'}/acceder-pro?sejour=${data.sejourSlug}"
                 style="display:inline-block;background:#1d4ed8;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
                Inscrire un enfant sur ce séjour →
              </a>
            </div>
            <p style="font-size:13px;color:#6b7280;text-align:center;margin:0">
              Votre demande d'accès sera traitée sous 24h ouvrées.<br>
              En cas d'urgence : <a href="tel:0423161671" style="color:#1d4ed8">04 23 16 16 71</a>
            </p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px; margin: 0;">Groupe &amp; Découverte — Séjours éducatifs pour enfants ASE<br>
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.groupeetdecouverte.fr'}" style="color: #999;">app.groupeetdecouverte.fr</a></p>
          </div>
        </div>
      `,
  });
}

/**
 * Notification interne GED — warm lead demande tarif sans compte
 */
export async function sendPriceInquiryAlertGED(data: PriceInquiryData): Promise<EmailResult> {
  const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

  return await tryResendSend({
    from: 'contact@groupeetdecouverte.fr',
    to: 'contact@groupeetdecouverte.fr',
    subject: `[Lead] Demande tarif — ${htmlEscape(data.structureName)} — ${htmlEscape(data.sejourTitle)}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #D4AC0D; color: #333; padding: 16px 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">Nouvelle demande de tarif (sans compte)</h2>
          </div>
          <div style="padding: 24px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr><td style="padding: 6px 0; color: #666; width: 140px;">Prénom</td><td><strong>${htmlEscape(data.prenom)}</strong></td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Structure</td><td><strong>${htmlEscape(data.structureName)}</strong></td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Email</td><td><a href="mailto:${data.email}">${data.email}</a></td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Séjour</td><td>${htmlEscape(data.sejourTitle)} (<code>${data.sejourSlug}</code>)</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Date</td><td>${now}</td></tr>
            </table>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">Email automatique — Groupe &amp; Découverte</p>
          </div>
        </div>
      `,
  });
}

// ─── Invitation chef de service ──────────────────────────────────────────────

/**
 * Invitation chef de service — accès au tableau de bord structure
 * Envoyé lors d'un import administratif de dossiers pré-validés.
 */
export async function sendChefDeServiceInvitation(data: {
  recipientEmail: string;
  structureName: string;
  structureCode: string;
  structureUrl: string;
  nbDossiers?: number;
}): Promise<EmailResult> {
  return await tryResendSend({
    from: FROM_EMAIL,
    to: data.recipientEmail,
    subject: `Accès à votre tableau de bord structure — Groupe & Découverte`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1A5276; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 22px;">Groupe &amp; Découverte</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
            <p>Bonjour,</p>
            <p>Les dossiers de la structure <strong>${htmlEscape(data.structureName)}</strong> ont été intégrés dans notre plateforme.</p>
            ${data.nbDossiers ? `<p>Nombre de dossiers : <strong>${data.nbDossiers}</strong></p>` : ''}
            <p>En tant que responsable, vous pouvez suivre l'ensemble des dossiers depuis votre tableau de bord :</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.structureUrl}"
                 style="background: #1A5276; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                Accéder au tableau de bord
              </a>
            </div>
            <p style="color: #555; font-size: 13px;">Lien direct : <a href="${data.structureUrl}">${data.structureUrl}</a></p>
            <div style="background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 16px; margin-top: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #666;">Code structure (à transmettre aux éducateurs) :</p>
              <p style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1A5276; text-align: center;">${data.structureCode}</p>
            </div>
            <p style="color: #888; font-size: 12px; margin-top: 24px;">
              Les éducateurs de votre structure accèdent à leurs dossiers via leur lien de suivi personnel.<br>
              Vous seul(e) voyez l'ensemble des dossiers via ce tableau de bord.
            </p>
          </div>
        </div>
      `,
  });
}

// ============================================================
// Demande d'accès professionnel
// ============================================================

interface ProAccessRequestData {
  prenom: string;
  nom: string;
  structureName: string;
  structureType: string;
  email: string;
  phone?: string;
  sejourSlug?: string;
}

/**
 * Confirmation à l'éducateur qui demande son accès pro
 */
export async function sendProAccessConfirmation(data: ProAccessRequestData): Promise<EmailResult> {
  const sejourBlock = data.sejourSlug
    ? `<p>Vous pourrez ensuite inscrire un enfant sur le séjour demandé directement depuis votre espace professionnel.</p>`
    : '';

  return await tryResendSend({
    from: FROM_EMAIL,
    to: data.email,
    subject: 'Votre demande d\'accès professionnel — Groupe & Découverte',
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2a383f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Groupe &amp; Découverte</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #2a383f;">Demande bien reçue !</h2>
            <p>Bonjour ${htmlEscape(data.prenom)},</p>
            <p>Votre demande d'accès professionnel a bien été reçue.</p>
            <p>Notre équipe crée votre compte et vous envoie vos identifiants sous <strong>24h ouvrées</strong>.</p>
            ${sejourBlock}
            <div style="background: #f9fafb; border-left: 4px solid #2a383f; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #4b5563;">
                En cas d'urgence, notre équipe est joignable au
                <strong><a href="tel:0423161671" style="color: #2a383f; text-decoration: none;">04 23 16 16 71</a></strong>
                (lun.–ven. 9h–17h).
              </p>
            </div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">Groupe &amp; Découverte — Séjours éducatifs pour enfants et adolescents</p>
            <p style="font-size: 11px; color: #6b7280; margin-top: 12px; border-top: 1px solid #e5e7eb; padding-top: 12px;">
              Vos données sont utilisées uniquement pour créer votre accès professionnel.
              Pour exercer vos droits RGPD : <a href="mailto:dpo@groupeetdecouverte.fr" style="color: #6b7280;">dpo@groupeetdecouverte.fr</a>
            </p>
          </div>
        </div>
      `,
  });
}

/**
 * Alerte interne GED — nouvelle demande d'accès pro
 */
export async function sendProAccessAlertGED(data: ProAccessRequestData): Promise<EmailResult> {
  const sejourRow = data.sejourSlug
    ? `<tr><td style="padding: 6px 12px; color: #6b7280;">Séjour demandé</td><td style="padding: 6px 12px; font-weight: 500;">${data.sejourSlug}</td></tr>`
    : '';

  const phoneRow = data.phone
    ? `<tr><td style="padding: 6px 12px; color: #6b7280;">Téléphone</td><td style="padding: 6px 12px;">${data.phone}</td></tr>`
    : '';

  return await tryResendSend({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `[Accès pro] Nouvelle demande — ${htmlEscape(data.structureName)}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2a383f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 20px;">Nouvelle demande d'accès professionnel</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tbody>
                <tr style="background: #f9fafb;">
                  <td style="padding: 6px 12px; color: #6b7280;">Nom</td>
                  <td style="padding: 6px 12px; font-weight: 500;">${htmlEscape(data.prenom)} ${htmlEscape(data.nom)}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 12px; color: #6b7280;">Structure</td>
                  <td style="padding: 6px 12px;">${htmlEscape(data.structureName)}</td>
                </tr>
                <tr style="background: #f9fafb;">
                  <td style="padding: 6px 12px; color: #6b7280;">Type</td>
                  <td style="padding: 6px 12px;">${data.structureType}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 12px; color: #6b7280;">Email</td>
                  <td style="padding: 6px 12px;"><a href="mailto:${data.email}" style="color: #2a383f;">${data.email}</a></td>
                </tr>
                ${phoneRow}
                ${sejourRow}
              </tbody>
            </table>
            <div style="margin-top: 24px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.groupeetdecouverte.fr'}/admin"
                 style="display: inline-block; background: #2a383f; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
                Créer le compte → /admin
              </a>
            </div>
          </div>
        </div>
      `,
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Invitation urgence éducateur — email perso
// ═══════════════════════════════════════════════════════════════════════

/**
 * Email d'invitation urgence — lien d'inscription valable 24h
 * Envoyé à l'éducateur qui n'a pas de compte GED (parcours email perso)
 */
export async function sendEducatorInviteEmail(
  email: string,
  inviteUrl: string,
  sejourTitle: string,
  sessionDate: string,
  cityDeparture: string
): Promise<EmailResult> {
  const dateFormatted = sessionDate
    ? new Date(sessionDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  return await tryResendSend({
    from: FROM_EMAIL,
    to: email,
    subject: `Inscription urgence — ${htmlEscape(sejourTitle)} — Groupe & Découverte`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2a383f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Groupe &amp; Découverte</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #2a383f; margin-top: 0;">Lien d'inscription urgence</h2>
            <p>Vous avez reçu un lien pour inscrire un enfant en urgence sur le séjour suivant :</p>
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0; font-weight: bold; color: #2a383f; font-size: 16px;">${htmlEscape(sejourTitle)}</p>
              <p style="margin: 6px 0 0; color: #6b7280; font-size: 14px;">Départ : ${htmlEscape(dateFormatted)} depuis ${htmlEscape(cityDeparture)}</p>
            </div>
            <p>Ce lien est valable <strong>24 heures</strong>. Passé ce délai, il ne fonctionnera plus.</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${inviteUrl}"
                 style="display: inline-block; background: #de7356; color: white; padding: 14px 28px; border-radius: 9999px; text-decoration: none; font-weight: bold; font-size: 15px;">
                Accéder au formulaire d'inscription
              </a>
            </div>
            <p style="color: #6b7280; font-size: 13px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>
              <span style="color: #374151;">${inviteUrl}</span>
            </p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 12px;">Ce lien est personnel et à usage unique. Ne le partagez pas.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">Groupe &amp; Découverte — Séjours éducatifs pour enfants et adolescents</p>
            <p style="font-size:11px;color:#6b7280;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px;">
              Les données collectées sont traitées conformément au RGPD et hébergées en Union européenne.
              Pour exercer vos droits : <a href="mailto:dpo@groupeetdecouverte.fr" style="color: #6b7280;">dpo@groupeetdecouverte.fr</a>
            </p>
          </div>
        </div>
      `,
  });
}

/**
 * Notification admin — inscription urgence reçue, en attente de validation GED
 */
export async function sendAdminUrgenceNotification(data: {
  jeunePrenom: string;
  jeuneNom: string;
  referentEmail: string;
  sejourTitle: string;
  sessionDate: string;
  cityDeparture: string;
  dossierRef: string;
  priceTotal: number;
}): Promise<EmailResult> {
  const dateFormatted = data.sessionDate
    ? new Date(data.sessionDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : data.sessionDate;

  return await tryResendSend({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `⚡ URGENCE — ${htmlEscape(data.jeunePrenom)} ${htmlEscape(data.jeuneNom)} — À valider`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 20px;">⚡ Inscription urgence reçue — À valider</h1>
          </div>
          <div style="border: 1px solid #fca5a5; border-top: none; padding: 24px; border-radius: 0 0 8px 8px; background: #fff7f7;">
            <ul style="line-height: 2;">
              <li><strong>Enfant :</strong> ${htmlEscape(data.jeunePrenom)} ${htmlEscape(data.jeuneNom)}</li>
              <li><strong>Référent :</strong> ${htmlEscape(data.referentEmail)}</li>
              <li><strong>Séjour :</strong> ${htmlEscape(data.sejourTitle)}</li>
              <li><strong>Départ :</strong> ${htmlEscape(dateFormatted)} depuis ${htmlEscape(data.cityDeparture)}</li>
              <li><strong>Montant :</strong> ${data.priceTotal.toFixed(2)} €</li>
              <li><strong>Dossier :</strong> <code>${htmlEscape(data.dossierRef)}</code></li>
            </ul>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.groupeetdecouverte.fr'}/admin/demandes"
                 style="display: inline-block; background: #2a383f; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                Voir dans l'admin
              </a>
            </div>
          </div>
        </div>
      `,
  });
}

/**
 * Notification incident séjour → éducateurs de la structure
 * Envoyé uniquement si gravité >= "attention"
 */
interface IncidentNotificationData {
  structureName: string;
  jeunePrenom: string;
  category: string;
  severity: string;
  description: string;
  createdBy: string;
}

const SEVERITY_LABELS: Record<string, string> = {
  info: 'Information',
  attention: 'Attention',
  urgent: 'Urgent',
};

const CATEGORY_LABELS: Record<string, string> = {
  medical: 'Médical',
  comportemental: 'Comportemental',
  fugue: 'Fugue',
  accident: 'Accident',
  autre: 'Autre',
};

export async function sendIncidentNotification(
  emails: string[],
  data: IncidentNotificationData
): Promise<EmailResult> {
  // Guard spécifique — destinataires vides = rien à envoyer (pas un échec provider).
  if (emails.length === 0) return { sent: false, reason: 'invalid_input' };

  const severityColor = data.severity === 'urgent' ? '#dc2626' : '#f59e0b';
  const severityLabel = SEVERITY_LABELS[data.severity] || data.severity;
  const categoryLabel = CATEGORY_LABELS[data.category] || data.category;

  return await tryResendSend({
    from: FROM_EMAIL,
    to: emails,
    subject: `[${severityLabel}] Incident ${categoryLabel} — ${htmlEscape(data.structureName)}`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${severityColor}; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">${severityLabel} — Incident signalé</h2>
          </div>
          <div style="padding: 24px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
              <tr><td style="padding: 6px 0; color: #6b7280; width: 120px;">Enfant</td><td style="padding: 6px 0; font-weight: 600;">${htmlEscape(data.jeunePrenom)}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Structure</td><td style="padding: 6px 0;">${htmlEscape(data.structureName)}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Type</td><td style="padding: 6px 0;">${categoryLabel}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Gravité</td><td style="padding: 6px 0; font-weight: 600; color: ${severityColor};">${severityLabel}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Signalé par</td><td style="padding: 6px 0;">${htmlEscape(data.createdBy)}</td></tr>
            </table>
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <p style="margin: 0; color: #374151;">${htmlEscape(data.description)}</p>
            </div>
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">Cet email est envoyé automatiquement par Groupe & Découverte. Ne pas répondre.</p>
          </div>
        </div>
      `,
  });
}

// ── Proposition tarifaire : alerte admin (nouvelle demande) ──
export async function sendPropositionAlertGED(data: {
  demandeurNom: string;
  demandeurEmail: string;
  sejourTitre: string;
  sessionDate: string;
  villeDepart: string;
  propositionId: string;
}): Promise<EmailResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.groupeetdecouverte.fr';

  return await tryResendSend({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `[GED] Nouvelle demande de proposition — ${htmlEscape(data.sejourTitre)}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#2a383f;color:white;padding:20px;border-radius:8px 8px 0 0">
          <h1 style="margin:0;font-size:18px">Nouvelle demande de proposition tarifaire</h1>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
          <p><strong>Demandeur :</strong> ${htmlEscape(data.demandeurNom)} (${htmlEscape(data.demandeurEmail)})</p>
          <p><strong>Séjour :</strong> ${htmlEscape(data.sejourTitre)}</p>
          <p><strong>Session :</strong> ${htmlEscape(data.sessionDate)} — ${htmlEscape(data.villeDepart)}</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${appUrl}/admin/propositions"
               style="background:#de7356;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">
              Traiter la demande
            </a>
          </div>
        </div>
      </div>`,
  });
}

// ── Proposition tarifaire : envoi PDF au travailleur social ──
export async function sendPropositionEmail(data: {
  to: string;
  destinataireNom: string;
  sejourTitre: string;
  dossierRef: string;
  pdfBuffer: Uint8Array;
}): Promise<EmailResult> {
  return await tryResendSend({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Votre proposition tarifaire — ${htmlEscape(data.sejourTitre)}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#2a383f;color:white;padding:20px;border-radius:8px 8px 0 0">
          <h1 style="margin:0;font-size:18px">Groupe &amp; Découverte</h1>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
          <p>Bonjour ${htmlEscape(data.destinataireNom)},</p>
          <p>Veuillez trouver ci-joint votre proposition tarifaire pour le séjour
             <strong>${htmlEscape(data.sejourTitre)}</strong>.</p>
          <p>Référence : <strong>${htmlEscape(data.dossierRef)}</strong></p>
          <p>Pour toute question : 04 23 16 16 71 · contact@groupeetdecouverte.fr</p>
        </div>
      </div>`,
    attachments: [{
      filename: `proposition-${data.dossierRef}.pdf`,
      content: Buffer.from(data.pdfBuffer).toString('base64'),
    }],
  });
}

interface TeamInviteData {
  to: string;
  prenom: string;
  structureName: string;
  role: 'secretariat' | 'educateur';
  activationUrl: string;
  invitedBy: string;
}

export async function sendTeamMemberInvite(data: TeamInviteData): Promise<EmailResult> {
  const roleLabel = data.role === 'secretariat' ? 'Secrétariat' : 'Éducateur';

  return await tryResendSend({
    from: FROM_EMAIL,
    to: data.to,
    subject: `Invitation ${data.structureName} — activation de votre accès`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2a383f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Groupe &amp; Découverte</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #2a383f; margin-top: 0;">Bonjour ${htmlEscape(data.prenom)},</h2>
            <p>La direction de <strong>${htmlEscape(data.structureName)}</strong> vous invite à créer votre accès personnel pour le rôle <strong>${roleLabel}</strong>.</p>
            <p>Cliquez sur le bouton ci-dessous pour définir votre mot de passe :</p>
            <p style="text-align: center; margin: 24px 0;">
              <a href="${data.activationUrl}" style="background: #de7356; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Activer mon accès</a>
            </p>
            <p style="color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
              <strong>Ce lien est strictement personnel.</strong> Ne le transmettez à personne, même en cas d'absence.
              En cas d'empêchement, contactez la direction pour qu'une délégation ou réinvitation soit mise en place.
            </p>
            <p style="color: #9ca3af; font-size: 12px;">
              Lien envoyé par ${htmlEscape(data.invitedBy)} · valable 48h · usage unique
            </p>
          </div>
        </div>
      `,
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Email — Archivage structure (post-soumission GED)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Email institutionnel envoyé à l'adresse de contact de la structure
 * (gd_structures.email — secrétariat / direction) dès qu'un dossier enfant
 * a été soumis avec succès à la GED.
 *
 * Objectif métier : permettre à la structure d'alimenter ses propres
 * registres officiels ASE en téléchargeant le récapitulatif PDF du dossier
 * (bulletin pré-rempli signé). Aucune donnée Art.9 dans le corps de l'email
 * — uniquement nom/prénom + référence + lien sécurisé.
 *
 * Fire-and-forget : l'échec d'envoi NE BLOQUE PAS la réponse de la route
 * /submit. La route appelante doit utiliser .catch() ou Promise.allSettled.
 */
export async function sendStructureArchivageEmail(data: {
  structureEmail: string;
  jeunePrenom: string;
  jeuneNom: string;
  dossierRef?: string;
  /**
   * URL absolue de téléchargement du PDF (bulletin pré-rempli).
   * Pour le mode référent : inclut le suivi_token en query string.
   * Pour le mode staff : route /api/structure/[code]/inscriptions/[id]/pdf
   * (auth session cookie — le destinataire doit être connecté).
   */
  pdfLink: string;
}): Promise<EmailResult> {
  // Guard spécifique — pas d'email destinataire = rien à envoyer.
  if (!data.structureEmail) {
    console.warn('[EMAIL] structureEmail manquant — archivage structure non envoyé');
    return { sent: false, reason: 'invalid_input' };
  }
  const refLine = data.dossierRef ? ` (réf. ${data.dossierRef})` : '';
  const fullName = `${data.jeunePrenom} ${data.jeuneNom}`;
  const subject = `Dossier ${fullName}${refLine} — récapitulatif PDF disponible pour archivage`;

  const text = [
    `Madame, Monsieur,`,
    ``,
    `Le dossier de ${fullName}${refLine} a été transmis à l'équipe Groupe & Découverte.`,
    ``,
    `Pour vos registres internes (archivage ASE), vous pouvez télécharger le récapitulatif PDF du dossier à l'adresse suivante :`,
    data.pdfLink,
    ``,
    `Ce document reprend le bulletin d'inscription pré-rempli avec les informations transmises. Aucune donnée médicale n'est incluse dans cet email.`,
    ``,
    `Conservation conforme RGPD : 3 mois après le séjour côté Groupe & Découverte. Côté structure, votre durée de conservation suit votre propre politique d'archivage.`,
    ``,
    `Cet envoi est automatique. Pour toute question : contact@groupeetdecouverte.fr`,
    ``,
    `Groupe & Découverte`,
  ].join('\n');

  return await tryResendSend({
    from: FROM_EMAIL,
    to: data.structureEmail,
    subject,
    text,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #2a383f;">
          <div style="background: #2a383f; color: white; padding: 18px 22px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 600;">Groupe &amp; Découverte</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <p style="margin: 0 0 14px 0;">Madame, Monsieur,</p>
            <p style="margin: 0 0 14px 0;">
              Le dossier de <strong>${htmlEscape(fullName)}</strong>${data.dossierRef ? ` (réf. <span style="font-family: monospace;">${htmlEscape(data.dossierRef)}</span>)` : ''}
              a été transmis à l'équipe Groupe &amp; Découverte.
            </p>
            <p style="margin: 0 0 14px 0;">
              Pour vos registres internes (archivage ASE), vous pouvez télécharger le récapitulatif PDF du dossier :
            </p>
            <p style="margin: 18px 0;">
              <a href="${data.pdfLink}"
                 style="display: inline-block; background: #de7356; color: white; padding: 11px 22px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                Télécharger le récapitulatif PDF
              </a>
            </p>
            <p style="margin: 0 0 14px 0; color: #4b5563; font-size: 13px;">
              Ce document reprend le bulletin d'inscription pré-rempli avec les informations transmises.
              Aucune donnée médicale n'est incluse dans cet email.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">
              Conservation conforme RGPD : 3 mois après le séjour côté Groupe &amp; Découverte.
              Côté structure, votre durée de conservation suit votre propre politique d'archivage.
            </p>
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
              Cet envoi est automatique. Pour toute question :
              <a href="mailto:contact@groupeetdecouverte.fr" style="color: #6b7280;">contact@groupeetdecouverte.fr</a>
            </p>
          </div>
        </div>
      `,
  });
}
