export interface Stay {
  id: string;
  slug: string;
  title: string;
  descriptionShort: string;
  // CityCrunch: titres/descriptions Pro/Kids (fallback: title/descriptionShort)
  titlePro?: string;
  titleKids?: string;
  descriptionPro?: string;
  descriptionKids?: string;
  programme: string[];
  geography: string;
  accommodation: string;
  supervision: string;
  priceFrom?: number; // Non exposé publiquement (sécurité)
  durationDays: number;
  period: string;
  ageMin: number;
  ageMax: number;
  ageRangesDisplay?: string; // Formatted age ranges for display (e.g., "6-8 / 9-11 ans")
  themes: string[];
  imageCover: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  departureCity?: string | null; // Ville de départ (optionnel)
  educationalOption?: string | null; // Objectifs éducatifs (optionnel)
  pdfUrl?: string | null; // URL du PDF du séjour (optionnel)
  sessions?: StaySession[];
  nextSessionStart?: string | null;
}

export interface StaySession {
  id: string;
  stayId: string;
  startDate: string;
  endDate: string;
  seatsTotal?: number; // Non exposé publiquement
  seatsLeft: number;
}

export interface Booking {
  id: string;
  stayId: string;
  sessionId: string;
  organisation: string;
  socialWorkerName: string;
  email: string;
  phone: string;
  childFirstName: string;
  childLastName?: string; // Optionnel (minimisation données)
  childBirthDate?: string; // Optionnel
  childBirthYear?: number; // Année seulement (minimisation données mineur)
  notes?: string;
  childNotes?: string;
  consent: boolean;
  status: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
}

export type ViewMode = 'pro' | 'kids';
// LOT 1: Updated period filter with all seasons
// Period filter values for LOT 1 (multi-choice)
export const PERIODE_VALUES = ['hiver', 'printemps', 'été', 'automne', 'fin-annee'] as const;
export type PeriodFilter = 'toutes' | typeof PERIODE_VALUES[number];
