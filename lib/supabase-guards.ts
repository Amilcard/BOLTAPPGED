/**
 * Supabase post-action assertions — garde-fou T1 (Success-but-Failed).
 *
 * RLS peut retourner un tableau vide au lieu d'une erreur : data = [] silencieux
 * sans signaler que la ligne n'a pas été mutée (car non visible pour l'appelant).
 * Ces helpers transforment le silence en throw explicite.
 *
 * Usage :
 *   const { data, error } = await supabase
 *     .from('gd_inscriptions')
 *     .insert({...})
 *     .select()
 *     .single();
 *   if (error) throw error;
 *   const row = assertInserted(data, 'insert_inscription');
 *
 * Voir CLAUDE.md § "RÈGLE #0 quinquies — T1" et docs/SEMANTIC_GUARDS.md.
 */

export class PostActionError extends Error {
  constructor(
    message: string,
    public readonly context: string,
    public readonly kind: 'insert' | 'update' | 'delete' | 'select',
  ) {
    super(message);
    this.name = 'PostActionError';
  }
}

export function assertInserted<T>(data: T | null | undefined, context: string): T {
  if (data === null || data === undefined) {
    throw new PostActionError(
      `INSERT ${context} returned null (RLS silent ou row non visible ?)`,
      context,
      'insert',
    );
  }
  return data;
}

export function assertUpdatedOne<T>(data: T[] | null | undefined, context: string): T {
  if (!data || data.length === 0) {
    throw new PostActionError(
      `UPDATE ${context} affected 0 rows (RLS silent ou WHERE no match ?)`,
      context,
      'update',
    );
  }
  if (data.length > 1) {
    throw new PostActionError(
      `UPDATE ${context} affected ${data.length} rows (expected exactly 1)`,
      context,
      'update',
    );
  }
  return data[0];
}

export function assertUpdatedAtLeastOne<T>(
  data: T[] | null | undefined,
  context: string,
): T[] {
  if (!data || data.length === 0) {
    throw new PostActionError(
      `UPDATE ${context} affected 0 rows (RLS silent ou WHERE no match ?)`,
      context,
      'update',
    );
  }
  return data;
}

export function assertDeleted(count: number | null | undefined, context: string): void {
  if (count === null || count === undefined || count === 0) {
    throw new PostActionError(
      `DELETE ${context} affected 0 rows (WHERE no match ?)`,
      context,
      'delete',
    );
  }
}

export function assertSelectedOne<T>(data: T | null | undefined, context: string): T {
  if (data === null || data === undefined) {
    throw new PostActionError(`SELECT ${context} returned null`, context, 'select');
  }
  return data;
}
