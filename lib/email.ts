import { Resend } from 'resend';

// Lazy singleton — prevents top-level crash when EMAIL_SERVICE_API_KEY is absent at build time.
let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.EMAIL_SERVICE_API_KEY);
  return _resend;
}

// Domaine groupeetdecouverte.fr vérifié sur Resend
const FROM_EMAIL = 'Groupe & Découverte <noreply@groupeetdecouverte.fr>';
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@groupeetdecouverte.fr';

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
}

/**
 * Email de confirmation d'inscription envoyé au référent
 */
export async function sendInscriptionConfirmation(data: InscriptionEmailData) {
  if (!process.env.EMAIL_SERVICE_API_KEY || process.env.EMAIL_SERVICE_API_KEY === 'YOUR_EMAIL_API_KEY_HERE') {
    console.warn('[EMAIL] Clé API manquante — email non envoyé');
    return null;
  }

  try {
    console.log('[EMAIL] Envoi confirmation vers:', data.referentEmail, 'depuis:', FROM_EMAIL);
    const result = await getResend().emails.send({
      from: FROM_EMAIL,
      to: data.referentEmail,
      subject: `Confirmation d'inscription - ${data.jeunePrenom} ${data.jeuneNom}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2a383f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Groupe &amp; Découverte</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #2a383f; margin-top: 0;">Inscription enregistrée</h2>
            <p>Bonjour ${data.referentNom},</p>
            <p>L'inscription de <strong>${data.jeunePrenom} ${data.jeuneNom}</strong> a bien été enregistrée.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Séjour</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${data.sejourSlug.replace(/-/g, ' ')}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Session</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.sessionDate}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Départ</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.cityDeparture.replace(/_/g, ' ')}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Montant</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${data.priceTotal.toFixed(2)} €</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Mode de paiement</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${data.paymentMethod === 'bank_transfer' ? 'Virement bancaire' : data.paymentMethod === 'cheque' ? 'Chèque' : 'Carte bancaire'}</td></tr>
              ${data.paymentReference ? `<tr><td style="padding: 8px; color: #6b7280;">Référence</td><td style="padding: 8px; font-weight: bold;">${data.paymentReference}</td></tr>` : ''}
            </table>

            ${data.paymentMethod === 'bank_transfer' ? `
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <h3 style="color: #1e40af; margin: 0 0 8px 0; font-size: 15px;">Instructions de virement bancaire</h3>
              <p style="margin: 0 0 8px 0; color: #1e3a8a; font-size: 14px;">Merci d'effectuer le virement en mentionnant votre référence <strong>${data.paymentReference || ''}</strong> en libellé.</p>
              <table style="font-size: 13px; color: #1e3a8a;">
                <tr><td style="padding: 2px 8px 2px 0; color: #6b7280;">Titulaire</td><td><strong>Groupe &amp; Découverte</strong></td></tr>
                <tr><td style="padding: 2px 8px 2px 0; color: #6b7280;">IBAN</td><td><strong>FR76 XXXX XXXX XXXX XXXX XXXX XXX</strong></td></tr>
                <tr><td style="padding: 2px 8px 2px 0; color: #6b7280;">BIC</td><td><strong>XXXXXXXXX</strong></td></tr>
                <tr><td style="padding: 2px 8px 2px 0; color: #6b7280;">Libellé</td><td><strong>${data.paymentReference || data.jeunePrenom}</strong></td></tr>
              </table>
              <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 12px;">⚠️ Votre inscription sera validée à réception du règlement.</p>
            </div>
            ` : ''}

            ${data.paymentMethod === 'cheque' ? `
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <h3 style="color: #92400e; margin: 0 0 8px 0; font-size: 15px;">Instructions chèque</h3>
              <p style="margin: 0 0 8px 0; color: #78350f; font-size: 14px;">Merci d'adresser votre chèque à l'ordre de <strong>Groupe &amp; Découverte</strong>, en inscrivant la référence <strong>${data.paymentReference || ''}</strong> au dos.</p>
              <table style="font-size: 13px; color: #78350f;">
                <tr><td style="padding: 2px 8px 2px 0; color: #6b7280;">À l'ordre de</td><td><strong>Groupe &amp; Découverte</strong></td></tr>
                <tr><td style="padding: 2px 8px 2px 0; color: #6b7280;">Adresse</td><td><strong>Groupe &amp; Découverte — [ADRESSE À COMPLÉTER]</strong></td></tr>
                <tr><td style="padding: 2px 8px 2px 0; color: #6b7280;">Référence au dos</td><td><strong>${data.paymentReference || data.jeunePrenom}</strong></td></tr>
              </table>
              <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 12px;">⚠️ Votre inscription sera validée à réception du chèque.</p>
            </div>
            ` : ''}

            <p style="color: #6b7280; font-size: 14px;">Votre inscription est en attente de validation. Vous recevrez un email de confirmation une fois le paiement reçu et validé.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">Groupe &amp; Découverte — Séjours de vacances pour enfants et adolescents</p>
          </div>
        </div>
      `,
    });
    console.log('[EMAIL] Résultat envoi confirmation:', JSON.stringify(result));
    return result;
  } catch (error) {
    console.error('[EMAIL] Erreur envoi confirmation:', error);
    return null;
  }
}

