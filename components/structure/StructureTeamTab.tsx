'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, UserPlus, Trash2, Send, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface Member {
  id: string;
  email: string;
  role: 'secretariat' | 'educateur';
  prenom: string | null;
  nom: string | null;
  status: 'pending' | 'active' | 'expired';
  activated_at: string | null;
  created_at: string;
}

interface Props {
  code: string;
}

export default function StructureTeamTab({ code }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePrenom, setInvitePrenom] = useState('');
  const [inviteRole, setInviteRole] = useState<'secretariat' | 'educateur'>('secretariat');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  // C3 fix : rate-limit côté serveur (429) → désactiver le formulaire jusqu'à expiration.
  // Sécurité : ne révèle pas la durée exacte (5 min par défaut côté back).
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);
  const isRateLimited = rateLimitedUntil !== null && Date.now() < rateLimitedUntil;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/structure/${code}/team`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error?.code || 'ERROR');
      setMembers(data.members || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger l\'équipe.');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => { void load(); }, [load]);

  // C3 fix : forcer re-render à expiration du rate-limit pour réactiver le formulaire sans
  // que l'utilisateur ait à cliquer ou rafraîchir la page.
  useEffect(() => {
    if (rateLimitedUntil === null) return;
    const remaining = rateLimitedUntil - Date.now();
    if (remaining <= 0) { setRateLimitedUntil(null); return; }
    const id = setTimeout(() => setRateLimitedUntil(null), remaining);
    return () => clearTimeout(id);
  }, [rateLimitedUntil]);

  const invite = async () => {
    setInviting(true);
    setError('');
    setActionMsg('');
    try {
      const res = await fetch(`/api/structure/${code}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), prenom: invitePrenom.trim() || undefined, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        // C3 fix : sur 429, lire Retry-After si présent (sinon défaut 5 min) et désactiver
        // le formulaire jusqu'à expiration pour éviter les clics répétés inutiles.
        if (res.status === 429) {
          const retryAfterRaw = res.headers.get('Retry-After');
          const retryAfterSec = retryAfterRaw ? parseInt(retryAfterRaw, 10) : NaN;
          const cooldownMs = (Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec : 300) * 1000;
          setRateLimitedUntil(Date.now() + cooldownMs);
        }
        setError(data?.error?.message || data?.error?.code || 'Erreur invitation');
        return;
      }
      setInviteEmail(''); setInvitePrenom(''); setInviteOpen(false);
      setActionMsg(data.emailSent === false
        ? 'Membre invité — attention : email non envoyé (vérifier configuration).'
        : 'Invitation envoyée.');
      await load();
    } finally { setInviting(false); }
  };

  const revoke = async (id: string) => {
    if (!confirm('Révoquer cet accès ?')) return;
    setError('');
    setActionMsg('');
    const res = await fetch(`/api/structure/${code}/team/${id}/revoke`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error?.message || data?.error?.code || 'Erreur révocation');
      return;
    }
    setActionMsg('Accès révoqué.');
    await load();
  };

  const reinvite = async (id: string) => {
    setError('');
    setActionMsg('');
    const res = await fetch(`/api/structure/${code}/team/${id}/reinvite`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error?.message || data?.error?.code || 'Erreur réinvitation');
      return;
    }
    setActionMsg('Nouvelle invitation envoyée.');
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-primary">Équipe de la structure</h2>
        <button onClick={() => setInviteOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-secondary text-white rounded-pill text-sm font-medium hover:bg-secondary/90">
          <UserPlus className="w-4 h-4" /> Inviter
        </button>
      </div>

      {actionMsg && (
        <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm" role="status">{actionMsg}</div>
      )}
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm" role="alert">{error}</div>
      )}

      {inviteOpen && (
        <div className="bg-white border border-gray-200 rounded-brand p-4 space-y-3">
          <h3 className="font-semibold text-primary">Nouvelle invitation</h3>
          <input type="email" placeholder="Email pro" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            disabled={isRateLimited}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary disabled:opacity-50 disabled:cursor-not-allowed" />
          <input type="text" placeholder="Prénom (optionnel)" value={invitePrenom} onChange={e => setInvitePrenom(e.target.value)}
            disabled={isRateLimited}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary disabled:opacity-50 disabled:cursor-not-allowed" />
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'secretariat' | 'educateur')}
            disabled={isRateLimited}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
            <option value="secretariat">Secrétariat</option>
            <option value="educateur">Éducateur</option>
          </select>
          <div className="flex gap-2">
            <button onClick={() => { setInviteOpen(false); setError(''); }} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm">Annuler</button>
            <button onClick={invite} disabled={inviting || !inviteEmail || isRateLimited}
              className="flex-1 py-2 bg-secondary text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              {inviting ? 'Envoi…' : isRateLimited ? 'Patientez…' : 'Envoyer l\'invitation'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : members.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">Aucun membre invité pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-brand p-4">
              <div>
                <p className="font-medium text-primary">
                  {m.prenom || m.nom ? `${m.prenom || ''} ${m.nom || ''}`.trim() : m.email}
                </p>
                <p className="text-xs text-gray-500">{m.email} · {m.role === 'secretariat' ? 'Secrétariat' : 'Éducateur'}</p>
              </div>
              <div className="flex items-center gap-3">
                {m.status === 'active' && <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full"><CheckCircle2 className="w-3 h-3" />Actif</span>}
                {m.status === 'pending' && <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-full"><Clock className="w-3 h-3" />En attente</span>}
                {m.status === 'expired' && <span className="flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-1 rounded-full"><XCircle className="w-3 h-3" />Expiré</span>}
                {m.status !== 'active' && (
                  <button onClick={() => reinvite(m.id)} title="Renvoyer invitation" className="text-primary hover:text-primary/80">
                    <Send className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => revoke(m.id)} title="Révoquer" className="text-red-600 hover:text-red-800">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
