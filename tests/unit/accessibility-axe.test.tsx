/**
 * Tests accessibilité — jest-axe (axe-core)
 *
 * Composants testés :
 *  - BottomNav (Pro, Kids, skeleton)
 *  - DossierBadge (null, partiel, complet, envoyé)
 *  - PaymentMethodSelector
 *  - AdminUIProvider (children)
 *
 * Règles charte GED : labels sur inputs, role="alert" sur erreurs,
 * tap targets 44px, aria-hidden sur décoratif.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('next/navigation', () => ({
  usePathname: jest.fn().mockReturnValue('/'),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/components/providers', () => ({
  useApp: jest.fn().mockReturnValue({ mode: 'pro', mounted: true, wishlist: [] }),
}));

import { BottomNav } from '@/components/bottom-nav';
import { DossierBadge } from '@/components/admin/DossierBadge';
import { PaymentMethodSelector } from '@/components/payment-method-selector';
import { AdminUIProvider } from '@/components/admin/admin-ui';
import { useApp } from '@/components/providers';

const mockUseApp = useApp as jest.Mock;

// ── BottomNav ─────────────────────────────────────────────────────────────────

describe('Accessibilité — BottomNav', () => {
  it('mode Pro : aucune violation axe', async () => {
    mockUseApp.mockReturnValue({ mode: 'pro', mounted: true, wishlist: [] });
    const { container } = render(<BottomNav />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('mode Kids (3 items + badge wishlist) : aucune violation axe', async () => {
    mockUseApp.mockReturnValue({ mode: 'kids', mounted: true, wishlist: ['s1', 's2'] });
    const { container } = render(<BottomNav />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('skeleton (mounted=false) : aucune violation axe', async () => {
    mockUseApp.mockReturnValue({ mode: 'pro', mounted: false, wishlist: [] });
    const { container } = render(<BottomNav />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── DossierBadge ──────────────────────────────────────────────────────────────

describe('Accessibilité — DossierBadge', () => {
  it('completude null → aucune violation axe', async () => {
    const { container } = render(<DossierBadge completude={null} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('0/4 fiches → aucune violation axe', async () => {
    const { container } = render(
      <DossierBadge completude={{ bulletin: false, sanitaire: false, liaison: false, renseignements: false }} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('2/4 fiches → aucune violation axe', async () => {
    const { container } = render(
      <DossierBadge completude={{ bulletin: true, sanitaire: true, liaison: false, renseignements: false }} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('4/4 fiches (Complet) → aucune violation axe', async () => {
    const { container } = render(
      <DossierBadge completude={{ bulletin: true, sanitaire: true, liaison: true, renseignements: true }} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('gedSentAt (Envoyé) → aucune violation axe', async () => {
    const { container } = render(
      <DossierBadge
        completude={{ bulletin: true, sanitaire: true, liaison: true, renseignements: true }}
        gedSentAt="2026-03-31T10:00:00Z"
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('vaccins + pj_count → aucune violation axe', async () => {
    const { container } = render(
      <DossierBadge completude={{
        bulletin: true, sanitaire: false, liaison: false, renseignements: false,
        pj_vaccins: true, pj_count: 2,
      }} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── PaymentMethodSelector ─────────────────────────────────────────────────────

describe('Accessibilité — PaymentMethodSelector', () => {
  it('3 options de paiement : aucune violation axe', async () => {
    const { container } = render(
      <PaymentMethodSelector
        onSelectStripe={jest.fn()}
        onSelectTransfer={jest.fn()}
        onSelectCheck={jest.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── AdminUIProvider ───────────────────────────────────────────────────────────

describe('Accessibilité — AdminUIProvider', () => {
  it('rendu de base (children) : aucune violation axe', async () => {
    const { container } = render(
      <AdminUIProvider>
        <div>contenu admin</div>
      </AdminUIProvider>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
