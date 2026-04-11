'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mountain, ArrowLeft, Loader2 } from 'lucide-react';
import { getStoredAuth, setStoredUser } from '@/lib/utils';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isProContext = searchParams.get('context') === 'pro';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // 2FA
  const [requires2fa, setRequires2fa] = useState(false);
  const [pendingToken, setPendingToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  // Reset password
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (getStoredAuth()) router.replace('/admin');
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Identifiants incorrects');

      if (data.requires2fa) {
        setPendingToken(data.pendingToken);
        setRequires2fa(true);
        return;
      }

      if (data?.user) setStoredUser(data.user);
      router.replace('/admin');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handle2faSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, code: totpCode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Code invalide');

      if (data?.user) setStoredUser(data.user);
      router.replace('/admin');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de vérification');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Saisissez votre email ci-dessus.'); return; }
    setResetLoading(true);
    setError('');

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) { setError('Configuration Supabase manquante.'); return; }
      const supabase = createClient(url, key);
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login/reset`,
      });
      if (err) throw err;
      setResetSent(true);
    } catch {
      setError('Erreur lors de l\'envoi. Vérifiez l\'email saisi.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-1 text-primary-500 text-sm mb-6 hover:text-primary">
          <ArrowLeft className="w-4 h-4" /> Retour au site
        </Link>

        <div className="bg-white rounded-xl shadow-card p-8">
          <div className="flex items-center gap-2 text-primary mb-6">
            <Mountain className="w-8 h-8" />
            <span className="text-xl font-bold">
              {isProContext ? 'Espace professionnel' : 'Administration'}
            </span>
          </div>
          {isProContext && (
            <p className="text-sm text-primary-600 mb-4">
              Connectez-vous pour inscrire un enfant sur ce séjour.
            </p>
          )}

          {resetSent ? (
            <div className="text-center space-y-4">
              <div className="p-4 bg-primary-50 text-primary rounded-lg text-sm">
                Email envoyé à <strong>{email}</strong>.<br />
                Vérifiez votre boîte mail et cliquez le lien pour réinitialiser votre mot de passe.
              </div>
              <button
                onClick={() => { setResetMode(false); setResetSent(false); }}
                className="text-sm text-primary hover:underline"
              >
                Retour à la connexion
              </button>
            </div>
          ) : resetMode ? (
            <form onSubmit={handleReset} className="space-y-4">
              <p className="text-sm text-gray-600">
                Saisissez votre email et nous vous enverrons un lien de réinitialisation.
              </p>
              <div>
                <label className="block text-sm font-medium text-primary-600 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-primary-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              {error && (
                <div role="alert" className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
              )}
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {resetLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {resetLoading ? 'Envoi...' : 'Envoyer le lien'}
              </button>
              <button
                type="button"
                onClick={() => { setResetMode(false); setError(''); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Retour à la connexion
              </button>
            </form>
          ) : !requires2fa ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-600 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-primary-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-600 mb-1">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-primary-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>

              {error && (
                <div role="alert" className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>

              <button
                type="button"
                onClick={() => { setResetMode(true); setError(''); }}
                className="w-full text-sm text-gray-500 hover:text-primary transition-colors"
              >
                Mot de passe oublié ?
              </button>
            </form>
          ) : (
            <form onSubmit={handle2faSubmit} className="space-y-4">
              <p className="text-sm text-primary-600 mb-2">
                Saisissez le code à 6 chiffres de votre application d&apos;authentification.
              </p>
              <div>
                <label className="block text-sm font-medium text-primary-600 mb-1">Code 2FA</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  className="w-full px-4 py-3 border border-primary-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-center text-xl tracking-widest"
                  placeholder="000000"
                />
              </div>

              {error && (
                <div role="alert" className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
              )}

              <button
                type="submit"
                disabled={loading || totpCode.length !== 6}
                className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Vérification...' : 'Vérifier'}
              </button>

              <button
                type="button"
                onClick={() => { setRequires2fa(false); setPendingToken(''); setError(''); }}
                className="w-full text-sm text-primary-500 hover:text-primary"
              >
                Retour à la connexion
              </button>
            </form>
          )}
          {isProContext && (
            <p className="text-xs text-gray-500 mt-4 text-center">
              Pas encore de compte professionnel ?{' '}
              <a href="mailto:contact@groupeetdecouverte.fr" className="underline hover:text-primary">
                Contactez-nous : contact@groupeetdecouverte.fr
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
