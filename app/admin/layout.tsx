'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStoredUser, clearStoredAuth } from '@/lib/utils';
import { LayoutDashboard, Map, Calendar, FileText, Users, LogOut, Receipt, Building2, Menu, X } from 'lucide-react';
import { Logo } from '@/components/logo';
import { AdminUIProvider } from '@/components/admin/admin-ui';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/sejours', label: 'Séjours', icon: Map },
  { href: '/admin/sessions', label: 'Sessions', icon: Calendar },
  { href: '/admin/demandes', label: 'Demandes', icon: FileText },
  { href: '/admin/propositions', label: 'Propositions', icon: Receipt },
  { href: '/admin/structures', label: 'Structures', icon: Building2 },
  { href: '/admin/users', label: 'Utilisateurs', icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const user = getStoredUser();
      if (!user) {
        setAuthState('unauthenticated');
        return;
      }
      setUserRole(user.role);
      setAuthState('authenticated');
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

  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (authState !== 'authenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Logo variant="compact" />
          <div>
            <h1 className="text-lg font-bold">Admin</h1>
            <p className="text-xs text-white/70">{userRole}</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          if (item.href === '/admin/users' && userRole !== 'ADMIN') return null;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
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
    </>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-primary text-white flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Logo variant="compact" />
          <span className="font-bold">Admin</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={sidebarOpen}
          className="p-2 rounded-lg hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — drawer on mobile, fixed on desktop */}
      <aside className={`
        fixed z-40 top-0 left-0 h-full w-64 bg-primary text-white flex flex-col transition-transform duration-200
        md:sticky md:top-0 md:translate-x-0 md:h-screen
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Close button visible only on mobile inside drawer */}
        <div className="md:hidden flex justify-end p-2">
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer le menu"
            className="p-2 rounded-lg hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>
        {sidebarContent}
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-auto mt-14 md:mt-0">
        <AdminUIProvider>{children}</AdminUIProvider>
      </main>
    </div>
  );
}
