import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Mentions légales — Groupe & Découverte',
  description: 'Mentions légales de l\'application Groupe & Découverte conformément à la loi LCEN du 21 juin 2004.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-primary mb-3 pb-2 border-b border-primary-100">{title}</h2>
      <div className="space-y-2 text-sm text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-2 border-b border-gray-50 last:border-0">
      <span className="font-medium text-primary-600 sm:w-48 shrink-0">{label}</span>
      <span className="text-gray-700">{value}</span>
    </div>
  );
}

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50/30">
      {/* Header */}
      <div className="bg-white border-b border-primary-100">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <nav className="text-xs text-primary-400 mb-2 flex items-center gap-1.5">
            <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-primary font-medium">Mentions légales</span>
          </nav>
          <h1 className="text-2xl font-bold text-primary">Mentions légales</h1>
          <p className="text-xs text-gray-400 mt-1">Conformes à la loi n° 2004-575 du 21 juin 2004 (LCEN)</p>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-primary-100 p-6 md:p-8">

          <Section title="1. Éditeur du site">
            <Row label="Dénomination" value="Association Groupe et Découverte" />
            <Row label="Forme juridique" value="Association loi du 1er juillet 1901" />
            <Row label="Siège social" value="3 rue Flobert — 42000 Saint-Étienne" />
            <Row label="Téléphone" value={<a href="tel:0423161671" className="text-secondary hover:underline">04 23 16 16 71</a>} />
            <Row label="Email" value={<a href="mailto:groupeetdecouverte@gmail.com" className="text-secondary hover:underline">groupeetdecouverte@gmail.com</a>} />
            <Row label="N° SIREN" value="515 225 654" />
            <Row label="Agrément Jeunesse & Sports" value="069ORG0667" />
            <Row label="Directeur de publication" value="HAMOUDI Laïd, Président de l'association" />
          </Section>

          <Section title="2. Hébergeur">
            <Row label="Dénomination" value="Hostinger International Ltd" />
            <Row label="Siège social" value="61 Lordou Vironos Street — 6023 Larnaca, Chypre" />
            <Row label="Site web" value={<a href="https://www.hostinger.fr" target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">www.hostinger.fr</a>} />
          </Section>

          <Section title="3. Propriété intellectuelle">
            <p>
              L&apos;ensemble des contenus présents sur les sites <strong>groupeetdecouverte.fr</strong> et{' '}
              <strong>app.groupeetdecouverte.fr</strong> (textes, images, logos, graphismes, vidéos, structure)
              est la propriété exclusive de l&apos;Association Groupe et Découverte ou de ses partenaires.
            </p>
            <p>
              Toute reproduction, représentation, modification ou exploitation, totale ou partielle, de ces contenus,
              par quelque procédé que ce soit, sans autorisation préalable écrite de l&apos;association, est strictement
              interdite et constitue une contrefaçon sanctionnée par les articles L. 335-2 et suivants du Code de la
              propriété intellectuelle.
            </p>
          </Section>

          <Section title="4. Responsabilité">
            <p>
              L&apos;Association Groupe et Découverte s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour
              des informations publiées sur ses sites. Toutefois, elle ne peut garantir l&apos;exhaustivité ou
              l&apos;absence d&apos;erreurs et se réserve le droit de modifier les contenus à tout moment.
            </p>
            <p>
              L&apos;association ne saurait être tenue responsable des dommages résultant de l&apos;utilisation ou de
              l&apos;impossibilité d&apos;utiliser les sites, ni des liens hypertextes pointant vers des sites tiers.
            </p>
          </Section>

          <Section title="5. Loi applicable">
            <p>
              Les présentes mentions légales sont soumises au droit français. En cas de litige, et à défaut de
              règlement amiable, les tribunaux de Saint-Étienne seront compétents.
            </p>
          </Section>

          <Section title="6. Données personnelles">
            <p>
              Pour toute information sur le traitement de vos données personnelles, consultez notre{' '}
              <Link href="/confidentialite" className="text-secondary font-medium hover:underline">
                Politique de confidentialité
              </Link>.
            </p>
          </Section>

          {/* Liens bas de page */}
          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-400">
            <Link href="/confidentialite" className="hover:text-primary transition-colors">Politique de confidentialité</Link>
            <Link href="/cgu" className="hover:text-primary transition-colors">CGU</Link>
            <Link href="/cgv" className="hover:text-primary transition-colors">CGV</Link>
            <Link href="/" className="hover:text-primary transition-colors">Retour à l&apos;accueil</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
