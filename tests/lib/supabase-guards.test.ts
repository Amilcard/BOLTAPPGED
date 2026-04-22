import {
  assertInserted,
  assertUpdatedOne,
  assertUpdatedAtLeastOne,
  assertDeleted,
  assertSelectedOne,
  PostActionError,
} from '@/lib/supabase-guards';

describe('supabase-guards — T1 Success-but-Failed', () => {
  describe('assertInserted', () => {
    test('throws PostActionError on null', () => {
      expect(() => assertInserted(null, 'ctx')).toThrow(PostActionError);
    });

    test('throws PostActionError on undefined', () => {
      expect(() => assertInserted(undefined, 'ctx')).toThrow(PostActionError);
    });

    test('returns data when present', () => {
      const row = { id: 1, name: 'x' };
      expect(assertInserted(row, 'ctx')).toBe(row);
    });

    test('error carries context + kind metadata', () => {
      expect.assertions(3);
      try {
        assertInserted(null, 'insert_dossier');
      } catch (e) {
        expect(e).toBeInstanceOf(PostActionError);
        expect((e as PostActionError).context).toBe('insert_dossier');
        expect((e as PostActionError).kind).toBe('insert');
      }
    });

    test('returns falsy but present value (0, empty string)', () => {
      expect(assertInserted(0, 'ctx')).toBe(0);
      expect(assertInserted('', 'ctx')).toBe('');
      expect(assertInserted(false, 'ctx')).toBe(false);
    });
  });

  describe('assertUpdatedOne', () => {
    test('throws on empty array (RLS silent)', () => {
      expect(() => assertUpdatedOne([], 'ctx')).toThrow(PostActionError);
    });

    test('throws on null', () => {
      expect(() => assertUpdatedOne(null, 'ctx')).toThrow(PostActionError);
    });

    test('throws on undefined', () => {
      expect(() => assertUpdatedOne(undefined, 'ctx')).toThrow(PostActionError);
    });

    test('throws on multiple rows with count in message', () => {
      expect(() => assertUpdatedOne([{ id: 1 }, { id: 2 }], 'ctx')).toThrow(
        /affected 2 rows/,
      );
    });

    test('returns single row on exactly one', () => {
      const row = { id: 1 };
      expect(assertUpdatedOne([row], 'ctx')).toBe(row);
    });

    test('error kind is "update"', () => {
      try {
        assertUpdatedOne([], 'update_dossier');
      } catch (e) {
        expect((e as PostActionError).kind).toBe('update');
      }
    });
  });

  describe('assertUpdatedAtLeastOne', () => {
    test('throws on empty', () => {
      expect(() => assertUpdatedAtLeastOne([], 'ctx')).toThrow(PostActionError);
    });

    test('throws on null', () => {
      expect(() => assertUpdatedAtLeastOne(null, 'ctx')).toThrow(PostActionError);
    });

    test('returns array on >= 1 (single)', () => {
      const rows = [{ id: 1 }];
      expect(assertUpdatedAtLeastOne(rows, 'ctx')).toBe(rows);
    });

    test('returns array on > 1 without throw', () => {
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
      expect(assertUpdatedAtLeastOne(rows, 'ctx')).toBe(rows);
    });
  });

  describe('assertDeleted', () => {
    test('throws on 0 count', () => {
      expect(() => assertDeleted(0, 'ctx')).toThrow(PostActionError);
    });

    test('throws on null count', () => {
      expect(() => assertDeleted(null, 'ctx')).toThrow(PostActionError);
    });

    test('throws on undefined count', () => {
      expect(() => assertDeleted(undefined, 'ctx')).toThrow(PostActionError);
    });

    test('passes silently on count >= 1', () => {
      expect(() => assertDeleted(1, 'ctx')).not.toThrow();
      expect(() => assertDeleted(5, 'ctx')).not.toThrow();
    });

    test('error kind is "delete"', () => {
      try {
        assertDeleted(0, 'delete_revoked_token');
      } catch (e) {
        expect((e as PostActionError).kind).toBe('delete');
      }
    });
  });

  describe('assertSelectedOne', () => {
    test('throws on null', () => {
      expect(() => assertSelectedOne(null, 'ctx')).toThrow(PostActionError);
    });

    test('throws on undefined', () => {
      expect(() => assertSelectedOne(undefined, 'ctx')).toThrow(PostActionError);
    });

    test('returns data when present', () => {
      const row = { id: 1 };
      expect(assertSelectedOne(row, 'ctx')).toBe(row);
    });

    test('error kind is "select"', () => {
      try {
        assertSelectedOne(null, 'select_structure');
      } catch (e) {
        expect((e as PostActionError).kind).toBe('select');
      }
    });
  });

  describe('PostActionError', () => {
    test('name is "PostActionError"', () => {
      try {
        assertInserted(null, 'ctx');
      } catch (e) {
        expect((e as Error).name).toBe('PostActionError');
      }
    });

    test('extends Error', () => {
      try {
        assertInserted(null, 'ctx');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    });
  });
});
