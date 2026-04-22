/**
 * Date de référence pour le dashboard structure.
 * En production : new Date() (comportement normal).
 * Pour screenshots : NEXT_PUBLIC_DEMO_DATE=2026-07-15 → simule mi-juillet.
 *
 * Usage : import { getDemoNow } from '@/lib/demo-date';
 *         const now = getDemoNow();
 */
export function getDemoNow(): Date {
  const demoDate = process.env.NEXT_PUBLIC_DEMO_DATE;
  if (demoDate) {
    const d = new Date(demoDate);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}
