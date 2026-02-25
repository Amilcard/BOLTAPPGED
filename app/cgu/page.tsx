import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Conditions Générales d\'Utilisation — Groupe & Découverte',
  description: 'Conditions générales d\'utilisation de l\'application app.groupeetdecouverte.fr',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-primary mb-3 pb-2 border-b border-primary-100">{title}</h2>
      <div className="space-y-3 text-sm text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

function InfoBox({ children, variant = 'blue' }: { children: React.ReactNode; variant?: 'blue' | 'green' }) {
  const cls = variant === 'green'
    ? 'bg-green-50 border-green-100 text-green-800'
    : 'bg-primary-50 border-primary-100 text-primary-700';
  return (
    <div className={`border rounded-xl p-4 text-sm ${cls}`}>{children}</div>
  );
}

export default function CguPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50/30">
      {/* Header */}
      <div className="bg-white border-b border-primary-100">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <nav className="text-xs text-primary-400 mb-2 flex items-center gap-1.5">
            <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-primary font-medium">CGU</span>
          </nav>
          <h1 className="text-2xl font-bold text-primary">Conditions Générales d&apos;Utilisation</h1>
          <p className="text-xs text-gray-400 mt-1">
            Application app.groupeetdecouverte.fr — Version en vigueur au 25 février 2026
          </p>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-primary-100 p-6 md:p-8">

          <Section title="1. Objet">
            <p>
              Les présentes Conditions Générales d&apos;Utilisation (CGU) régissent l&apos;accès et l&apos;utilisation
              de la plateforme <strong>app.groupeetdecouverte.fr</strong> exploitée par l&apos;Association Groupe et
              Découverte (3 rue Flobert, 42000 Saint-Étienne — SIREN : 515 225 654 — Agrément J&S : 069ORG0667).
            </p>
            <p>Tout accès à la plateforme vaut acceptation sans réserve des présentes CGU.</p>
          </Section>

          <Section title="2. Espaces d'accès">
            <h3 className="font-semibold text-primary-700">2.1 Espace Kids / Ados — accès anonyme</h3>
            <InfoBox variant="green">
              <p className="font-semibold mb-1">✓ Aucun compte, aucune donnée</p>
              <p>
                Les enfants et adolescents accèdent à la plateforme sans création de compte ni saisie de données
                personnelles. Cet espace leur permet d&apos;explorer les séjours et d&apos;envoyer leurs vœux à leur
                structure référente. Aucune information personnelle n&apos;est collectée ou conservée.
              </p>
            </InfoBox>

            <h3 className="font-semibold text-primary-700 mt-4">2.2 Espace Professionnel</h3>
            <p>
              L&apos;espace professionnel est réservé au personnel habilité des structures partenaires (associations,
              établissements scolaires, centres sociaux, services municipaux, etc.) disposant d&apos;un compte validé
              par l&apos;association. Il permet de :
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Consulter les offres de séjours et d&apos;activités disponibles</li>
              <li>Inscrire les enfants et adolescents de la structure</li>
              <li>Renseigner les informations nécessaires à l&apos;inscription (prénom, date de naissance, structure référente)</li>
              <li>Suivre les inscriptions et les échéances de règlement</li>
            </ul>
          </Section>

          <Section title="3. Conditions d'accès à l'espace professionnel">
            <p>L&apos;accès à l&apos;espace professionnel est conditionné à :</p>
            <ol className="list-decimal list-inside space-y-1 pl-2">
              <li>La détention d&apos;un compte créé ou validé par l&apos;Association Groupe et Découverte</li>
              <li>La signature du contrat de sous-traitance RGPD avec l&apos;association</li>
              <li>L&apos;acceptation sans réserve des présentes CGU</li>
            </ol>
            <p>
              Tout professionnel s&apos;engage à maintenir la confidentialité de ses identifiants. Toute utilisation
              de son compte engage juridiquement la structure dont il dépend.
            </p>
          </Section>

          <Section title="4. Disponibilité des sessions">
            <InfoBox>
              <p className="font-semibold mb-1">⚠ Information importante — Indisponibilité des sessions</p>
              <p>
                Les séjours proposés dépendent de la disponibilité effective de nos partenaires. Une session peut
                devenir indisponible après inscription pour des raisons indépendantes de la volonté de
                l&apos;association (fermeture d&apos;un site, manque de participants, indisponibilité d&apos;un
                partenaire). Dans ce cas, une session alternative sera proposée ou un remboursement intégral effectué
                dans les 14 jours.
              </p>
            </InfoBox>
            <p>
              Les demandes transmises via les réseaux partenaires (centres sociaux, établissements scolaires,
              services municipaux, etc.) sont traitées selon les délais propres à chaque réseau. L&apos;inscription
              n&apos;est définitive qu&apos;après confirmation écrite de l&apos;association.
            </p>
          </Section>

          <Section title="5. Obligations du professionnel">
            <p>En utilisant l&apos;espace professionnel, l&apos;utilisateur s&apos;engage à :</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Ne saisir que des données exactes, liées à l&apos;exercice de ses fonctions professionnelles</li>
              <li>Utiliser la plateforme exclusivement à des fins d&apos;organisation d&apos;activités et de séjours</li>
              <li>Ne pas tenter d&apos;accéder aux données d&apos;autres structures</li>
              <li>Signaler sans délai toute anomalie ou accès suspect à : <a href="mailto:groupeetdecouverte@gmail.com" className="text-secondary underline">groupeetdecouverte@gmail.com</a></li>
            </ul>
          </Section>

          <Section title="6. Propriété intellectuelle">
            <p>
              Tous les éléments de la plateforme (graphismes, code, contenus, marque) sont la propriété exclusive de
              l&apos;Association Groupe et Découverte. Toute reproduction non autorisée est interdite.
            </p>
          </Section>

          <Section title="7. Modification et résiliation">
            <p>
              L&apos;association se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs
              professionnels seront informés de toute modification substantielle par email. L&apos;association peut
              suspendre ou résilier un compte en cas de manquement aux présentes CGU.
            </p>
          </Section>

          <Section title="8. Loi applicable">
            <p>
              Les présentes CGU sont soumises au droit français. En cas de litige, les parties rechercheront une
              solution amiable. À défaut, les tribunaux compétents seront ceux de Saint-Étienne.
            </p>
          </Section>

          {/* Liens bas de page */}
          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-400">
            <Link href="/mentions-legales" className="hover:text-primary transition-colors">Mentions légales</Link>
            <Link href="/confidentialite" className="hover:text-primary transition-colors">Confidentialité</Link>
            <Link href="/cgv" className="hover:text-primary transition-colors">CGV</Link>
            <Link href="/" className="hover:text-primary transition-colors">Retour à l&apos;accueil</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
