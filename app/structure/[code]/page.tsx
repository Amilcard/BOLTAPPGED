'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Building2 } from 'lucide-react';
import StructureAdminTab from '@/components/structure/StructureAdminTab';
import StructureEduTab from '@/components/structure/StructureEduTab';

// ── Types ──────────────────────────────────────────────────────────────────

interface StructureInfo {
  id: string;
  name: string;
  city: string;
  postalCode: string;
  type: string;
  email: string;
  code?: string;
  rgpdAcceptedAt: string | null;
  delegationFrom:  string | null;
  delegationUntil: string | null;
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
  besoins_specifiques?: string | null;
}

interface StructureData {
  structure: StructureInfo;
  role: 'direction' | 'cds' | 'cds_delegated' | 'secretariat' | 'educateur';
  roles: string[];
  accessEmail: string | null;
  inscriptions: Inscription[];
}

// ── Constantes ─────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  association: 'Association', ccas: 'CCAS', foyer: 'Foyer',
  pjj: 'PJJ', ase: 'ASE', mecs: 'MECS', autre: 'Autre',
};

// ── Page principale ────────────────────────────────────────────────────────

export default function StructureDashboard() {
  const params = useParams();
  const code = (params?.code as string)?.toUpperCase();
  const [data, setData] = useState<StructureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<'direction' | 'cds' | 'cds_delegated' | 'secretariat' | 'educateur' | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'admin' | 'educatif'>('admin');
  const [delegFrom,  setDelegFrom]  = useState('');
  const [delegUntil, setDelegUntil] = useState('');
  const [delegSaving, setDelegSaving] = useState(false);
  const [delegMsg,    setDelegMsg]    = useState<string | null>(null);
  const [emailEdit,   setEmailEdit]   = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg,    setEmailMsg]    = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterSejour, setFilterSejour] = useState('');
  const [filterDossier, setFilterDossier] = useState<'all' | 'complet' | 'en_attente' | 'ged_sent'>('all');
  const [rgpdAccepted, setRgpdAccepted] = useState(false);
  const [incidentCounts, setIncidentCounts] = useState<Record<string, number>>({});
  const [callsCount, setCallsCount] = useState(0);
  const [notesCount, setNotesCount] = useState(0);
  const [medicalCount, setMedicalCount] = useState(0);
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
        setRole(d.role);
        setRoles(d.roles || [d.role]);
        if (d.role === 'educateur') setActiveTab('educatif');
        if (d.structure.rgpdAcceptedAt) setRgpdAccepted(true);
        if (d.structure.delegationFrom)  setDelegFrom(d.structure.delegationFrom.slice(0, 10));
        if (d.structure.delegationUntil) setDelegUntil(d.structure.delegationUntil.slice(0, 10));
        if (d.structure.email) setEmailEdit(d.structure.email);
      })
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [code]);

  // Fetch incidents pour KPI + bilan
  useEffect(() => {
    if (!code || !data) return;
    void fetch(`/api/structure/${code}/incidents`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(d => {
        if (!d?.incidents) return;
        const counts: Record<string, number> = {};
        for (const inc of d.incidents as Array<{ inscription_id: string; status: string }>) {
          if (inc.status !== 'resolu') {
            counts[inc.inscription_id] = (counts[inc.inscription_id] || 0) + 1;
          }
        }
        setIncidentCounts(counts);
      })
      .catch(() => {});

    Promise.all([
      fetch(`/api/structure/${code}/calls`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch(`/api/structure/${code}/notes`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch(`/api/structure/${code}/medical`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    ]).then(([callsData, notesData, medData]) => {
      setCallsCount(callsData?.calls?.length ?? 0);
      setNotesCount(notesData?.notes?.length ?? 0);
      setMedicalCount(medData?.count ?? 0);
    }).catch(() => {});
  }, [code, data]);

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
          <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4"><Building2 className="w-7 h-7 text-primary" /></div>
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
            <h2 className="text-xl font-bold">Engagement confidentialité</h2>
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

  // ── Données dérivées (filtres admin) ──

  const sejoursUniques = [...new Set(inscriptions.map(i => i.sejour_titre).filter(Boolean))].sort();

  const filtered = inscriptions.filter(i => {
    if (search.trim() && !`${i.jeune_prenom} ${i.jeune_nom} ${i.referent_nom} ${i.referent_email} ${i.sejour_titre} ${i.dossier_ref || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSejour && i.sejour_titre !== filterSejour) return false;
    if (filterDossier === 'ged_sent' && !i.ged_sent_at) return false;
    if (filterDossier === 'complet' && !i.ged_sent_at) {
      const c = i.dossier_completude;
      if (!c || !c.bulletin || !c.sanitaire || !c.liaison || !c.renseignements) return false;
    }
    if (filterDossier === 'en_attente') {
      if (i.ged_sent_at) return false;
      const c = i.dossier_completude;
      const isComplete = c && c.bulletin && c.sanitaire && c.liaison && c.renseignements;
      if (isComplete) return false;
    }
    return true;
  });

  // ── Rendu ──

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Bandeau réassurance périmètre ── */}
      <div className="bg-muted border-b border-primary-100 px-4 py-2.5 text-xs text-primary text-center">
        Vous accédez aux données des enfants de votre structure. Les fiches sanitaires et documents médicaux sont accessibles uniquement par l&apos;équipe d&apos;encadrement du séjour.
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
              {role === 'direction' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-amber-900 uppercase tracking-wide">Direction</span>
              )}
              {role === 'cds' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white uppercase tracking-wide">Chef de service</span>
              )}
              {role === 'cds_delegated' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-amber-900 uppercase tracking-wide">CDS · Délégation</span>
              )}
              {role === 'secretariat' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-700 uppercase tracking-wide">Secrétariat</span>
              )}
              {role === 'educateur' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-200 text-blue-800 uppercase tracking-wide">Éducateur</span>
              )}
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
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* ── Onglets Admin / Éducatif ── */}
        {(roles.includes('direction') || roles.includes('cds') || roles.includes('educateur') || roles.includes('secretariat')) && (
          <div className="flex border-b border-gray-200 mb-6 print:hidden">
            {(roles.includes('admin') || roles.includes('direction') || roles.includes('cds') || roles.includes('secretariat')) && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'admin' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Administratif
              </button>
            )}
            {(roles.includes('educatif') || roles.includes('direction') || roles.includes('cds') || roles.includes('educateur')) && role !== 'secretariat' && (
              <button
                onClick={() => setActiveTab('educatif')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'educatif' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Suivi éducatif
              </button>
            )}
          </div>
        )}

        {/* ── Contenu onglet Éducatif ── */}
        {activeTab === 'educatif' && (
          <StructureEduTab
            code={code}
            role={role}
            inscriptions={inscriptions}
            incidentCounts={incidentCounts}
            callsCount={callsCount}
            notesCount={notesCount}
            medicalCount={medicalCount}
          />
        )}

        {/* ── Contenu onglet Administratif ── */}
        {activeTab === 'admin' && (
          <StructureAdminTab
            inscriptions={inscriptions}
            filtered={filtered}
            structure={structure}
            code={code}
            role={role}
            search={search}
            setSearch={setSearch}
            filterSejour={filterSejour}
            setFilterSejour={setFilterSejour}
            filterDossier={filterDossier}
            setFilterDossier={setFilterDossier}
            sejoursUniques={sejoursUniques}
            delegFrom={delegFrom}
            setDelegFrom={setDelegFrom}
            delegUntil={delegUntil}
            setDelegUntil={setDelegUntil}
            delegSaving={delegSaving}
            setDelegSaving={setDelegSaving}
            delegMsg={delegMsg}
            setDelegMsg={setDelegMsg}
            emailEdit={emailEdit}
            setEmailEdit={setEmailEdit}
            emailSaving={emailSaving}
            setEmailSaving={setEmailSaving}
            emailMsg={emailMsg}
            setEmailMsg={setEmailMsg}
          />
        )}

        {/* ── Contact (commun aux deux onglets) ── */}
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

      {/* Print styles handled by Tailwind print: utilities on individual elements */}
    </div>
  );
}
