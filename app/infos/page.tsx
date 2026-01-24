import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { Shield, Users, Phone, Mail, MapPin, Compass, Heart } from 'lucide-react';

export default function InfosPage() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-primary mb-8">Informations pratiques</h1>

        {/* Nos engagements - moved from home */}
        <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-primary mb-6">Nos engagements</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Compass className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-medium text-primary mb-1">Découverte</h3>
              <p className="text-sm text-gray-600">Activités variées pour éveiller la curiosité</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-medium text-primary mb-1">Sécurité</h3>
              <p className="text-sm text-gray-600">Encadrement qualifié et structures agréées</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Heart className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="font-medium text-primary mb-1">Bienveillance</h3>
              <p className="text-sm text-gray-600">Approche adaptée à chaque enfant</p>
            </div>
          </div>
        </section>

        {/* Sécurité */}
        <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-primary">Sécurité et qualité</h2>
          </div>
          <div className="text-gray-600 space-y-3">
            <p>Tous nos séjours sont agréés par le Ministère de l’Éducation Nationale et de la Jeunesse.</p>
            <p>Nous respectons scrupuleusement les normes en vigueur concernant l’hébergement, le transport et l’encadrement des mineurs.</p>
            <p>Nos équipes sont formées aux premiers secours et un protocole d’urgence est en place sur chaque séjour.</p>
          </div>
        </section>

        {/* Encadrement */}
        <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <h2 className="text-xl font-semibold text-primary">Encadrement</h2>
          </div>
          <div className="text-gray-600 space-y-3">
            <p>Nos équipes sont composées d’animateurs diplômés (BAFA, BAFD) et de professionnels spécialisés selon les activités.</p>
            <p>Taux d’encadrement : 1 animateur pour 8 enfants (6-10 ans) ou 1 pour 12 adolescents (11-17 ans).</p>
            <p>Un directeur de séjour et un assistant sanitaire sont présents en permanence.</p>
          </div>
        </section>

        {/* Contact */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Phone className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-primary">Contact</h2>
          </div>
          <div className="text-gray-600 space-y-4">
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400" />
              <span>01 23 45 67 89 (du lundi au vendredi, 9h-18h)</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <span>contact@groupe-decouverte.fr</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-gray-400" />
              <span>123 rue des Vacances, 75001 Paris</span>
            </div>
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
