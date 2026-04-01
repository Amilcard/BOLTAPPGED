import { Resend } from 'resend';

// Lazy singleton — prevents top-level crash when EMAIL_SERVICE_API_KEY is absent at build time.
let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.EMAIL_SERVICE_API_KEY);
  return _resend;
}

// Domaine groupeetdecouverte.fr vérifié sur Resend
const FROM_EMAIL = 'Groupe & Découverte <noreply@groupeetdecouverte.fr>';
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'contact@groupeetdecouverte.fr,groupeetdecouverte@gmail.com';

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
              <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 12px;">⚠️ Votre inscription sera validée à réception du règlement.</p>
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
              <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 12px;">⚠️ Votre inscription sera validée à réception du chèque.</p>
            </div>
            ` : ''}

            <p style="color: #6b7280; font-size: 14px;">Votre inscription est en attente de validation. Vous recevrez un email de confirmation une fois le paiement reçu et validé.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">Groupe &amp; Découverte — Séjours de vacances pour enfants et adolescents</p>
            <p style="color: #9ca3af; font-size: 11px; margin-top: 8px; border-top: 1px solid #f3f4f6; padding-top: 8px;">
              🔒 Vos données personnelles sont traitées par l'Association Groupe et Découverte conformément au RGPD.
              Pour exercer vos droits (accès, rectification, suppression), écrivez à
              <a href="mailto:groupeetdecouverte@gmail.com?subject=Demande RGPD" style="color: #6b7280;">groupeetdecouverte@gmail.com</a>
              en mentionnant « Demande RGPD ».
              <a href="https://app.groupeetdecouverte.fr/confidentialite" style="color: #6b7280;">Politique de confidentialité</a>
            </p>
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
            ${data.organisation ? `<li><strong>Structure :</strong> ${data.organisation}</li>` : ''}
            ${data.dossierRef ? `<li><strong>Dossier :</strong> <code>${data.dossierRef}</code></li>` : ''}
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
}) {
  if (!process.env.EMAIL_SERVICE_API_KEY || process.env.EMAIL_SERVICE_API_KEY === 'YOUR_EMAIL_API_KEY_HERE') {
    return null;
  }

  try {
    const result = await getResend().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `Paiement confirmé — ${data.jeunePrenom} ${data.jeuneNom} (${data.amount.toFixed(2)} €)`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #16a34a; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">Paiement CB confirmé</h2>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #6b7280;">Jeune</td><td style="padding: 6px 0; font-weight: bold;">${data.jeunePrenom} ${data.jeuneNom}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Référent</td><td style="padding: 6px 0;">${data.referentNom}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Séjour</td><td style="padding: 6px 0;">${data.sejourSlug.replace(/-/g, ' ')}</td></tr>
              ${data.dossierRef ? `<tr><td style="padding: 6px 0; color: #6b7280;">Dossier</td><td style="padding: 6px 0; font-family: monospace;">${data.dossierRef}</td></tr>` : ''}
              <tr><td style="padding: 6px 0; color: #6b7280;">Montant</td><td style="padding: 6px 0; font-weight: bold; color: #16a34a;">${data.amount.toFixed(2)} €</td></tr>
            </table>
            <p style="margin-top: 16px;"><a href="https://app.groupeetdecouverte.fr/admin/demandes" style="background: #2a383f; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">Voir dans l'admin</a></p>
          </div>
        </div>
      `,
    });
    return result;
  } catch (error) {
    console.error('[EMAIL] Erreur envoi notification paiement admin:', error);
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

// ============================================================
// Notification souhait kid → éducateur
// ============================================================

interface SouhaitEmailData {
  educateurEmail: string;
  educateurPrenom?: string;
  kidPrenom: string;
  sejourTitre: string;
  motivation: string;
  lienReponse: string;
}

export async function sendSouhaitNotificationEducateur(data: SouhaitEmailData) {
  const apiKey = process.env.EMAIL_SERVICE_API_KEY;
  if (!apiKey || apiKey === 'YOUR_EMAIL_API_KEY_HERE') return null;

  try {
    const resend = getResend();
    const prenom = data.educateurPrenom ? ` ${data.educateurPrenom}` : '';
    return await resend.emails.send({
      from: FROM_EMAIL,
      to: data.educateurEmail,
      subject: `${data.kidPrenom} souhaite partir en séjour — ${data.sejourTitre}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="background: #2a383f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 20px;">Groupe &amp; Découverte</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #2a383f;">Un souhait de séjour à traiter</h2>
            <p>Bonjour${prenom},</p>
            <p><strong>${data.kidPrenom}</strong> a noté un souhait pour le séjour :</p>
            <div style="background: #f9fafb; border-left: 4px solid #e07a5f; padding: 16px; margin: 16px 0; border-radius: 4px;">
              <p style="margin: 0 0 8px; font-weight: bold; color: #2a383f;">${data.sejourTitre}</p>
              <p style="margin: 0; color: #4b5563; font-style: italic;">&laquo; ${data.motivation} &raquo;</p>
            </div>
            <p>Cliquez sur le bouton ci-dessous pour consulter ce souhait et y répondre :</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${data.lienReponse}"
                 style="display: inline-block; background: #e07a5f; color: white; padding: 14px 28px; border-radius: 9999px; text-decoration: none; font-weight: bold; font-size: 15px;">
                Voir le souhait et répondre
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>
              <span style="color: #6b7280;">${data.lienReponse}</span>
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">Groupe &amp; Découverte — Séjours de vacances pour enfants et adolescents</p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error('[EMAIL] Erreur envoi souhait éducateur:', error);
    return null;
  }
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
}) {
  if (!process.env.EMAIL_SERVICE_API_KEY || process.env.EMAIL_SERVICE_API_KEY === 'YOUR_EMAIL_API_KEY_HERE') {
    return null;
  }

  try {
    const result = await getResend().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `Dossier enfant soumis — ${data.jeunePrenom} ${data.jeuneNom}${data.dossierRef ? ` (${data.dossierRef})` : ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #166534; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">Dossier enfant soumis</h2>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin-bottom: 16px;">
              <tr><td style="padding: 6px 0; color: #6b7280;">Jeune</td><td style="padding: 6px 0; font-weight: bold;">${data.jeunePrenom} ${data.jeuneNom}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Référent</td><td style="padding: 6px 0;">${data.referentNom} (${data.referentEmail})</td></tr>
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
    return result;
  } catch (error) {
    console.error('[EMAIL] Erreur envoi notification admin GED:', error);
    return null;
  }
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
}) {
  if (!process.env.EMAIL_SERVICE_API_KEY || process.env.EMAIL_SERVICE_API_KEY === 'YOUR_EMAIL_API_KEY_HERE') {
    console.warn('[EMAIL] Clé API manquante — rappel dossier incomplet non envoyé');
    return null;
  }

  const suiviUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.groupeetdecouverte.fr'}/suivi/${data.suiviToken}`;
  const refLabel = data.dossierRef ? ` ${data.dossierRef}` : '';

  try {
    const result = await getResend().emails.send({
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
            <p>Bonjour ${data.referentNom},</p>
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
            <p style="color: #9ca3af; font-size: 11px; margin-top: 8px; border-top: 1px solid #f3f4f6; padding-top: 8px;">
              🔒 Vos données personnelles sont traitées conformément au RGPD.
              Contact : <a href="mailto:groupeetdecouverte@gmail.com?subject=Demande RGPD" style="color: #6b7280;">groupeetdecouverte@gmail.com</a> —
              <a href="https://app.groupeetdecouverte.fr/confidentialite" style="color: #6b7280;">Politique de confidentialité</a>
            </p>
          </div>
        </div>
      `,
    });
    console.log('[EMAIL] Rappel dossier incomplet envoyé à:', data.referentEmail);
    return result;
  } catch (error) {
    console.error('[EMAIL] Erreur envoi rappel dossier incomplet:', error);
    return null;
  }
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
}) {
  if (!process.env.EMAIL_SERVICE_API_KEY || process.env.EMAIL_SERVICE_API_KEY === 'YOUR_EMAIL_API_KEY_HERE') {
    return null;
  }

  const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.groupeetdecouverte.fr'}/admin/demandes/${data.inscriptionId}`;
  const dateRelance = new Date().toLocaleDateString('fr-FR');

  try {
    const result = await getResend().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `[Relance envoyée] Dossier ${data.dossierRef || data.inscriptionId} — ${data.referentNom}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #b45309; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">Relance dossier incomplet envoyée</h2>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin-bottom: 16px;">
              <tr><td style="padding: 6px 0; color: #6b7280;">Référent</td><td style="padding: 6px 0; font-weight: bold;">${data.referentNom}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td style="padding: 6px 0;">${data.referentEmail}</td></tr>
              ${data.structureNom ? `<tr><td style="padding: 6px 0; color: #6b7280;">Structure</td><td style="padding: 6px 0;">${data.structureNom}</td></tr>` : ''}
              ${data.dossierRef ? `<tr><td style="padding: 6px 0; color: #6b7280;">Dossier</td><td style="padding: 6px 0; font-family: monospace; font-weight: bold;">${data.dossierRef}</td></tr>` : ''}
              <tr><td style="padding: 6px 0; color: #6b7280;">Date de relance</td><td style="padding: 6px 0;">${dateRelance}</td></tr>
            </table>
            <p style="font-size: 14px; margin: 0 0 12px 0;"><a href="${adminUrl}" style="background: #2a383f; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">Voir le dossier dans l'admin</a></p>
          </div>
        </div>
      `,
    });
    console.log('[EMAIL] Notification relance admin envoyée pour dossier:', data.dossierRef || data.inscriptionId);
    return result;
  } catch (error) {
    console.error('[EMAIL] Erreur envoi notification relance admin:', error);
    return null;
  }
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
}) {
  if (!process.env.EMAIL_SERVICE_API_KEY || process.env.EMAIL_SERVICE_API_KEY === 'YOUR_EMAIL_API_KEY_HERE') {
    console.warn('[EMAIL] Clé API manquante — email dossier complet non envoyé');
    return null;
  }

  try {
    const result = await getResend().emails.send({
      from: FROM_EMAIL,
      to: data.referentEmail,
      subject: `Dossier de ${data.jeunePrenom} ${data.jeuneNom} complété${data.dossierRef ? ` - ${data.dossierRef}` : ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2a383f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Groupe &amp; Découverte</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
              <h2 style="color: #166534; margin: 0 0 8px 0; font-size: 18px;">Dossier complet ✓</h2>
              <p style="margin: 0; color: #15803d; font-size: 14px;">Tous les documents ont bien été reçus.</p>
            </div>
            <p>Bonjour ${data.referentNom},</p>
            <p>Le dossier de <strong>${data.jeunePrenom} ${data.jeuneNom}</strong> est désormais complet. Nous avons bien reçu l'ensemble des documents requis (bulletin complémentaire, fiche sanitaire, fiche de liaison et pièces jointes).</p>
            ${data.dossierRef ? `<p>Référence du dossier : <strong style="font-family: monospace;">${data.dossierRef}</strong></p>` : ''}
            <p>Notre équipe procédera à la vérification des documents et vous contactera si nécessaire.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">Groupe &amp; Découverte — Séjours de vacances pour enfants et adolescents</p>
          </div>
        </div>
      `,
    });
    console.log('[EMAIL] Dossier complet envoyé à:', data.referentEmail);
    return result;
  } catch (error) {
    console.error('[EMAIL] Erreur envoi dossier complet:', error);
    return null;
  }
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

export async function sendNewEducateurAlert(data: NewEducateurAlertData) {
  try {
    const resend = getResend();
    if (!process.env.EMAIL_SERVICE_API_KEY) return null;

    const structList = data.existingStructures
      .map(s => `<li><strong>${s.name}</strong> (${s.city}) — code : <code>${s.code}</code></li>`)
      .join('');

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.adminEmail || ADMIN_EMAIL,
      subject: `[Structure] Nouvel éducateur détecté — ${data.postalCode} — ${data.structureDeclaredName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #D4AC0D; color: #333; padding: 16px 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">⚠️ Nouvel éducateur sans code structure</h2>
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
    console.log('[EMAIL] Alerte nouvel éducateur envoyée pour CP:', data.postalCode);
    return result;
  } catch (error) {
    console.error('[EMAIL] Erreur envoi alerte nouvel éducateur:', error);
    return null;
  }
}

export async function sendStructureCodeEmail(data: StructureCodeEmailData) {
  try {
    const resend = getResend();
    if (!process.env.EMAIL_SERVICE_API_KEY) return null;

    const result = await resend.emails.send({
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
            <p>La structure <strong>${data.structureName}</strong> est désormais enregistrée sur Groupe & Découverte.</p>
            <div style="background: #1A5276; color: white; text-align: center; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 5px 0; font-size: 14px;">Votre code structure</p>
              <p style="margin: 0; font-size: 32px; font-weight: bold; letter-spacing: 4px;">${data.structureCode}</p>
            </div>
            <p><strong>Transmettez ce code à vos collègues</strong> pour regrouper les inscriptions de votre structure. Ils pourront le saisir lors de leur prochaine inscription ou depuis leur espace de suivi.</p>
            <p style="color: #666; font-size: 13px; margin-top: 30px;">Cet email a été envoyé suite à l'inscription réalisée par ${data.educateurPrenom}. Si vous n'êtes pas concerné(e), vous pouvez ignorer ce message.</p>
          </div>
        </div>
      `,
    });
    console.log('[EMAIL] Code structure envoyé à:', data.recipientEmail);
    return result;
  } catch (error) {
    console.error('[EMAIL] Erreur envoi code structure:', error);
    return null;
  }
}

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
}) {
  try {
    const resend = getResend();
    if (!process.env.EMAIL_SERVICE_API_KEY || process.env.EMAIL_SERVICE_API_KEY === 'YOUR_EMAIL_API_KEY_HERE') return null;

    const result = await resend.emails.send({
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
            <p>Les dossiers de la structure <strong>${data.structureName}</strong> ont été intégrés dans notre plateforme.</p>
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
    console.log('[EMAIL] Invitation chef de service envoyée à:', data.recipientEmail);
    return result;
  } catch (error) {
    console.error('[EMAIL] Erreur envoi invitation chef de service:', error);
    return null;
  }
}
