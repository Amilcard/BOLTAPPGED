'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Mountain, LogOut, Calendar, MapPin, Users, Clock, Euro, ArrowRight } from 'lucide-react';
import { getStoredAuth, clearStoredAuth, formatPrice, formatDate } from '@/lib/utils';

interface ProStay {
  id: string;
  slug: string;
  title: string;
  descriptionShort: string;
  priceFrom: number;
  durationDays: number;
  period: string;
  ageMin: number;
  ageMax: number;
  themes: string[];
  imageCover: string;
  geography: string;
  sessions: { id: string; startDate: string; endDate: string; seatsLeft: number }[];
}

export default function EspaceProPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const [userEmail, setUserEmail] = useState('');
  const [stays, setStays] = useState<ProStay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredAuth();
    if (!token) {
      setAuthState('unauthenticated');
      return;
    }
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid token');
      const payload = JSON.parse(atob(parts[1]));
      setUserEmail(payload.email || '');
      setAuthState('authenticated');
      fetchStays(token);
    } catch {
      clearStoredAuth();
      setAuthState('unauthenticated');
    }
  }, []);

  const fetchStays = async (token: string) => {
    try {
      const res = await fetch('/api/pro/stays', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStays(data);
      }
    } catch (err) {
      console.error('Fetch stays error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearStoredAuth();
    router.replace('/login');
  };

  if (authState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-primary-500">Chargement...</div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-white rounded-xl shadow-card p-8 max-w-md w-full text-center">
          <Mountain className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-primary mb-2">Espace Professionnel</h1>
          <p className="text-primary-500 mb-6">
            Les tarifs sont réservés aux professionnels (travailleurs sociaux, responsables de structure).
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-600 transition"
          >
            Se connecter <ArrowRight className="w-4 h-4" />
          </Link>
          <div className="mt-4">
            <Link href="/" className="text-sm text-primary-400 hover:text-primary">
              ← Retour au catalogue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-primary-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mountain className="w-8 h-8 text-primary" />
            <div>
              <h1 className="font-bold text-primary">Espace Professionnel</h1>
              <p className="text-xs text-primary-400">{userEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-primary-500 hover:text-primary">
              Catalogue public
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm text-primary-500 hover:text-primary transition"
            >
              <LogOut className="w-4 h-4" /> Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-primary mb-2">Nos séjours avec tarifs</h2>
          <p className="text-primary-500">Consultez les tarifs et disponibilités pour préparer vos inscriptions.</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-primary-400">Chargement des séjours...</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {stays.map((stay) => (
              <article key={stay.id} className="bg-white rounded-lg shadow-card overflow-hidden">
                <div className="relative aspect-[16/10] bg-primary-100">
                  <Image
                    src={stay.imageCover}
                    alt={stay.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute top-3 left-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      stay.period === 'printemps' 
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {stay.period === 'printemps' ? 'Printemps' : 'Été'}
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-primary text-lg mb-2">{stay.title}</h3>
                  <p className="text-sm text-primary-600 mb-3 line-clamp-2">{stay.descriptionShort}</p>

                  <div className="grid grid-cols-2 gap-2 text-xs text-primary-500 mb-3">
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>{stay.ageMin}-{stay.ageMax} ans</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{stay.durationDays} jours</span>
                    </div>
                    <div className="flex items-center gap-1 col-span-2">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">{stay.geography}</span>
                    </div>
                  </div>

                  {/* Prix visible pour PRO */}
                  <div className="flex items-center justify-between pt-3 border-t border-primary-100">
                    <div className="flex items-center gap-1 text-accent font-semibold">
                      <Euro className="w-4 h-4" />
                      <span>À partir de {formatPrice(stay.priceFrom)}</span>
                    </div>
                  </div>

                  {/* Sessions disponibles */}
                  {stay.sessions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-primary-100">
                      <p className="text-xs text-primary-400 mb-2">Prochaines sessions :</p>
                      <div className="space-y-1">
                        {stay.sessions.slice(0, 2).map((session) => (
                          <div key={session.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1 text-primary-600">
                              <Calendar className="w-3 h-3" />
                              {formatDate(session.startDate)}
                            </div>
                            <span className={session.seatsLeft > 0 ? 'text-green-600' : 'text-red-500'}>
                              {session.seatsLeft > 0 ? `${session.seatsLeft} places` : 'Complet'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Link
                    href={`/sejour/${stay.id}`}
                    className="mt-4 block text-center py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition"
                  >
                    Voir le détail
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
