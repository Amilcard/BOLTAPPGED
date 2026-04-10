'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Building2, FileCheck, FileClock } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface StructureInfo {
  id: string;
  name: string;
  city: string;
  postalCode: string;
  type: string;
  email: string;
  code: string;
  rgpdAcceptedAt: string | null;
}

interface DossierCompletude {
  bulletin: boolean;
  sanitaire: boolean;
  liaison: boolean;
  renseignements: boolean;
  renseignements_required: boolean;
  pj_count: number;
}

interface Inscription {
  id: string;
  dossier_ref?: string;
  suivi_token?: string;
  jeune_prenom: string;
  jeune_nom: string;
  referent_nom: string;
  referent_email: string;
  sejour_titre: string;
  sejour_slug: string;
  status: string;
  payment_status?: string;
  price_total: number;
  created_at: string;
  dossier_completude: DossierCompletude | null;
  ged_sent_at?: string | null;
}

interface StructureData {
  structure: StructureInfo;
  inscriptions: Inscription[];
}

// ── Constantes ─────────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente', color: '#1d4ed8', bg: '#dbeafe' },
  validee:    { label: 'Validée',    color: '#166534', bg: '#dcfce7' },
  refusee:    { label: 'Refusée',    color: '#dc2626', bg: '#fee2e2' },
  annulee:    { label: 'Annulée',    color: '#6b7280', bg: '#f3f4f6' },
};

const PAYMENT: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: 'En attente', color: '#c2410c', bg: '#fff7ed' },
  paid:            { label: 'Réglé',      color: '#166534', bg: '#dcfce7' },
  failed:          { label: 'Échoué',     color: '#dc2626', bg: '#fee2e2' },
};

const TYPE_LABELS: Record<string, string> = {
  association: 'Association', ccas: 'CCAS', foyer: 'Foyer',
  pjj: 'PJJ', ase: 'ASE', mecs: 'MECS', autre: 'Autre',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      style={{ color, backgroundColor: bg }}
      className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
    >
      {label}
    </span>
  );
}

function DossierBadge({ c, gedSentAt }: { c: DossierCompletude | null; gedSentAt?: string | null }) {
  if (!c) return <span className="inline-flex items-center gap-1 text-xs text-gray-400"><FileClock size={12} /> Non commencé</span>;
  if (gedSentAt) return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700"><FileCheck size={12} /> Envoyé GED</span>;
  const required = [c.bulletin, c.sanitaire, c.liaison, ...(c.renseignements_required ? [c.renseignements] : [])];
  const done = required.filter(Boolean).length;
  const total = required.length;
  if (done === total) return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700"><FileCheck size={12} /> Complet</span>;
  return (
    <span className="text-xs font-medium text-orange-600">{done}/{total} fiches</span>
  );
}

function fmt(d: string) {
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return d; }
}

// ── Page principale ────────────────────────────────────────────────────────

