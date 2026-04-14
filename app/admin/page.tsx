'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Map, Calendar, FileText, Users } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

interface Stats {
  stays: number;
  sessions: number;
  bookings: number;
  bookingsNew: number;
  byStatus?: Record<string, number>;
  recentDays?: { date: string; count: number }[];
  topSejours?: { slug: string; label: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  en_attente: '#f59e0b',
  validee: '#16a34a',
  refusee: '#dc2626',
  annulee: '#6b7280',
};

const STATUS_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  validee: 'Validée',
  refusee: 'Refusée',
  annulee: 'Annulée',
};

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/admin/stats')
      .then((res) => {
        if (res.ok) {
          setIsAuthenticated(true);
          return res.json();
        }
        if (res.status === 401) {
          throw new Error('Unauthorized');
        }
        // Erreur serveur (500)
        setIsAuthenticated(true);
        setError(`Erreur serveur (${res.status}). Les statistiques sont temporairement indisponibles.`);
        return null;
      })
      .then((data) => { if (data) setStats(data); })
      .catch(() => {
        void router.replace('/login');
      })
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Init unique au montage — router est stable (useRouter)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-primary-500">Chargement...</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-xl mx-auto" role="alert">
          <p className="font-semibold text-red-800 mb-1">Erreur</p>
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={() => { setError(null); window.location.reload(); }} className="mt-4 text-sm px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition">Réessayer</button>
        </div>
      </div>
    );
  }

  const cards = [
    { label: 'Séjours', value: stats?.stays ?? '-', icon: Map, color: 'bg-primary' },
    { label: 'Sessions', value: stats?.sessions ?? '-', icon: Calendar, color: 'bg-accent' },
    { label: 'Demandes', value: stats?.bookings ?? '-', icon: FileText, color: 'bg-secondary' },
    { label: 'Nouvelles', value: stats?.bookingsNew ?? '-', icon: Users, color: 'bg-red-500' },
  ];

  // Données pie chart
  const pieData = stats?.byStatus
    ? Object.entries(stats.byStatus)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
          name: STATUS_LABELS[key] || key,
          value,
          color: STATUS_COLORS[key] || '#9ca3af',
        }))
    : [];

  // Données bar chart (7 jours)
  const barData = (stats?.recentDays || []).map((d) => ({
    date: new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
    inscriptions: d.count,
  }));

  return (
    <div>
      <h1 className="text-3xl font-bold text-primary mb-8">Dashboard</h1>

      {/* Cartes compteurs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-brand shadow-card p-6">
              <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center mb-4`}>
                <Icon className="text-white" size={24} />
              </div>
              <p className="text-gray-500 text-sm">{card.label}</p>
              <p className="text-3xl font-bold text-primary">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        {/* Répartition par statut */}
        {pieData.length > 0 && (
          <div className="bg-white rounded-brand shadow-card p-6">
            <h2 className="font-semibold text-primary mb-4">Répartition par statut</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, value }) => `${name} (${value})`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Inscriptions 7 derniers jours */}
        {barData.length > 0 && (
          <div className="bg-white rounded-brand shadow-card p-6">
            <h2 className="font-semibold text-primary mb-4">Inscriptions (7 derniers jours)</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                {/* primary token from tailwind.config.ts */}
                <Bar dataKey="inscriptions" fill="#2a383f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top séjours */}
      {stats?.topSejours && stats.topSejours.length > 0 && (
        <div className="bg-white rounded-brand shadow-card p-6">
          <h2 className="font-semibold text-primary mb-4">Top 5 séjours les plus demandés</h2>
          <div className="space-y-3">
            {stats.topSejours.map((s, i) => (
              <div key={s.slug} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm capitalize">{s.label}</span>
                <span className="font-bold text-primary">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
