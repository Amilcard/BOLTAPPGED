/**
 * Tests composant — DossierBadge
 *
 * Ce badge pilote les décisions admin sur chaque dossier enfant.
 * 5 états métier distincts :
 *   null        → "Non commencé"
 *   0-3/4       → "X/4 fiches" + indicateurs B/S/L/R/V/PJ
 *   4/4         → "Complet"
 *   gedSentAt   → "Envoyé" (priorité sur isComplete)
 *   vaccins/PJ  → indicateurs colorés selon présence
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { DossierBadge } from '@/components/admin/DossierBadge';

describe('DossierBadge', () => {
  it('completude null → "Non commencé"', () => {
    render(<DossierBadge completude={null} />);
    expect(screen.getByText('Non commencé')).toBeInTheDocument();
  });

  it('0/4 fiches complétées → "0/4 fiches"', () => {
    render(<DossierBadge completude={{
      bulletin: false, sanitaire: false, liaison: false, renseignements: false,
    }} />);
    expect(screen.getByText('0/4 fiches')).toBeInTheDocument();
  });

  it('2/4 fiches (bulletin + sanitaire) → indicateurs B et S colorés, L et R grisés', () => {
    render(<DossierBadge completude={{
      bulletin: true, sanitaire: true, liaison: false, renseignements: false,
    }} />);
    expect(screen.getByText('2/4 fiches')).toBeInTheDocument();
    const b = screen.getByTitle("Bulletin d'inscription");
    const s = screen.getByTitle('Fiche sanitaire');
    const l = screen.getByTitle('Fiche de liaison');
    expect(b.className).toMatch(/green/);
    expect(s.className).toMatch(/green/);
    expect(l.className).toMatch(/gray/);
  });

  it('4/4 fiches → "Complet" (pas de compteur)', () => {
    render(<DossierBadge completude={{
      bulletin: true, sanitaire: true, liaison: true, renseignements: true,
    }} />);
    expect(screen.getByText('Complet')).toBeInTheDocument();
    expect(screen.queryByText(/fiches/)).toBeNull();
  });

  it('gedSentAt non null → "Envoyé" (priorité sur isComplete)', () => {
    render(<DossierBadge
      completude={{ bulletin: true, sanitaire: true, liaison: true, renseignements: true }}
      gedSentAt="2026-03-31T10:00:00Z"
    />);
    expect(screen.getByText(/Envoyé/)).toBeInTheDocument();
    expect(screen.queryByText('Complet')).toBeNull();
  });

  it('vaccins présents → indicateur V coloré en vert', () => {
    render(<DossierBadge completude={{
      bulletin: true, sanitaire: false, liaison: false, renseignements: false,
      pj_vaccins: true, pj_count: 1,
    }} />);
    const v = screen.getByTitle('Carnet de vaccinations');
    expect(v.className).toMatch(/green/);
  });

  it('pj_count > 0 → indicateur PJ coloré en bleu', () => {
    render(<DossierBadge completude={{
      bulletin: false, sanitaire: false, liaison: false, renseignements: false,
      pj_count: 2,
    }} />);
    const pj = screen.getByTitle('Pièces jointes');
    expect(pj.className).toMatch(/blue/);
  });
});