export default function StructureDashboard() {
  const params = useParams();
  const code = (params?.code as string)?.toUpperCase();
  const [data, setData] = useState<StructureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [rgpdAccepted, setRgpdAccepted] = useState(false);
  const [rgpdLoading, setRgpdLoading] = useState(false);

  useEffect(() => {
    if (!code) return;
    void fetch(`/api/structure/${code}`)
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message || 'Code invalide ou structure inactive.');
        }
        return res.json() as Promise<StructureData>;
      })
      .then((d) => {
        setData(d);
        if (d.structure.rgpdAcceptedAt) setRgpdAccepted(true);
      })
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [code]);

  // ── États de chargement / erreur ──

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="text-4xl mb-4">🏢</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Code structure invalide</h1>
          <p className="text-gray-500 text-sm mb-6">
            {error || 'Ce code ne correspond à aucune structure active.'}
          </p>
          <Link
            href="/structure/login"
            className="inline-block px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition text-sm"
          >
            Réessayer
          </Link>
          <div className="mt-6 text-xs text-gray-400 space-y-1">
            <p>
              <a href="tel:0423161671" className="hover:text-primary">04 23 16 16 71</a>
              {' · '}
              <a href="mailto:contact@groupeetdecouverte.fr" className="hover:text-primary">
                contact@groupeetdecouverte.fr
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { structure, inscriptions } = data;

  // ── Gate consentement RGPD ──
  if (!rgpdAccepted) {
    const handleAcceptRgpd = async () => {
      setRgpdLoading(true);
      try {
        const res = await fetch(`/api/structure/${code}`, { method: 'POST' });
        if (res.ok) setRgpdAccepted(true);
      } catch { /* silencieux */ }
      setRgpdLoading(false);
    };

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-8">
          <div className="flex items-center gap-2 text-primary mb-4">
            <Building2 size={24} />
            <h1 className="text-xl font-bold">Engagement confidentialité</h1>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Avant d&apos;accéder aux données des inscriptions de <strong>{structure.name}</strong>, vous vous engagez à :
          </p>
          <ul className="text-sm text-gray-700 space-y-2 mb-6">
            <li className="flex gap-2"><span className="text-primary font-bold">1.</span> Utiliser ces données uniquement dans le cadre de vos fonctions professionnelles.</li>
            <li className="flex gap-2"><span className="text-primary font-bold">2.</span> Ne pas partager les informations des enfants en dehors de votre structure.</li>
            <li className="flex gap-2"><span className="text-primary font-bold">3.</span> Signaler immédiatement tout accès non autorisé à votre référent GED.</li>
            <li className="flex gap-2"><span className="text-primary font-bold">4.</span> Respecter la confidentialité des données médicales et personnelles des enfants confiés.</li>
          </ul>
          <p className="text-xs text-gray-400 mb-6">
            Conformément au RGPD et à la loi Informatique et Libertés, les données sont hébergées en France et supprimées selon la politique de conservation de GED.{' '}
            <Link href="/confidentialite" target="_blank" className="underline">Politique de confidentialité</Link> — DPO : dpo@groupeetdecouverte.fr
          </p>
          <button
            onClick={handleAcceptRgpd}
            disabled={rgpdLoading}
            className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50"
          >
            {rgpdLoading ? 'Enregistrement…' : 'J\'accepte et j\'accède aux données'}
          </button>
        </div>
      </div>
    );
  }

  // ── Stats ──

  const total     = inscriptions.length;
  const validees  = inscriptions.filter(i => i.status === 'validee').length;
  const reglees   = inscriptions.filter(i => i.payment_status === 'paid').length;
  const completes = inscriptions.filter(i => {
    if (i.ged_sent_at) return true;
    const c = i.dossier_completude;
    return c && c.bulletin && c.sanitaire && c.liaison && c.renseignements;
  }).length;

  const montantTotal = inscriptions.reduce((s, i) => s + (i.price_total || 0), 0);

  // ── Filtre ──

  const filtered = search.trim()
    ? inscriptions.filter(i =>
        `${i.jeune_prenom} ${i.jeune_nom} ${i.referent_nom} ${i.referent_email} ${i.sejour_titre} ${i.dossier_ref || ''}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : inscriptions;

  // ── Rendu ──

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Bandeau réassurance périmètre ── */}
      <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 text-xs text-blue-800 text-center">
        Vous voyez uniquement les inscriptions de votre structure. Les fiches sanitaires et documents médicaux sont accessibles uniquement par l&apos;équipe d&apos;encadrement du séjour.
      </div>

      {/* ── Header ── */}
      <header className="bg-primary text-white print:bg-white print:text-black">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={18} className="opacity-60" />
              <span className="text-xs text-white/60 font-semibold uppercase tracking-wider print:text-gray-400">
                Espace Structure
              </span>
            </div>
            <h1 className="text-xl font-bold leading-tight">{structure.name}</h1>
            <p className="text-sm text-white/60 mt-0.5 print:text-gray-500">
              {structure.city}
              {structure.postalCode ? ` — ${structure.postalCode}` : ''}
              {structure.type ? ` · ${TYPE_LABELS[structure.type] || structure.type}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-white/50 mb-1 print:text-gray-400">Code structure</p>
              <code className="text-base font-mono font-bold tracking-widest bg-white/10 px-3 py-1.5 rounded-lg print:bg-gray-100 print:text-gray-800">
                {structure.code}
              </code>
            </div>
            <button
              onClick={() => window.print()}
              className="print:hidden text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition"
            >
              Imprimer
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          {[
            { label: 'Inscriptions', value: total,      color: 'text-primary' },
            { label: 'Validées',     value: validees,   color: 'text-green-700' },
            { label: 'Réglées',      value: reglees,    color: 'text-green-700' },
            { label: 'Dossiers complets', value: completes, color: 'text-blue-700' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-3xl font-bold text-primary">{montantTotal.toLocaleString('fr-FR')} €</p>
            <p className="text-xs text-gray-500 mt-1">Montant total</p>
          </div>
        </div>

        {/* ── Recherche ── */}
        <div className="mb-4 print:hidden">
          <input
            type="text"
            placeholder="Rechercher un enfant, référent, séjour…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-80 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* ── Tableau ── */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">
            {total === 0
              ? 'Aucune inscription enregistrée pour cette structure.'
              : 'Aucun résultat pour cette recherche.'}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Date', 'Réf.', 'Jeune', 'Séjour', 'Référent', 'Documents', 'Prix', 'Paiement', 'Statut', 'Suivi'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(insc => {
                    const st = STATUS[insc.status] || STATUS.en_attente;
                    const ps = PAYMENT[insc.payment_status || 'pending_payment'] || PAYMENT.pending_payment;
                    return (
                      <tr key={insc.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(insc.created_at)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{insc.dossier_ref || '—'}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                          {insc.jeune_prenom} {insc.jeune_nom}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate" title={insc.sejour_titre}>
                          {insc.sejour_titre}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-700 whitespace-nowrap">{insc.referent_nom}</p>
                          <p className="text-xs text-gray-400">{insc.referent_email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <DossierBadge c={insc.dossier_completude} gedSentAt={insc.ged_sent_at} />
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                          {(insc.price_total || 0).toLocaleString('fr-FR')} €
                        </td>
                        <td className="px-4 py-3"><Badge {...ps} /></td>
                        <td className="px-4 py-3"><Badge {...st} /></td>
                        <td className="px-4 py-3">
                          {insc.suivi_token ? (
                            <Link href={`/suivi/${insc.suivi_token}`} className="text-xs text-primary hover:underline whitespace-nowrap">
                              Voir le dossier →
                            </Link>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {search && filtered.length < inscriptions.length && (
              <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-50">
                {filtered.length} résultat{filtered.length > 1 ? 's' : ''} sur {total}
              </div>
            )}
          </div>
        )}

        {/* ── Contact ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-8">
          <h3 className="font-semibold text-gray-800 mb-3">Contact Groupe &amp; Découverte</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Email</p>
              <p className="font-medium">contact@groupeetdecouverte.fr</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Téléphone</p>
              <p className="font-medium">04 23 16 16 71</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Horaires</p>
              <p className="font-medium">lun.–ven. 9h–17h</p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-gray-400">
          Groupe &amp; Découverte — Séjours de vacances pour enfants et adolescents
        </div>
      </main>

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          header { background: white !important; color: black !important; border-bottom: 1px solid #e5e7eb; }
          .shadow-sm { box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
