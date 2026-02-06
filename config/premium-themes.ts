import { Mountain, Waves, TreePine, Zap, Bike, Gamepad2, Camera, Compass, Heart, Droplets, Fish } from 'lucide-react';

export type PremiumTheme =
  // Bleu Ocean / Nautique
  | 'LITTORAL' | 'HORIZON' | 'SENSATIONS' | 'NAUTIQUE' | 'GLISSE' | 'EAU CALME' | 'PISCINE'
  // Orange / Adrénaline / Montagne
  | 'ALTITUDE' | 'AVENTURE' | 'ADRENALINE' | 'VITESSE' | 'SPORT' | 'ACTION' | 'AÉRIEN' | 'MÉCANIQUE'
  // Violet / Urbain / Gaming
  | 'URBAIN' | 'GAMING'
  // Vert Nature / Découverte
  | 'NATURE' | 'PREMIERS PAS' | 'PASSION' | 'DÉCOUVERTE' | 'EXPLORATION' | 'SURVIE' | 'DYNAMIQUE' | 'MIXTE' | 'ART & NATURE'
  // Rose / Douceur
  | 'DOUCEUR' | 'COCOONING' | 'APPRENTISSAGE' | 'ANIMAUX';

interface ThemeConfig {
  color: string;
  borderColor: string;
  textColor: string;
  icon: any; // LucideIcon type handled loosely to avoid conflicts
}

interface ReassuranceConfig {
  points: string[];
}

