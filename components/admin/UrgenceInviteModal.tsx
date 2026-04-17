'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Send, AlertCircle } from 'lucide-react';

interface Stay { id: string; slug: string; title: string; }
interface SessionPrice {
  stay_slug: string;
  start_date: string;
  end_date: string;
  city_departure: string;
  price_ged_total: number;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function UrgenceInviteModal({ onClose, onSuccess }: Props) {
  const [email, setEmail]               = useState('');
  const [stays, setStays]               = useState<Stay[]>([]);
  const [selectedStay, setSelectedStay] = useState('');
  const [sessions, setSessions]         = useState<SessionPrice[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [loading, setLoading]           = useState(false);
  const [loadingStays, setLoadingStays] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [error, setError]               = useState('');

  // Charger les séjours publiés
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/stays');
        if (res.ok) {
          const data: Stay[] = await res.json();
          setStays(data.filter((s: Stay) => s.title));
        }
      } catch { /* silent */ } finally {
        setLoadingStays(false);
      }
    };
    void load();
  }, []);

  // Charger les sessions + villes quand un séjour est sélectionné
  useEffect(() => {
    if (!selectedStay) { setSessions([]); setSelectedSession(''); return; }
    const load = async () => {
      setLoadingSessions(true);
      setSelectedSession('');
      try {
        const res = await fetch(`/api/admin/session-prices?stay_slug=${encodeURIComponent(selectedStay)}`);
        if (res.ok) {
          const data: SessionPrice[] = await res.json();
          setSessions(data);
        }
      } catch { /* silent */ } finally {
        setLoadingSessions(false);
      }
    };
    void load();
  }, [selectedStay]);

  const selectedSessionData = sessions.find(s =>
    `${s.start_date}__${s.city_departure}` === selectedSession
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !selectedStay || !selectedSession || !selectedSessionData) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/educator-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          sejour_slug:    selectedStay,
          session_date:   selectedSessionData.start_date.split('T')[0],
          city_departure: selectedSessionData.city_departure,
        }),
      });

      const data: { error?: { message?: string } } = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? 'Erreur lors de l\'envoi du lien.');
        return;
      }

      onSuccess();
    } catch {
      setError('Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="urgence-modal-title"
    >
      <div className="bg-white rounded-brand shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 id="urgence-modal-title" className="text-lg font-semibold text-primary">
            Envoyer un lien d&apos;inscription urgence
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500">
            L&apos;éducateur recevra un lien valable 24h pour inscrire un enfant. La place est en attente de validation GED.
          </p>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-brand bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Email éducateur */}
          <div>
            <label htmlFor="urgence-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email de l&apos;éducateur <span aria-hidden="true">*</span>
            </label>
            <input
              id="urgence-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="educateur@structure.fr"
              className="w-full rounded-brand border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
            />
          </div>

          {/* Séjour */}
          <div>
            <label htmlFor="urgence-sejour" className="block text-sm font-medium text-gray-700 mb-1">
              Séjour <span aria-hidden="true">*</span>
            </label>
            {loadingStays ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Chargement…
              </div>
            ) : (
              <select
                id="urgence-sejour"
                required
                value={selectedStay}
                onChange={e => setSelectedStay(e.target.value)}
                className="w-full rounded-brand border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
              >
                <option value="">— Choisir un séjour —</option>
                {stays.map(s => (
                  <option key={s.slug} value={s.slug}>{s.title}</option>
                ))}
              </select>
            )}
          </div>

          {/* Session + ville */}
          {selectedStay && (
            <div>
              <label htmlFor="urgence-session" className="block text-sm font-medium text-gray-700 mb-1">
                Session & ville de départ <span aria-hidden="true">*</span>
              </label>
              {loadingSessions ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Chargement des sessions…
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-amber-600 py-1">Aucune session avec tarif disponible pour ce séjour.</p>
              ) : (
                <select
                  id="urgence-session"
                  required
                  value={selectedSession}
                  onChange={e => setSelectedSession(e.target.value)}
                  className="w-full rounded-brand border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                >
                  <option value="">— Choisir une session —</option>
                  {sessions.map(s => {
                    const dateF = new Date(s.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
                    return (
                      <option key={`${s.start_date}__${s.city_departure}`} value={`${s.start_date}__${s.city_departure}`}>
                        {dateF} — {s.city_departure} ({s.price_ged_total.toFixed(0)} €)
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-brand border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !email || !selectedStay || !selectedSession}
              className="flex-1 flex items-center justify-center gap-2 rounded-brand bg-secondary text-white px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Envoi…</>
              ) : (
                <><Send size={15} aria-hidden="true" /> Envoyer le lien</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
