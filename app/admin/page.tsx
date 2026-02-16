'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STORAGE_KEYS } from '@/lib/utils';
import { Map, Calendar, FileText, Users } from 'lucide-react';
import { VITRINE_LINKS } from '@/config/vitrineLinks';

interface Stats {
  stays: number;
  sessions: number;
  bookings: number;
  bookingsNew: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH);

    if (!token) {
      // LOT 1: Redirect to vitrine if not authenticated (no public admin access)
      window.location.href = VITRINE_LINKS.HOME;
      return;
    }

    // Verify token is valid
    fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) {
          setIsAuthenticated(true);
          return res.json();
        }
        throw new Error('Unauthorized');
      })
      .then((data) => setStats(data))
      .catch(() => {
        // Invalid token - redirect to vitrine
        window.location.href = VITRINE_LINKS.HOME;
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-primary-500">Chargement...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  const cards = [
    { label: 'Séjours', value: stats?.stays ?? '-', icon: Map, color: 'bg-blue-500' },
    { label: 'Sessions', value: stats?.sessions ?? '-', icon: Calendar, color: 'bg-green-500' },
    { label: 'Demandes', value: stats?.bookings ?? '-', icon: FileText, color: 'bg-orange-500' },
    { label: 'Nouvelles', value: stats?.bookingsNew ?? '-', icon: Users, color: 'bg-red-500' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-primary mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl shadow p-6">
              <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center mb-4`}>
                <Icon className="text-white" size={24} />
              </div>
              <p className="text-gray-500 text-sm">{card.label}</p>
              <p className="text-3xl font-bold text-primary">{card.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
