/**
 * Tests composant — BottomNav
 *
 * Vérifie :
 * - items affichés selon le mode (Kids / Pro)
 * - absence de l'ancien item "Infos" (retiré)
 * - masquage sur /admin
 * - skeleton avant hydratation (mounted = false)
 * - isActive par route (exact match / prefix / /suivi/*)
 * - badge wishlist (count, 9+, absent en Pro)
 * - navigation au clic (router.push)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/components/providers', () => ({
  useApp: jest.fn(),
}));

import { usePathname } from 'next/navigation';
import { useApp } from '@/components/providers';
import { BottomNav } from '@/components/bottom-nav';

const mockPathname = usePathname as jest.Mock;
const mockUseApp   = useApp as jest.Mock;

function setup(opts: {
  mode?: 'kids' | 'pro';
  mounted?: boolean;
  wishlist?: string[];
  pathname?: string;
} = {}) {
  const { mode = 'pro', mounted = true, wishlist = [], pathname = '/' } = opts;
  mockPathname.mockReturnValue(pathname);
  mockUseApp.mockReturnValue({ mode, mounted, wishlist });
  mockPush.mockClear();
}

// Helper : trouve le bouton dont le textContent contient le label
function btn(label: string) {
  return screen.getAllByRole('button').find(b => b.textContent?.includes(label));
}

// ─────────────────────────────────────────────────────
describe('BottomNav — items mode Pro', () => {
  beforeEach(() => setup({ mode: 'pro' }));

  it('affiche Accueil, Recherche, Dossiers', () => {
    render(<BottomNav />);
    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(screen.getByText('Recherche')).toBeInTheDocument();
    expect(screen.getByText('Dossiers')).toBeInTheDocument();
  });

  it('ne contient pas "Infos" (item retiré)', () => {
    render(<BottomNav />);
    expect(screen.queryByText('Infos')).toBeNull();
  });

  it('ne contient pas "Mes souhaits"', () => {
    render(<BottomNav />);
    expect(screen.queryByText('Mes souhaits')).toBeNull();
  });

  it('affiche exactement 3 boutons', () => {
    render(<BottomNav />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────
describe('BottomNav — items mode Kids', () => {
  beforeEach(() => setup({ mode: 'kids' }));

  it('affiche Accueil, Recherche, Mes souhaits', () => {
    render(<BottomNav />);
    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(screen.getByText('Recherche')).toBeInTheDocument();
    expect(screen.getByText('Mes souhaits')).toBeInTheDocument();
  });

  it('ne contient pas "Infos" (item retiré)', () => {
    render(<BottomNav />);
    expect(screen.queryByText('Infos')).toBeNull();
  });

  it('ne contient pas "Dossiers"', () => {
    render(<BottomNav />);
    expect(screen.queryByText('Dossiers')).toBeNull();
  });

  it('affiche exactement 3 boutons', () => {
    render(<BottomNav />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────
describe('BottomNav — masquage /admin', () => {
  it('retourne null sur /admin', () => {
    setup({ pathname: '/admin' });
    const { container } = render(<BottomNav />);
    expect(container.firstChild).toBeNull();
  });

  it('retourne null sur /admin/stays/123', () => {
    setup({ pathname: '/admin/stays/123' });
    const { container } = render(<BottomNav />);
    expect(container.firstChild).toBeNull();
  });

  it('visible sur / (hors admin)', () => {
    setup({ pathname: '/' });
    render(<BottomNav />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────
describe('BottomNav — skeleton (mounted = false)', () => {
  it('rend une nav vide sans boutons si mounted = false', () => {
    setup({ mounted: false });
    render(<BottomNav />);
    expect(document.querySelector('nav')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────
describe('BottomNav — isActive', () => {
  it('Accueil actif sur / (exact match)', () => {
    setup({ mode: 'pro', pathname: '/' });
    render(<BottomNav />);
    expect(btn('Accueil')?.className).toMatch(/(^| )text-primary( |$)/);
  });

  it('Accueil inactif sur /recherche', () => {
    setup({ mode: 'pro', pathname: '/recherche' });
    render(<BottomNav />);
    expect(btn('Accueil')?.className).not.toMatch(/(^| )text-primary( |$)/);
  });

  it('Recherche actif sur /recherche (prefix match)', () => {
    setup({ mode: 'pro', pathname: '/recherche' });
    render(<BottomNav />);
    expect(btn('Recherche')?.className).toMatch(/(^| )text-primary( |$)/);
  });

  it('Dossiers actif sur /suivi/[token]', () => {
    setup({ mode: 'pro', pathname: '/suivi/abc-uuid-123' });
    render(<BottomNav />);
    expect(btn('Dossiers')?.className).toMatch(/(^| )text-primary( |$)/);
  });

  it('Mes souhaits actif sur /envies (Kids)', () => {
    setup({ mode: 'kids', pathname: '/envies' });
    render(<BottomNav />);
    expect(btn('Mes souhaits')?.className).toMatch(/(^| )text-primary( |$)/);
  });

  it('Accueil inactif sur /suivi/xxx', () => {
    setup({ mode: 'pro', pathname: '/suivi/abc' });
    render(<BottomNav />);
    expect(btn('Accueil')?.className).not.toMatch(/(^| )text-primary( |$)/);
  });
});

// ─────────────────────────────────────────────────────
describe('BottomNav — badge wishlist (Kids)', () => {
  it('pas de badge si wishlist vide', () => {
    setup({ mode: 'kids', wishlist: [] });
    render(<BottomNav />);
    expect(screen.queryByText('1')).toBeNull();
  });

  it('badge affiche le compte si wishlist.length = 3', () => {
    setup({ mode: 'kids', wishlist: ['s1', 's2', 's3'] });
    render(<BottomNav />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('badge affiche "9+" si wishlist.length > 9', () => {
    setup({ mode: 'kids', wishlist: Array.from({ length: 10 }, (_, i) => `s${i}`) });
    render(<BottomNav />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('pas de badge en mode Pro même avec wishlist non vide', () => {
    setup({ mode: 'pro', wishlist: ['s1', 's2'] });
    render(<BottomNav />);
    expect(screen.queryByText('2')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────
describe('BottomNav — navigation au clic', () => {
  it('clic Accueil → push("/")', () => {
    setup({ mode: 'pro' });
    render(<BottomNav />);
    fireEvent.click(btn('Accueil') as HTMLElement);
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('clic Recherche → push("/recherche")', () => {
    setup({ mode: 'pro' });
    render(<BottomNav />);
    fireEvent.click(btn('Recherche') as HTMLElement);
    expect(mockPush).toHaveBeenCalledWith('/recherche');
  });

  it('clic Dossiers Pro → push("/recherche") (pas de token pro en localStorage)', () => {
    setup({ mode: 'pro' });
    render(<BottomNav />);
    fireEvent.click(btn('Dossiers') as HTMLElement);
    expect(mockPush).toHaveBeenCalledWith('/recherche');
  });

  it('clic Mes souhaits Kids → push("/envies")', () => {
    setup({ mode: 'kids' });
    render(<BottomNav />);
    fireEvent.click(btn('Mes souhaits') as HTMLElement);
    expect(mockPush).toHaveBeenCalledWith('/envies');
  });
});
