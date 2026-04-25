'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { UUID_RE } from '@/lib/validators';

export default function ActivateClient() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Lien invalide : token manquant.');
      return;
    }
    if (!UUID_RE.test(token)) {
      setError('Lien invalide : format token incorrect.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // Validation séquentielle : on pointe la PREMIÈRE règle qui manque
    // (feedback précis, sinon l'utilisateur ne sait pas laquelle corriger).
    // Regex dupliquées ici pour éviter d'importer `lib/password.ts` côté
    // client (risque de bundle bcrypt/argon2).
    const rules = [
      { ok: password.length >= 12, msg: 'Au moins 12 caractères.' },
      { ok: /[a-z]/.test(password), msg: 'Au moins une minuscule.' },
      { ok: /[A-Z]/.test(password), msg: 'Au moins une majuscule.' },
      { ok: /[0-9]/.test(password), msg: 'Au moins un chiffre.' },
    ];
    const firstFail = rules.find(r => !r.ok);
    if (firstFail) { setError(firstFail.msg); return; }
    const samePwd = password.length === confirm.length
      && Array.from(password).every((c, i) => c === confirm[i]);
    if (!samePwd) { setError('Les mots de passe ne correspondent pas.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/activate-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, prenom: prenom.trim() || undefined, nom: nom.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || 'Impossible d\'activer ce compte.');
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push('/structure/login'), 2000);
    } catch {
      setError('Erreur réseau. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="bg-white rounded-brand shadow-card p-8 max-w-md text-center">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-primary mb-2">Compte activé</h1>
          <p className="text-gray-600 mb-4">Vous allez être redirigé vers la connexion…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="bg-white rounded-brand shadow-card p-8 max-w-md w-full">
        <h1 className="text-xl font-bold text-primary mb-2">Activer votre accès</h1>
        <p className="text-sm text-gray-600 mb-6">Définissez un mot de passe personnel. Ne le partagez avec personne.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Prénom</label>
              <input type="text" value={prenom} onChange={e => setPrenom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Nom</label>
              <input type="text" value={nom} onChange={e => setNom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Mot de passe <span className="text-red-500">*</span></label>
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); if (error) setError(''); }} required autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary" />
            <p className="text-xs text-gray-400 mt-1">12 caractères min, 1 majuscule, 1 minuscule, 1 chiffre.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Confirmer <span className="text-red-500">*</span></label>
            <input type="password" value={confirm} onChange={e => { setConfirm(e.target.value); if (error) setError(''); }} required autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-secondary" />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-brand text-sm" role="alert">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <button type="submit" disabled={loading || !token || !!error}
            className="w-full py-3 bg-secondary text-white rounded-pill font-medium hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Activation…' : 'Activer mon compte'}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Lien expiré ? <Link href="/structure/login" className="underline">Demandez une réinvitation</Link>
        </p>
      </div>
    </div>
  );
}
