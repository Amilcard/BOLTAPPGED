import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente — Groupe & Découverte',
  description: 'Conditions générales de vente des séjours et activités — Association Groupe et Découverte.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-primary mb-3 pb-2 border-b border-primary-100">{title}</h2>
      <div className="space-y-3 text-sm text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

function InfoBox({ children, variant = 'blue' }: { children: React.ReactNode; variant?: 'blue' | 'orange' }) {
  const cls = variant === 'orange'
    ? 'bg-orange-50 border-orange-200 text-orange-800 border-l-4 border-l-orange-400'
    : 'bg-primary-50 border-primary-100 text-primary-700';
  return <div className={`border rounded-xl p-4 text-sm ${cls}`}>{children}</div>;
}

function TableData({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-xs">
        <thead className="bg-primary text-white">
          <tr>{headers.map((h) => <th key={h} className="text-left px-3 py-2.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            // deepsource-ignore JS-0437 -- no stable id in row (string[]), index is intentional
            <tr key={row.join('|')} className={i % 2 === 0 ? 'bg-white' : 'bg-primary-50/40'}>
              {row.map((cell, j) => <td key={j} className="px-3 py-2.5 text-gray-700 border-b border-gray-50 align-top">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CgvPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50/30">
      {/* Header */}
      <div className="bg-white border-b border-primary-100">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <nav className="text-xs text-primary-400 mb-2 flex items-center gap-1.5">
            <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-primary font-medium">CGV</span>
          </nav>
          <h1 className="text-2xl font-bold text-primary">Conditions Générales de Vente</h1>
          <p className="text-xs text-gray-400 mt-1">
            Association Groupe et Découverte — Version en vigueur au 8 avril 2026
          </p>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-primary-100 p-6 md:p-8">

          <Section title="1. Parties contractantes">
            <p>Les présentes CGV s&apos;appliquent à toute commande effectuée entre :</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                <strong>Le prestataire :</strong> Association Groupe et Découverte, 3 rue Flobert, 42000
                Saint-Étienne — SIREN : 515 225 654 — Agrément J&S : 069ORG0667
              </li>
              <li>
                <strong>L&apos;acheteur :</strong> la structure professionnelle (association, collectivité,
                établissement scolaire, service municipal, etc.) représentée par son personnel habilité
              </li>
            </ul>
          </Section>

          <Section title="2. Offres et tarifs">
            <p>
              Les séjours et activités sont décrits avec leurs caractéristiques essentielles (dates, lieu, public,
              encadrement, tarif). Les prix sont indiqués en euros TTC. L&apos;association se réserve le droit de
              modifier ses tarifs à tout moment ; les tarifs applicables sont ceux en vigueur au moment de la
              validation de la commande.
            </p>
          </Section>

          <Section title="3. Disponibilité des sessions">
            <InfoBox variant="orange">
              <p className="font-semibold mb-1">Attention :Information essentielle — Indisponibilité des sessions</p>
              <p>
                Les séjours proposés dépendent de la disponibilité effective de nos structures et partenaires
                (organismes d&apos;accueil, prestataires d&apos;animation, transporteurs, hébergeurs). Une session
                confirmée peut devenir indisponible postérieurement à l&apos;inscription pour des raisons
                indépendantes de la volonté de l&apos;association.
              </p>
            </InfoBox>

            <h3 className="font-semibold text-primary-700 mt-3">Transmission via les réseaux partenaires</h3>
            <p>
              Les demandes d&apos;inscription transmises via les réseaux sociaux et partenaires respectifs (centres
              sociaux, associations de quartier, établissements scolaires, services municipaux, etc.) sont traitées
              selon les délais propres à chaque réseau. L&apos;association ne saurait être tenue responsable des
              délais de transmission gérés par ces réseaux indépendants.
            </p>
            <p>L&apos;inscription n&apos;est définitive qu&apos;après :</p>
            <ol className="list-decimal list-inside space-y-1 pl-2">
              <li>Réception et validation de la demande par l&apos;association</li>
              <li>Confirmation écrite adressée à la structure professionnelle</li>
              <li>Règlement de la participation financière</li>
            </ol>

            <h3 className="font-semibold text-primary-700 mt-3">En cas d&apos;indisponibilité constatée après inscription</h3>
            <p>L&apos;association s&apos;engage à :</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Informer la structure par email dans les meilleurs délais</li>
              <li>Proposer en priorité une session alternative de nature équivalente, au même tarif</li>
              <li>En l&apos;absence d&apos;alternative acceptée, rembourser intégralement les sommes versées sous 14 jours</li>
            </ul>
          </Section>

          <Section title="4. Modalités de règlement">
            <InfoBox>
              <p className="font-semibold mb-2">Moyens de paiement acceptés</p>
              <ul className="space-y-1">
                <li><strong>Virement bancaire</strong> — RIB communiqué sur devis ou facture</li>
                <li>— <strong>Chèque</strong> — à l&apos;ordre de « Association Groupe et Découverte »</li>
                <li><strong>Carte bancaire</strong> — paiement sécurisé en ligne (Visa, Mastercard)</li>
                <li><strong>Coupon / bon CAF / aide financière</strong> — selon dispositifs en vigueur</li>
              </ul>
            </InfoBox>
            <TableData
              headers={['Moyen', 'Modalités']}
              rows={[
                ['Chèque', 'Libellé à l\'ordre de « Association Groupe et Découverte » — à adresser au siège : 3 rue Flobert, 42000 Saint-Étienne'],
                ['Virement', 'RIB communiqué sur devis ou facture — indiquer la référence d\'inscription en objet'],
                ['Carte bancaire', 'Paiement sécurisé TLS via la plateforme — Visa / Mastercard — aucune coordonnée bancaire conservée par l\'association'],
              ]}
            />
            <p>
              L&apos;inscription est définitivement confirmée après réception du règlement complet ou, pour les
              structures publiques, sur présentation d&apos;un bon de commande validé.
            </p>
          </Section>

          <Section title="5. Processus de commande">
            <ol className="list-decimal list-inside space-y-1.5 pl-2">
              <li>Le professionnel sélectionne le(s) séjour(s) et renseigne les informations relatives aux enfants à inscrire</li>
              <li>Il valide les données et confirme disposer des autorisations parentales requises</li>
              <li>Il procède au règlement selon les modalités définies à l&apos;article 4</li>
              <li>Un email de confirmation est adressé dès validation du dossier complet</li>
            </ol>
          </Section>

          <Section title="6. Droit de rétractation">
            <InfoBox variant="orange">
              <p className="font-semibold mb-1">Attention :Information importante</p>
              <p>
                Conformément à l&apos;article L. 221-28 du Code de la consommation, le droit de rétractation de
                14 jours <strong>ne s&apos;applique pas</strong> aux prestations de services de loisirs ou
                d&apos;hébergement prévoyant une date ou une période d&apos;exécution spécifique (séjours avec
                dates fixées). Les structures contractantes en sont informées et l&apos;acceptent lors de la
                validation de leur commande.
              </p>
            </InfoBox>
          </Section>

          <Section title="7. Politique d'annulation et de remboursement">
            <p>En cas d&apos;annulation à l&apos;initiative de la structure :</p>
            <TableData
              headers={['Délai avant début du séjour', 'Conditions de remboursement']}
              rows={[
                ['Plus de 30 jours', 'Remboursement intégral'],
                ['Entre 15 et 30 jours', 'Remboursement à 50 %'],
                ['Moins de 15 jours', 'Aucun remboursement (sauf force majeure documentée)'],
                ['Session annulée par l\'association', 'Remboursement intégral dans les 14 jours'],
                ['Session indisponible (partenaire)', 'Remboursement intégral ou session alternative — voir article 3'],
              ]}
            />
            <p className="text-xs text-gray-400 italic">
              Demandes de remboursement à adresser à :{' '}
              <a href="mailto:contact@groupeetdecouverte.fr" className="underline">contact@groupeetdecouverte.fr</a>{' '}
              avec la référence d&apos;inscription.
            </p>
          </Section>

          <Section title="8. Assurance et responsabilité">
            <p>
              L&apos;Association Groupe et Découverte est couverte par une assurance Responsabilité Civile
              Professionnelle pour l&apos;organisation de séjours pour mineurs. Les séjours sont organisés dans le
              cadre de l&apos;agrément Jeunesse et Sports n° 069ORG0667. Les animateurs sont titulaires des
              diplômes réglementaires (BAFA, BPJEPS ou équivalent).
            </p>
          </Section>

          <Section title="9. Litiges">
            <p>
              En cas de litige, la structure est invitée à contacter l&apos;association à{' '}
              <a href="mailto:contact@groupeetdecouverte.fr" className="text-secondary underline">
                contact@groupeetdecouverte.fr
              </a>.
              En l&apos;absence de règlement amiable sous 30 jours, les tribunaux compétents seront ceux de
              Saint-Étienne, loi française applicable.
            </p>
          </Section>

          <Section title="10. Protection des données personnelles">
            <p>
              Dans le cadre de l&apos;inscription, des données personnelles relatives aux mineurs (identité, date
              de naissance, données de santé) et à leurs référents professionnels sont collectées. Ces données
              sont traitées conformément au Règlement Général sur la Protection des Données (RGPD) et aux
              recommandations de la CNIL relatives aux données de mineurs.
            </p>
            <InfoBox>
              <p className="font-semibold mb-2">Engagements de l&apos;association</p>
              <ul className="space-y-1">
                <li>— Données hébergées exclusivement en Union européenne (Francfort, Allemagne)</li>
                <li>— Consentement du responsable légal recueilli pour les mineurs de moins de 15 ans</li>
                <li>— Données de santé supprimées automatiquement 3 mois après la fin du séjour</li>
                <li>— Audit de tous les accès aux données sensibles</li>
                <li>Aucune donnée bancaire conservée (paiement délégué à Stripe, certifié PCI-DSS)</li>
              </ul>
            </InfoBox>
            <p>
              Pour exercer vos droits (accès, rectification, suppression, portabilité), contactez notre
              Délégué à la Protection des Données :{' '}
              <a href="mailto:dpo@groupeetdecouverte.fr" className="text-secondary underline">
                dpo@groupeetdecouverte.fr
              </a>.
            </p>
            <p>
              La politique complète de protection des données est consultable sur{' '}
              <Link href="/confidentialite" className="text-secondary underline">
                notre page dédiée
              </Link>.
            </p>
          </Section>

          {/* Liens bas de page */}
          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-400">
            <Link href="/mentions-legales" className="hover:text-primary transition-colors">Mentions légales</Link>
            <Link href="/confidentialite" className="hover:text-primary transition-colors">Confidentialité</Link>
            <Link href="/cgu" className="hover:text-primary transition-colors">CGU</Link>
            <Link href="/" className="hover:text-primary transition-colors">Retour à l&apos;accueil</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
