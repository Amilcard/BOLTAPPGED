'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStoredAuth, clearStoredAuth } from '@/lib/utils';
import { LayoutDashboard, Map, Calendar, FileText, Users, LogOut } from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/sejours', label: 'Séjours', icon: Map },
  { href: '/admin/sessions', label: 'Sessions', icon: Calendar },
  { href: '/admin/demandes', label: 'Demandes', icon: FileText },
  { href: '/admin/users', label: 'Utilisateurs', icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const token = getStoredAuth();
      if (!token) {
        setAuthState('unauthenticated');
        return;
      }
      try {
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Invalid token');
        const payload = JSON.parse(atob(parts[1]));
        if (!payload.role) throw new Error('Missing role');
        setUserRole(payload.role);
        setAuthState('authenticated');
      } catch {
        clearStoredAuth();
        setAuthState('unauthenticated');
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (authState === 'unauthenticated') {
      router.replace('/login');
    }
  }, [authState, router]);

  const handleLogout = () => {
    clearStoredAuth();
    router.replace('/login');
  };

  if (authState !== 'authenticated') {
    return <div className="flex items-center justify-center min-h-screen">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-64 bg-primary text-white flex flex-col">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-bold">G&D Admin</h1>
          <p className="text-sm text-white/70 mt-1">{userRole}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            if (item.href === '/admin/users' && userRole !== 'ADMIN') return null;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition"
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg hover:bg-white/10 transition"
          >
            <LogOut size={20} />
            Déconnexion
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
