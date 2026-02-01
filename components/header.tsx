'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from './providers';
import { Logo } from './logo';
import { VITRINE_LINKS } from '@/config/vitrineLinks';
import { Users, Baby, Menu, X, RotateCcw, ArrowLeft, FileText, Mail } from 'lucide-react';

// LOT GRAPHISME 1: App is search-only engine - no internal nav
// All links in minimal header point to VITRINE_LINKS (external)
const vitrineLinks = [
  { label: 'Retour au site', route: VITRINE_LINKS.HOME, icon: ArrowLeft },
  { label: 'Demande individualisée', route: VITRINE_LINKS.DEMANDE, icon: FileText },
  { label: 'Contact', route: VITRINE_LINKS.CONTACT, icon: Mail },
];

interface HeaderProps {
  variant?: 'default' | 'minimal';
}

export function Header({ variant = 'minimal' }: HeaderProps) {
  const { mode, setMode, reset, mounted, isAuthenticated, authUser } = useApp();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // LOT GRAPHISME 1: App uses minimal header only, force minimal variant
  const isMinimal = variant === 'minimal' || true; // Always minimal for search-only app

  // Admin link - only visible in authenticated context on admin page
  const isAdminPage = pathname?.startsWith('/admin');
  const showAdminLink = isAuthenticated && authUser && isAdminPage;

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4">
        <div className="h-16 flex items-center justify-between gap-4">
          {/* Logo - links to / which redirects to /sejours */}
          <Link href="/" className="flex-shrink-0 hover:opacity-90 transition-opacity">
            <Logo variant="default" className="hidden sm:flex" />
            <Logo variant="compact" className="flex sm:hidden" />
          </Link>

          {/* Desktop Navigation - Vitrine links only */}
          <nav className="hidden lg:flex items-center gap-1">
            {vitrineLinks.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.route}
                  href={item.route}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-all flex items-center gap-2"
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </a>
              );
            })}
            {/* Admin link in vitrine nav - only when on admin page */}
            {showAdminLink && (
              <Link
                href="/admin"
                className="px-4 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/50 transition-all"
              >
                Admin
              </Link>
            )}
          </nav>

          {/* Right Section: Mode Toggle + Mobile Menu */}
          <div className="flex items-center gap-2">
            {/* Pro/Kids Toggle */}
            {mounted && (
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setMode('pro')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all ${
                    mode === 'pro'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Pro</span>
                </button>
                <button
                  onClick={() => setMode('kids')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all ${
                    mode === 'kids'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Baby className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Kids</span>
                </button>
              </div>
            )}

            {/* Reset button (desktop only) */}
            {mounted && (
              <button
                onClick={reset}
                className="hidden sm:flex p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                title="Réinitialiser"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu - Vitrine links only */}
        {mobileMenuOpen && (
          <nav className="lg:hidden py-4 border-t border-gray-200 animate-in slide-in-from-top">
            <div className="flex flex-col gap-1">
              {vitrineLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.route}
                    href={item.route}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-3 transition-all"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </a>
                );
              })}
              {/* Admin link in mobile menu */}
              {showAdminLink && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-3 rounded-lg text-sm font-medium text-primary hover:bg-primary/50 transition-all"
                >
                  Admin
                </Link>
              )}
              {/* Reset in mobile menu */}
              {mounted && (
                <button
                  onClick={() => {
                    reset();
                    setMobileMenuOpen(false);
                  }}
                  className="px-4 py-3 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 text-left flex items-center gap-2 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  Réinitialiser
                </button>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
