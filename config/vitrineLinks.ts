/**
 * Vitrine Site Links Configuration (LOT 1)
 *
 * Single source of truth for all links to the main vitrine website.
 * Default values point to the production vitrine domain.
 * Environment variables can override defaults if needed.
 *
 * @example Override via .env.local
 * NEXT_PUBLIC_VITRINE_HOME_URL="https://staging.groupeetdecouverte.fr/"
 */

const VITRINE_DOMAIN = 'https://www.groupeetdecouverte.fr';

export const VITRINE_LINKS = {
  /** Home page of the vitrine site */
  HOME: process.env.NEXT_PUBLIC_VITRINE_HOME_URL || `${VITRINE_DOMAIN}/`,

  /** Individualized request form page */
  DEMANDE: process.env.NEXT_PUBLIC_VITRINE_DEMANDE_URL || `${VITRINE_DOMAIN}/demande-individualisee`,

  /** Contact page */
  CONTACT: process.env.NEXT_PUBLIC_VITRINE_CONTACT_URL || `${VITRINE_DOMAIN}/contact`,
} as const;

/** Type for vitrine link keys */
export type VitrineLinkKey = keyof typeof VITRINE_LINKS;
