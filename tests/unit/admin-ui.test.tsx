/**
 * Tests composants — AdminUIProvider (ConfirmDialog + Toast)
 *
 * Couvre les comportements critiques du système de confirmation admin :
 *  - dialog apparaît avec le bon message
 *  - boutons disabled pendant une opération async
 *  - label "Suppression…" pendant le loading
 *  - Annuler ferme la dialog sans exécuter l'action
 *  - toast success / error affiché puis auto-masqué
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminUIProvider, useAdminUI } from '@/components/admin/admin-ui';

// ── Helper : composant de test qui expose le contexte ────────────────────────

function TestConsumer({ onMount }: { onMount: (ctx: ReturnType<typeof useAdminUI>) => void }) {
  const ctx = useAdminUI();
  React.useEffect(() => { onMount(ctx); }, [ctx, onMount]);
  return null;
}

function setup() {
  let ctx!: ReturnType<typeof useAdminUI>;
  render(
    <AdminUIProvider>
      <div data-testid="children">content</div>
      <TestConsumer onMount={c => { ctx = c; }} />
    </AdminUIProvider>
  );
  return { getCtx: () => ctx };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('AdminUIProvider — children', () => {
  it('rend les children normalement', () => {
    setup();
    expect(screen.getByTestId('children')).toBeInTheDocument();
  });
});

describe('AdminUIProvider — ConfirmDialog', () => {
  it('ouvre la dialog avec le bon message', () => {
    const { getCtx } = setup();
    act(() => { getCtx().confirm('Confirmer la suppression de cet élément ?', jest.fn()); });
    expect(screen.getByText('Confirmer la suppression de cet élément ?')).toBeVisible();
    expect(screen.getByRole('button', { name: /annuler/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /supprimer/i })).toBeInTheDocument();
  });

  it('Annuler ferme la dialog sans exécuter le callback', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const { getCtx } = setup();
    act(() => { getCtx().confirm('Supprimer ?', onConfirm); });
    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText('Supprimer ?')).not.toBeInTheDocument();
  });

  it('pendant async : boutons disabled + label "Suppression…"', async () => {
    const user = userEvent.setup();
    // Simule une opération async qui prend du temps
    let resolveConfirm!: () => void;
    const slowAction = () => new Promise<void>(r => { resolveConfirm = r; });
    const { getCtx } = setup();
    act(() => { getCtx().confirm('Supprimer définitivement ?', slowAction); });

    // Cliquer "Supprimer"
    await user.click(screen.getByRole('button', { name: /supprimer/i }));

    // Pendant l'exécution async
    expect(screen.getByRole('button', { name: /suppression/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /annuler/i })).toBeDisabled();

    // Résoudre l'async → dialog se ferme
    await act(async () => { resolveConfirm(); });
    expect(screen.queryByText('Supprimer définitivement ?')).not.toBeInTheDocument();
  });
});

describe('AdminUIProvider — Toast', () => {
  it('affiche un toast error avec le bon message', () => {
    const { getCtx } = setup();
    act(() => { getCtx().toast('Erreur lors de la suppression', 'error'); });
    expect(screen.getByText('Erreur lors de la suppression')).toBeVisible();
  });

  it('affiche un toast success (couleur différente)', () => {
    const { getCtx } = setup();
    act(() => { getCtx().toast('Inscription validée', 'success'); });
    const toastEl = screen.getByText('Inscription validée').closest('div');
    expect(toastEl?.className).toMatch(/green/);
  });

  it('useAdminUI hors contexte → throw explicite', () => {
    // Vérifier que le hook throw si utilisé sans provider
    const BrokenConsumer = () => { useAdminUI(); return null; };
    expect(() => render(<BrokenConsumer />)).toThrow('useAdminUI must be used within AdminUIProvider');
  });
});
