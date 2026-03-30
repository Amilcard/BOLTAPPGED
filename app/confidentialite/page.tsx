import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Groupe & Découverte',
  description: 'Politique de confidentialité et traitement des données personnelles (RGPD) — Association Groupe et Découverte.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-primary mb-3 pb-2 border-b border-primary-100">{title}</h2>
      <div className="space-y-3 text-sm text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 text-sm text-primary-700">
      {children}
    </div>
  );
}

function TableData({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-xs">
        <thead className="bg-primary text-white">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-primary-50/40'}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 text-gray-700 border-b border-gray-50 last:border-0 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50/30">
      {/* Header */}
      <div className="bg-white border-b border-primary-100">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <nav className="text-xs text-primary-400 mb-2 flex items-center gap-1.5">
            <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-primary font-medium">Politique de confidentialité</span>
          </nav>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-secondary" />
            <h1 className="text-2xl font-bold text-primary">Politique de confidentialité</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Conforme au Règlement (UE) 2016/679 (RGPD) et à la loi Informatique et Libertés — Dernière mise à jour : février 2026
          </p>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-primary-100 p-6 md:p-8">

          <Section title="1. Responsable du traitement">
            <InfoBox>
              <p className="font-semibold text-primary mb-1">Association Groupe et Découverte</p>
              <p>3 rue Flobert — 42000 Saint-Étienne</p>
              <p>Contact RGPD : <a href="mailto:groupeetdecouverte@gmail.com" className="underline">groupeetdecouverte@gmail.com</a></p>
              <p>Représentant légal : HAMOUDI Laïd, Président</p>
            </InfoBox>
          </Section>

          <Section title="2. Architecture de la plateforme et collecte de données">
            <h3 className="font-semibold text-primary-700">2.1 Espace Kids / Ados — accès totalement anonyme</h3>
            <InfoBox>
              <p className="font-semibold text-green-700 mb-1">✓ Aucune donnée personnelle collectée</p>
              <p>
                L&apos;espace kids/ados permet aux jeunes d&apos;explorer les séjours et d&apos;exprimer leurs souhaits
                de façon totalement anonyme. Aucun compte n&apos;est créé, aucune information personnelle n&apos;est
                saisie ni conservée.
              </p>
            </InfoBox>

            <h3 className="font-semibold text-primary-700 mt-4">2.2 Espace Professionnel — données collectées</h3>
            <p>Les professionnels accèdent à la plateforme pour inscrire les enfants de leur structure. Les données suivantes sont collectées :</p>
            <TableData
              headers={['Catégorie', 'Données', 'Base légale', 'Conservation']}
              rows={[
                ['Compte professionnel', 'Nom, prénom, email, structure', 'Contrat (CGU)', '3 ans après dernière connexion'],
                ['Enfant inscrit', 'Prénom, date de naissance, structure référente', 'Contrat d\'inscription', 'Durée séjour + 3 ans'],
                ['Paiement', 'Référence, montant, date (pas de coordonnées bancaires)', 'Obligation légale', '10 ans (Code du commerce)'],
                ['Logs connexion', 'Adresse IP, horodatage', 'Intérêt légitime (sécurité)', '12 mois'],
              ]}
            />
            <p className="text-xs text-gray-400 mt-2 italic">
              Principe de minimisation appliqué : seules les données strictement nécessaires à l&apos;organisation des séjours sont collectées.
            </p>
          </Section>

          <Section title="3. Paiement en ligne">
            <p>
              Les paiements sont traités par notre prestataire de paiement sécurisé. L&apos;association ne stocke à
              aucun moment les coordonnées bancaires complètes. Les transactions sont chiffrées via le protocole TLS.
            </p>
            <InfoBox>
              <p className="font-semibold">Moyens de paiement acceptés</p>
              <p>Chèque · Virement bancaire · Carte bancaire (en ligne)</p>
            </InfoBox>
          </Section>

          <Section title="4. Destinataires des données">
            <p>Les données sont destinées exclusivement :</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Au personnel habilité de l&apos;Association Groupe et Découverte</li>
              <li>Aux professionnels de la structure ayant procédé à l&apos;inscription (accès limité à leur propre structure)</li>
              <li>À l&apos;hébergeur Hostinger (accès technique uniquement, soumis à un DPA)</li>
              <li>Au prestataire de paiement (données strictement nécessaires à la transaction)</li>
            </ul>
            <p className="font-medium text-primary-700">Aucune donnée n&apos;est vendue, louée ou cédée à des tiers à des fins commerciales.</p>
          </Section>

          <Section title="5. Transferts hors Union Européenne">
            <p>
              L&apos;ensemble des données est hébergé sur des serveurs situés au sein de l&apos;Union Européenne
              (Hostinger — datacenter UE). Aucun transfert hors UE n&apos;est effectué.
            </p>
          </Section>

          <Section title="6. Sécurité des données">
            <p>L&apos;association met en œuvre les mesures suivantes :</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Chiffrement des communications (HTTPS / TLS)</li>
              <li>Authentification sécurisée par identifiants uniques</li>
              <li>Contrôle d&apos;accès par rôle (les pros ne voient que les données de leur structure)</li>
              <li>Journalisation des accès aux données sensibles</li>
              <li>Sauvegardes automatiques chiffrées</li>
            </ul>
          </Section>

          <Section title="7. Vos droits">
            <p>Toute personne dont les données sont traitées dispose des droits suivants :</p>
            <TableData
              headers={['Droit', 'Description']}
              rows={[
                ['Accès (Art. 15)', 'Obtenir une copie des données vous concernant'],
                ['Rectification (Art. 16)', 'Corriger des données inexactes ou incomplètes'],
                ['Effacement (Art. 17)', 'Demander la suppression (sous réserve d\'obligations légales)'],
                ['Portabilité (Art. 20)', 'Recevoir vos données dans un format structuré'],
                ['Opposition (Art. 21)', 'S\'opposer au traitement dans certaines conditions'],
                ['Limitation (Art. 18)', 'Demander la suspension temporaire d\'un traitement'],
              ]}
            />
            <InfoBox>
              <p>
                Pour exercer ces droits, adressez votre demande à :{' '}
                <a href="mailto:groupeetdecouverte@gmail.com?subject=Demande RGPD" className="underline font-medium">
                  groupeetdecouverte@gmail.com
                </a>{' '}
                avec la mention <strong>«&nbsp;Demande RGPD&nbsp;»</strong>. Réponse sous 30 jours maximum.
              </p>
              <p className="mt-1 text-xs">
                En cas de réponse insatisfaisante, vous pouvez introduire une réclamation auprès de la{' '}
                <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="underline">CNIL</a>.
              </p>
            </InfoBox>
          </Section>

          <Section title="8. Cookies">
            <p>
              L&apos;espace kids/ados étant totalement anonyme, aucun cookie de traitement ou de suivi n&apos;y est
              déposé. Sur l&apos;espace professionnel, seuls les cookies strictement nécessaires au fonctionnement
              (authentification, sécurité de session) sont utilisés.
            </p>
          </Section>

          <Section title="9. Modification de cette politique">
            <p>
              Cette politique peut être mise à jour à tout moment. En cas de modification substantielle, les
              utilisateurs professionnels seront informés par email. La date de mise à jour figure en haut du document.
            </p>
          </Section>

          {/* Liens bas de page */}
          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-400">
            <Link href="/mentions-legales" className="hover:text-primary transition-colors">Mentions légales</Link>
            <Link href="/cgu" className="hover:text-primary transition-colors">CGU</Link>
            <Link href="/cgv" className="hover:text-primary transition-colors">CGV</Link>
            <Link href="/" className="hover:text-primary transition-colors">Retour à l&apos;accueil</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
