/**
 * Age Display Utilities
 * 
 * Centralizes age range calculation and formatting logic.
 * Single source of truth for age display across the application.
 */

export interface SessionAgeData {
  age_min: number;
  age_max: number;
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
