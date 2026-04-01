/**
 * Tests composants — PaymentMethodSelector
 *
 * Couvre le comportement de sélection du mode de paiement :
 *  - les 3 options sont rendues avec leurs labels et délais
 *  - chaque bouton appelle le bon callback
 *  - un seul callback est appelé par clic (pas de fuite)
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentMethodSelector } from '@/components/payment-method-selector';

function setup(overrides: Partial<React.ComponentProps<typeof PaymentMethodSelector>> = {}) {
  const props = {
    onSelectStripe: jest.fn(),
    onSelectTransfer: jest.fn(),
    onSelectCheck: jest.fn(),
    ...overrides,
  };
  render(<PaymentMethodSelector {...props} />);
  return props;
}

describe('PaymentMethodSelector', () => {
  it('rend les 3 options avec labels et délais', () => {
    setup();
    expect(screen.getByText('Paiement sécurisé en ligne')).toBeInTheDocument();
    expect(screen.getByText('Virement bancaire')).toBeInTheDocument();
    expect(screen.getByText('Paiement par chèque')).toBeInTheDocument();
    // Délais
    expect(screen.getByText('Immédiat')).toBeInTheDocument();
    expect(screen.getByText('2-3 jours')).toBeInTheDocument();
    expect(screen.getByText('5-7 jours')).toBeInTheDocument();
  });

  it('clic carte → onSelectStripe appelé, autres non', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByText('Paiement sécurisé en ligne').closest('button')!);
    expect(props.onSelectStripe).toHaveBeenCalledTimes(1);
    expect(props.onSelectTransfer).not.toHaveBeenCalled();
    expect(props.onSelectCheck).not.toHaveBeenCalled();
  });

  it('clic virement → onSelectTransfer appelé, autres non', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByText('Virement bancaire').closest('button')!);
    expect(props.onSelectTransfer).toHaveBeenCalledTimes(1);
    expect(props.onSelectStripe).not.toHaveBeenCalled();
    expect(props.onSelectCheck).not.toHaveBeenCalled();
  });

  it('clic chèque → onSelectCheck appelé, autres non', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByText('Paiement par chèque').closest('button')!);
    expect(props.onSelectCheck).toHaveBeenCalledTimes(1);
    expect(props.onSelectStripe).not.toHaveBeenCalled();
    expect(props.onSelectTransfer).not.toHaveBeenCalled();
  });
});