/**
 * Notification admin pour nouvelle inscription
 */
export async function sendAdminNewInscriptionNotification(data: InscriptionEmailData) {
  if (!process.env.EMAIL_SERVICE_API_KEY || process.env.EMAIL_SERVICE_API_KEY === 'YOUR_EMAIL_API_KEY_HERE') {
    return null;
  }

  try {
    const result = await getResend().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `Nouvelle inscription - ${data.jeunePrenom} ${data.jeuneNom}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2a383f;">Nouvelle inscription reçue</h2>
          <ul>
            <li><strong>Jeune :</strong> ${data.jeunePrenom} ${data.jeuneNom}</li>
            <li><strong>Référent :</strong> ${data.referentNom} (${data.referentEmail})</li>
            <li><strong>Séjour :</strong> ${data.sejourSlug}</li>
            <li><strong>Session :</strong> ${data.sessionDate}</li>
            <li><strong>Départ :</strong> ${data.cityDeparture}</li>
            <li><strong>Montant :</strong> ${data.priceTotal.toFixed(2)} €</li>
            ${data.paymentMethod ? `<li><strong>Paiement :</strong> ${data.paymentMethod}</li>` : ''}
          </ul>
          <p><a href="https://app.groupeetdecouverte.fr/admin/demandes" style="background: #2a383f; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Voir dans l'admin</a></p>
        </div>
      `,
    });
    return result;
  } catch (error) {
    console.error('[EMAIL] Erreur envoi notification admin:', error);
    return null;
  }
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
) {
  if (!process.env.EMAIL_SERVICE_API_KEY || process.env.EMAIL_SERVICE_API_KEY === 'YOUR_EMAIL_API_KEY_HERE') {
    return null;
  }

  const statusLabels: Record<string, { label: string; color: string; message: string }> = {
    validee: { label: 'Validée', color: '#16a34a', message: 'Votre inscription a été validée. Le séjour est confirmé !' },
    refusee: { label: 'Refusée', color: '#dc2626', message: 'Votre inscription n\'a malheureusement pas pu être retenue. N\'hésitez pas à nous contacter pour plus d\'informations.' },
    annulee: { label: 'Annulée', color: '#de7356', message: 'Votre inscription a été annulée.' },
  };

  const statusInfo = statusLabels[newStatus];
  if (!statusInfo) return null;

  try {
    const result = await getResend().emails.send({
      from: FROM_EMAIL,
      to: referentEmail,
      subject: `Inscription ${statusInfo.label.toLowerCase()} - ${jeunePrenom} ${jeuneNom}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2a383f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Groupe &amp; Découverte</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: ${statusInfo.color};">Inscription ${statusInfo.label}</h2>
            <p>Bonjour ${referentNom},</p>
            <p>${statusInfo.message}</p>
            <p><strong>Jeune concerné :</strong> ${jeunePrenom} ${jeuneNom}</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">Groupe &amp; Découverte — Séjours de vacances pour enfants et adolescents</p>
          </div>
        </div>
      `,
    });
    return result;
  } catch (error) {
    console.error('[EMAIL] Erreur envoi changement statut:', error);
    return null;
  }
}