export const THEME_STYLES: Record<string, ThemeConfig> = {
  // === BLEU OCEAN / NAUTIQUE ===
  LITTORAL: {
    color: 'bg-cyan-500',
    borderColor: 'border-cyan-500',
    textColor: 'text-cyan-600',
    icon: Waves,
  },
  HORIZON: {
    color: 'bg-cyan-600',
    borderColor: 'border-cyan-600',
    textColor: 'text-cyan-700',
    icon: Waves,
  },
  SENSATIONS: {
    color: 'bg-cyan-600',
    borderColor: 'border-cyan-600',
    textColor: 'text-cyan-700',
    icon: Zap,
  },
  NAUTIQUE: {
    color: 'bg-cyan-600',
    borderColor: 'border-cyan-600',
    textColor: 'text-cyan-700',
    icon: Waves,
  },
  GLISSE: {
    color: 'bg-cyan-600',
    borderColor: 'border-cyan-600',
    textColor: 'text-cyan-700',
    icon: Waves,
  },
  'EAU CALME': {
    color: 'bg-sky-500',
    borderColor: 'border-sky-500',
    textColor: 'text-sky-600',
    icon: Droplets,
  },
  PISCINE: {
    color: 'bg-sky-500',
    borderColor: 'border-sky-500',
    textColor: 'text-sky-600',
    icon: Droplets,
  },

  // === ORANGE / ADRÉNALINE / MONTAGNE ===
  ALTITUDE: {
    color: 'bg-orange-600',
    borderColor: 'border-orange-600',
    textColor: 'text-orange-700',
    icon: Mountain,
  },
  AVENTURE: {
    color: 'bg-orange-600',
    borderColor: 'border-orange-600',
    textColor: 'text-orange-700',
    icon: Mountain,
  },
  ADRENALINE: {
    color: 'bg-orange-600',
    borderColor: 'border-orange-600',
    textColor: 'text-orange-700',
    icon: Zap,
  },
  VITESSE: {
    color: 'bg-orange-600',
    borderColor: 'border-orange-600',
    textColor: 'text-orange-700',
    icon: Zap,
  },
  SPORT: {
    color: 'bg-orange-500',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-600',
    icon: Bike,
  },
  ACTION: {
    color: 'bg-orange-500',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-600',
    icon: Zap,
  },
  'AÉRIEN': {
    color: 'bg-indigo-600',
    borderColor: 'border-indigo-600',
    textColor: 'text-indigo-700',
    icon: Compass,
  },
  'MÉCANIQUE': {
    color: 'bg-red-600',
    borderColor: 'border-red-600',
    textColor: 'text-red-700',
    icon: Bike,
  },

  // === VIOLET / URBAIN / GAMING ===
  URBAIN: {
    color: 'bg-violet-600',
    borderColor: 'border-violet-600',
    textColor: 'text-violet-700',
    icon: Zap,
  },
  GAMING: {
    color: 'bg-violet-600',
    borderColor: 'border-violet-600',
    textColor: 'text-violet-700',
    icon: Gamepad2,
  },

  // === VERT NATURE / DÉCOUVERTE ===
  NATURE: {
    color: 'bg-emerald-600',
    borderColor: 'border-emerald-600',
    textColor: 'text-emerald-700',
    icon: TreePine,
  },
  'PREMIERS PAS': {
    color: 'bg-emerald-600',
    borderColor: 'border-emerald-600',
    textColor: 'text-emerald-700',
    icon: TreePine,
  },
  PASSION: {
    color: 'bg-emerald-600',
    borderColor: 'border-emerald-600',
    textColor: 'text-emerald-700',
    icon: TreePine,
  },
  'DÉCOUVERTE': {
    color: 'bg-teal-600',
    borderColor: 'border-teal-600',
    textColor: 'text-teal-700',
    icon: Compass,
  },
  EXPLORATION: {
    color: 'bg-teal-600',
    borderColor: 'border-teal-600',
    textColor: 'text-teal-700',
    icon: Compass,
  },
  SURVIE: {
    color: 'bg-amber-700',
    borderColor: 'border-amber-700',
    textColor: 'text-amber-800',
    icon: Mountain,
  },
  DYNAMIQUE: {
    color: 'bg-emerald-500',
    borderColor: 'border-emerald-500',
    textColor: 'text-emerald-600',
    icon: Zap,
  },
  MIXTE: {
    color: 'bg-teal-500',
    borderColor: 'border-teal-500',
    textColor: 'text-teal-600',
    icon: TreePine,
  },
  'ART & NATURE': {
    color: 'bg-emerald-600',
    borderColor: 'border-emerald-600',
    textColor: 'text-emerald-700',
    icon: Camera,
  },

  // === ROSE / DOUCEUR (Première Colo) ===
  DOUCEUR: {
    color: 'bg-pink-500',
    borderColor: 'border-pink-500',
    textColor: 'text-pink-600',
    icon: Heart,
  },
  COCOONING: {
    color: 'bg-pink-400',
    borderColor: 'border-pink-400',
    textColor: 'text-pink-500',
    icon: Heart,
  },
  APPRENTISSAGE: {
    color: 'bg-sky-600',
    borderColor: 'border-sky-600',
    textColor: 'text-sky-700',
    icon: Droplets,
  },
  ANIMAUX: {
    color: 'bg-amber-600',
    borderColor: 'border-amber-600',
    textColor: 'text-amber-700',
    icon: Fish,
  },
};

export const REASSURANCE_BLOCK_CONTENT: Record<string, ReassuranceConfig> = {
  // Custom content based on primary theme
  'MÉCANIQUE': {
    points: [
      "Location moto incluse",
      "Essence & entretien compris",
      "Encadrement Brevet d'État",
      "Équipement de sécurité complet"
    ]
  },
  HORIZON: {
    points: [
      "Surveillants baignade qualifiés (SB)",
      "Accès mer direct ou privé",
      "Transports sur place inclus",
      "Garantie sécurité nautique"
    ]
  },
  ALTITUDE: {
    points: [
      "Encadrement Montagne Diplômé",
      "Matériel technique fourni",
      "Refuges & bivouacs sécurisés",
      "Sensibilisation environnement"
    ]
  },
  AVENTURE: {
    points: [
      "Bivouacs & Autonomie encadrée",
      "Apprentissage survie douce",
      "Moniteurs Guides Outdoor",
      "Matériel expédition fourni"
    ]
  },
  SURVIE: {
    points: [
      "Bivouacs encadrés",
      "Techniques de survie douce",
      "Matériel expédition fourni",
      "Apprentissage feu & orientation"
    ]
  },
  DOUCEUR: {
    points: [
      "Rythme adapté aux tout-petits",
      "Animateurs Petite Enfance",
      "Veille sommeil renforcée",
      "Aucun transport long trajet"
    ]
  },
  'PREMIERS PAS': {
    points: [
      "Rythme adapté aux 4-6 ans",
      "Animateurs Petite Enfance",
      "Veille sommeil renforcée",
      "Aucun transport long trajet"
    ]
  },
  // Default fallback
  DEFAULT: {
    points: [
      "Transport Aller/Retour inclus",
      "Astreinte éducative 24/7",
      "Garantie \"Zéro Renvoi Sec\"",
      "Encadrement renforcé"
    ]
  }
};

