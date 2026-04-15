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
  accommodationLabel?: string; // Ajouté pour compatibilité UI
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

  // === CHAMPS PREMIUM MARKETING (Univers + Wording vendeur) ===
  // Fallback: si null, le front utilise les champs legacy (title, geography, etc.)
  rawTitle?: string | null;              // Nom UFOVAL brut (admin uniquement)
  marketingTitle?: string | null;       // Home H3 + Détail H1 (court, marque)
  punchline?: string | null;            // Home sous-titre + Détail H2 (accroche courte, 1-2 phrases)
  expertPitch?: string | null;          // Détail corps de texte (storytelling long, style CityCrunch)
  emotionTag?: string | null;           // Badge unique (émotion, pas géo)
  carouselGroup?: string | null;        // Routing carrousel Home (univers)
  spotLabel?: string | null;            // Lieu lisible (département / spot)
  standingLabel?: string | null;        // Confort/standing réel
  expertiseLabel?: string | null;       // Encadrement/diplômes
  intensityLabel?: string | null;       // Intensité/rythme (optionnel)
  priceIncludesFeatures?: string[] | null; // Bullets dynamiques 'inclus' (max 3-5)
  sourceUrl?: string | null;               // URL source externe
  descriptionMarketing?: string | null;    // Description marketing alternative
  rawSessions?: RawSessionData[];          // Données sessions brutes
  priceFrom_display?: number | null;       // Prix affiché (alias front)
  contentKids?: Record<string, unknown> | null; // Contenu kids structuré
}

export interface RawSessionData {
  id?: string;
  start_date?: string;
  end_date?: string;
  seats_total?: number | null;
  seats_left?: number | null;
  age_min?: number | null;
  age_max?: number | null;
  is_full?: boolean | null;
  price?: number | null;
  date_text?: string;
  city_departure?: string | null;
  created_at?: string;
  import_batch_ts?: string | null;
  updated_at?: string;
  [key: string]: unknown; // Allow additional properties from DB
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

// === INSCRIPTION SUPABASE (source de vérité) ===
export interface InscriptionSupabase {
  id: string;
  sejour_slug: string;
  session_date: string;
  city_departure: string;
  jeune_prenom: string;
  jeune_nom: string;
  jeune_date_naissance: string;
  organisation?: string;
  referent_nom: string;
  referent_email: string;
  referent_tel: string;
  options_educatives?: string;
  remarques?: string;
  price_total: number;
  status: string; // en_attente, validee, refusee, annulee
  payment_reference?: string;
  payment_status?: string; // pending_payment, paid, failed
  payment_method?: string;
  created_at: string;
  updated_at?: string;
  // Phase 1 — parcours pro
  dossier_ref?: string;
  suivi_token?: string;
  // Phase 2 — suivi séjour
  documents_status?: string; // en_attente, partiellement_recus, complets
  besoins_pris_en_compte?: boolean;
  equipe_informee?: boolean;
  note_pro?: string;
  // Phase 3 — préférences + besoins spécifiques
  pref_nouvelles_sejour?: string; // oui, non, si_besoin
  pref_canal_contact?: string; // email, telephone, les_deux
  pref_bilan_fin_sejour?: boolean;
  consignes_communication?: string;
  besoins_specifiques?: string;
}

// === TYPES ENRICHIS (réponses API avec données jointes) ===

export interface InscriptionEnriched extends InscriptionSupabase {
  sejour_titre?: string;
  ged_sent_at?: string | null;
  dossier_completude?: {
    bulletin: boolean;
    sanitaire: boolean;
    liaison: boolean;
    renseignements: boolean;
    pj_count: number;
    pj_vaccins: boolean;
  } | null;
}

export interface StayWithWaitlist extends Stay {
  waitlistCount?: number;
}

export interface DossierEnfant {
  id?: string;
  inscription_id?: string;
  bulletin_completed?: boolean | null;
  sanitaire_completed?: boolean | null;
  liaison_completed?: boolean | null;
  renseignements_completed?: boolean | null;
  documents_joints?: DossierDocument[] | null;
  ged_sent_at?: string | null;
  [key: string]: unknown;
}

export interface DossierDocument {
  name?: string;
  type?: string;
  url?: string;
  storage_path?: string;
  uploaded_at?: string;
}

export interface GdStructureSearchResult {
  name: string;
  city: string | null;
  type: string | null;
  email: string | null;
}

export interface SessionPriceRow {
  id?: string;
  stay_slug?: string;
  start_date?: string;
  end_date?: string;
  is_full?: boolean;
  price?: number | null;
  seats_total?: number;
  seats_left?: number;
  date_text?: string;
}

export type ViewMode = 'pro' | 'kids';
// LOT 1: Updated period filter with all seasons
// Period filter values for LOT 1 (multi-choice)
export const PERIODE_VALUES = ['hiver', 'printemps', 'été', 'automne', 'fin-annee'] as const;
export type PeriodFilter = 'toutes' | typeof PERIODE_VALUES[number];
