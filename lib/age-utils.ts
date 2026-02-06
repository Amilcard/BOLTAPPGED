/**
 * Age & Duration Display Utilities
 *
 * Centralizes age range calculation, formatting, and duration logic.
 * Single source of truth for age/duration display across the application.
 */

export interface SessionAgeData {
  age_min: number;
  age_max: number;
}

export interface SessionDateData {
  start_date: string;
  end_date: string;
}

export interface SessionFullData extends SessionAgeData, SessionDateData {}

// ============================================================
// DURATION — Single source of truth (Sprint 1 - Action 1)
// ============================================================

/**
 * Calculates duration in days from start/end dates.
 * Uses Math.ceil consistently (inclusive of start+end day).
 */
export function getDurationDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Calculates durationDays for a stay from its sessions.
 * Returns duration of the first valid session (fallback: defaultDuration).
 */
export function getStayDurationDays(
  sessions: SessionDateData[],
  defaultDuration: number = 7
): number {
  const withDates = (sessions || []).filter(s => s.start_date && s.end_date);
  if (withDates.length === 0) return defaultDuration;
  return getDurationDays(withDates[0].start_date, withDates[0].end_date);
}

// ============================================================
// PERIOD — Derive season from session dates (Sprint 2 - Action 5)
// ============================================================

/**
 * Maps a start_date ISO string to a season value matching PERIODE_VALUES.
 * Months: 1-2 → hiver, 3-5 → printemps, 6-8 → été, 9-10 → automne, 11-12 → fin-annee
 */
export function mapDateToSeason(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return 'été';
  const month = d.getMonth() + 1; // 1-12
  if (month <= 2) return 'hiver';
  if (month <= 5) return 'printemps';
  if (month <= 8) return 'été';
  if (month <= 10) return 'automne';
  return 'fin-annee';
}

/**
 * Determines the dominant season for a stay from its sessions.
 * Takes the season of the first session (earliest start_date).
 */
export function getStayPeriod(sessions: SessionDateData[], fallback: string = 'été'): string {
  const withDates = (sessions || []).filter(s => s.start_date);
  if (withDates.length === 0) return fallback;
  // Sessions are already ordered by start_date from Supabase query
  return mapDateToSeason(withDates[0].start_date);
}

// ============================================================
// AGE — Unified helper (Sprint 1 - Action 2)
// ============================================================

/**
 * Computes all age-related display data for a stay from its sessions.
 * Single call replaces separate calculateGlobalAgeRange + getUniqueAgeRanges + format.
 */
export function getStayAgeData(sessions: SessionAgeData[]): {
  ageMin: number;
  ageMax: number;
  ageRangesDisplay: string | undefined;
} {
  const { ageMin, ageMax } = calculateGlobalAgeRange(sessions);
  const ranges = getUniqueAgeRanges(sessions);
  const ageRangesDisplay = ranges.length > 0 ? formatAgeRangesDisplay(ranges) : undefined;
  return { ageMin, ageMax, ageRangesDisplay };
}

/**
 * Extracts unique age ranges from sessions and formats them as strings
 * @param sessions Array of session objects with age_min and age_max
 * @returns Array of unique age range strings, sorted (e.g., ["6-8", "9-11", "12-14"])
 */
export function getUniqueAgeRanges(sessions: SessionAgeData[]): string[] {
  if (!sessions || sessions.length === 0) {
    return [];
  }

  const ranges = new Set<string>();
  
  for (const session of sessions) {
    const min = session.age_min;
    const max = session.age_max;
    
    // Skip invalid ranges
    if (min == null || max == null || min < 0 || max < 0) {
      continue;
    }
    
    ranges.add(`${min}-${max}`);
  }

  // Sort ranges numerically by min age
  return Array.from(ranges).sort((a, b) => {
    const minA = parseInt(a.split('-')[0]);
    const minB = parseInt(b.split('-')[0]);
    return minA - minB;
  });
}

/**
 * Formats age ranges for display with "ans" suffix
 * @param ranges Array of age range strings (e.g., ["6-8", "9-11"])
 * @returns Formatted string (e.g., "6-8 / 9-11 ans")
 */
export function formatAgeRangesDisplay(ranges: string[]): string {
  if (ranges.length === 0) {
    return '';
  }
  
  if (ranges.length === 1) {
    return `${ranges[0]} ans`;
  }
  
  return `${ranges.join(' / ')} ans`;
}

/**
 * Calculates global age range (min of mins, max of maxs)
 * Used as fallback when detailed ranges are not available
 * @param sessions Array of session objects with age_min and age_max
 * @returns Object with ageMin and ageMax, or default values if no valid sessions
 */
export function calculateGlobalAgeRange(
  sessions: SessionAgeData[],
  defaultMin: number = 6,
  defaultMax: number = 17
): { ageMin: number; ageMax: number } {
  if (!sessions || sessions.length === 0) {
    return { ageMin: defaultMin, ageMax: defaultMax };
  }

  const validSessions = sessions.filter(
    s => s.age_min != null && s.age_max != null && s.age_min >= 0 && s.age_max >= 0
  );

  if (validSessions.length === 0) {
    return { ageMin: defaultMin, ageMax: defaultMax };
  }

  const ageMin = Math.min(...validSessions.map(s => s.age_min));
  const ageMax = Math.max(...validSessions.map(s => s.age_max));

  return { ageMin, ageMax };
}

/**
 * Unified age display string for a stay
 * Prefers detailed ranges, falls back to global range
 * @param sessions Array of session objects
 * @returns Display string ready for UI
 */
export function getAgeDisplayString(sessions: SessionAgeData[]): string {
  const ranges = getUniqueAgeRanges(sessions);
  
  if (ranges.length > 0) {
    return formatAgeRangesDisplay(ranges);
  }
  
  // Fallback to global range
  const { ageMin, ageMax } = calculateGlobalAgeRange(sessions);
  return `${ageMin}-${ageMax} ans`;
}