/** Strip diacritics for accent-safe comparison (DÉCOUVERTE → DECOUVERTE) */
const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Pre-built lookup: accent-stripped key → original THEME_STYLES key */
const THEME_LOOKUP: Record<string, string> = Object.keys(THEME_STYLES).reduce((acc, key) => {
  acc[stripAccents(key.toUpperCase())] = key;
  return acc;
}, {} as Record<string, string>);

export function getThemeStyle(theme: string) {
  const raw = theme?.toUpperCase() || '';
  // Try exact match first, then accent-stripped match
  return THEME_STYLES[raw] || THEME_STYLES[THEME_LOOKUP[stripAccents(raw)] || ''] || THEME_STYLES.ALTITUDE;
}

/** Pre-built lookup: accent-stripped key → original REASSURANCE key */
const REASSURANCE_LOOKUP: Record<string, string> = Object.keys(REASSURANCE_BLOCK_CONTENT).reduce((acc, key) => {
  acc[stripAccents(key.toUpperCase())] = key;
  return acc;
}, {} as Record<string, string>);

export function getReassurancePoints(theme: string) {
  const raw = theme?.toUpperCase() || 'DEFAULT';
  const stripped = stripAccents(raw);

  // Check exact match first, then accent-stripped match
  if (REASSURANCE_BLOCK_CONTENT[raw]) return REASSURANCE_BLOCK_CONTENT[raw];
  if (REASSURANCE_LOOKUP[stripped] && REASSURANCE_BLOCK_CONTENT[REASSURANCE_LOOKUP[stripped]]) {
    return REASSURANCE_BLOCK_CONTENT[REASSURANCE_LOOKUP[stripped]];
  }

  // Catégorie OCEAN/MER (all comparisons accent-stripped)
  if (['MER', 'SENSATIONS', 'GLISSE', 'NAUTIQUE', 'EAU CALME', 'PISCINE', 'APPRENTISSAGE', 'LITTORAL'].includes(stripped)) return REASSURANCE_BLOCK_CONTENT.HORIZON;
  // Catégorie MONTAGNE/ADRÉNALINE
  if (['MONTAGNE', 'ESCALADE', 'ADRENALINE', 'AERIEN', 'SPORT', 'ACTION', 'VITESSE', 'DYNAMIQUE'].includes(stripped)) return REASSURANCE_BLOCK_CONTENT.ALTITUDE;
  // Catégorie NATURE/DÉCOUVERTE
  if (['NATURE', 'EXPLORATION', 'DECOUVERTE', 'ART & NATURE', 'MIXTE', 'ANIMAUX', 'PASSION'].includes(stripped)) return REASSURANCE_BLOCK_CONTENT.AVENTURE;
  // Catégorie PREMIERE COLO
  if (['DOUCEUR', 'COCOONING', 'PREMIERS PAS'].includes(stripped)) return REASSURANCE_BLOCK_CONTENT.DOUCEUR;
  // Catégorie URBAIN/GAMING
  if (['URBAIN', 'GAMING', 'MECANIQUE'].includes(stripped)) return REASSURANCE_BLOCK_CONTENT['MÉCANIQUE'];

  return REASSURANCE_BLOCK_CONTENT.DEFAULT;
}
