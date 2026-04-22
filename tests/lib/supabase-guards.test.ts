import {
  assertInserted,
  assertUpdatedOne,
  assertUpdatedAtLeastOne,
  assertUpdatedSingle,
  assertDeleted,
  assertSelectedOne,
  assertAuthUser,
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

  describe('assertUpdatedSingle', () => {
    test('throws PostActionError on null', () => {
      expect(() => assertUpdatedSingle(null, 'ctx')).toThrow(PostActionError);
    });

    test('throws PostActionError on undefined', () => {
      expect(() => assertUpdatedSingle(undefined, 'ctx')).toThrow(PostActionError);
    });

    test('returns data when present', () => {
      const row = { id: 1, name: 'x' };
      expect(assertUpdatedSingle(row, 'ctx')).toBe(row);
    });

    test('error carries context + kind metadata', () => {
      expect.assertions(3);
      try {
        assertUpdatedSingle(null, 'update_inscription');
      } catch (e) {
        expect(e).toBeInstanceOf(PostActionError);
        expect((e as PostActionError).context).toBe('update_inscription');
        expect((e as PostActionError).kind).toBe('update');
      }
    });

    test('error message mentions .single() for diagnostic', () => {
      try {
        assertUpdatedSingle(null, 'update_inscription');
      } catch (e) {
        expect((e as Error).message).toMatch(/single/i);
      }
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

  describe('assertAuthUser', () => {
    const user = { id: '00000000-0000-0000-0000-000000000001', email: 'x@y.z' };

    test('throws on null payload', () => {
      expect(() => assertAuthUser(null, 'ctx')).toThrow(PostActionError);
    });

    test('throws on undefined payload', () => {
      expect(() => assertAuthUser(undefined, 'ctx')).toThrow(PostActionError);
    });

    test('throws when payload.user is null', () => {
      expect(() => assertAuthUser({ user: null }, 'ctx')).toThrow(PostActionError);
    });

    test('returns user when present', () => {
      expect(assertAuthUser({ user }, 'ctx')).toBe(user);
    });

    test('default kind is "update"', () => {
      expect.assertions(1);
      try {
        assertAuthUser({ user: null }, 'admin_auth_update');
      } catch (e) {
        expect((e as PostActionError).kind).toBe('update');
      }
    });

    test('respects explicit kind="delete"', () => {
      expect.assertions(1);
      try {
        assertAuthUser({ user: null }, 'admin_auth_delete', 'delete');
      } catch (e) {
        expect((e as PostActionError).kind).toBe('delete');
      }
    });

    test('respects explicit kind="insert" for create', () => {
      expect.assertions(1);
      try {
        assertAuthUser({ user: null }, 'admin_auth_create', 'insert');
      } catch (e) {
        expect((e as PostActionError).kind).toBe('insert');
      }
    });

    test('error context preserved from caller', () => {
      expect.assertions(1);
      try {
        assertAuthUser(null, 'admin_auth_update_user');
      } catch (e) {
        expect((e as PostActionError).context).toBe('admin_auth_update_user');
      }
    });

    test('error message mentions AUTH for diagnostic', () => {
      try {
        assertAuthUser(null, 'admin_auth_update');
      } catch (e) {
        expect((e as Error).message).toMatch(/AUTH/);
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
