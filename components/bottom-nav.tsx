'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Search, Info, Briefcase, Heart } from 'lucide-react';
import { useApp } from './providers';

const proNavItems = [
  { key: 'home', label: 'Accueil', route: '/', icon: Home },
  { key: 'search', label: 'Recherche', route: '/sejours', icon: Search },
  { key: 'help', label: 'Infos', route: '/infos', icon: Info },
  { key: 'pro', label: 'Espace pro', route: '/espace-pro', icon: Briefcase },
];

const kidsNavItems = [
  { key: 'home', label: 'Accueil', route: '/', icon: Home },
  { key: 'search', label: 'Recherche', route: '/recherche', icon: Search },
  { key: 'help', label: 'Infos', route: '/infos', icon: Info },
  { key: 'envies', label: 'Mes souhaits', route: '/envies', icon: Heart },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, mounted, wishlist } = useApp();

  // Cacher sur les routes admin
  if (pathname?.startsWith('/admin')) return null;

  const navItems = mode === 'kids' ? kidsNavItems : proNavItems;

  const handleClick = (item: typeof navItems[0]) => {
    router.push(item.route);
  };

  const isActive = (route: string) => {
    if (route === '/') return pathname === '/';
    return pathname?.startsWith(route);
  };

  if (!mounted) return <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden pb-safe h-16" />;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden pb-safe">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.route);
          const showBadge = item.key === 'envies' && wishlist.length > 0;
          return (
            <button
              key={item.key}
              onClick={() => handleClick(item)}
              className={`relative flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                active ? 'text-primary' : 'text-gray-500 hover:text-primary'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${item.key === 'envies' && active ? 'fill-current' : ''}`} />
                {showBadge && (
                  <span className="absolute -top-1 -right-2 w-4 h-4 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {wishlist.length > 9 ? '9+' : wishlist.length}
                  </span>
                )}
              </div>
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
