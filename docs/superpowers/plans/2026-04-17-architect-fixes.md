# Architect Fixes — Plan 2026-04-17

Source : audit `arch-impact-reviewer` post-livraison team-invitation-flow.

## État d'avancement

| Phase | Correctifs | Appliqué |
|---|---|---|
| Phase 1 safe (1h) | #9 CHECK role, #13 doc CLAUDE.md, #10 actor_role audit | ✅ 2026-04-17 |
| Phase 1 restante (~5h) | #6 ProSessionPayload obligatoire, #7 requireStructureRole | ⏳ prévu |
| Phase 2 sécurité (~5h) | #3 revocation immédiate, #5 rate-limit dual | ⏳ prévu |
| Phase 3 dette (~2j) | #2 vue members, #4 enum resourceType, #8/#12 error shape, #11 buildProSessionToken | ⏳ prévu |

## Phase 1 restante — À faire demain/lundi

### Correctif #6 — `ProSessionPayload` obligatoire + fallback legacy

**Fichiers** : `lib/auth-middleware.ts`, `app/api/auth/pro-session/route.ts`
**Effort** : 2-4h
**Risque** : LOW (fallback conserve compat, TTL court purge vite)

Rendre `structureRole` + `structureId` obligatoires dans l'interface. Ajouter fallback dans `verifyProSession` qui résout depuis `structureCode` via `resolveCodeToStructure()` si absents. Corriger `/api/auth/pro-session/route.ts` pour inclure les 2 champs dans le JWT émis.

Test à ajouter : `tests/unit/auth-middleware.test.ts` — 3 cas (token nouveau, legacy avec fallback OK, legacy avec code invalide → null).

### Correctif #7 — `lib/structure-guard.ts` + refacto 6 routes

**Nouveau fichier** : `lib/structure-guard.ts`
**Routes à refactoriser** :
- `app/api/structure/[code]/team/route.ts`
- `app/api/structure/[code]/team/[memberId]/revoke/route.ts`
- `app/api/structure/[code]/team/[memberId]/reinvite/route.ts`
- `app/api/structure/[code]/invite/route.ts`
- `app/api/structure/[code]/delegation/route.ts`
- `app/api/structure/[code]/settings/route.ts`

**Signature proposée** :
```typescript
export type GuardResult = { ok: true; resolved: ResolvedAccess } | { ok: false; response: NextResponse };
export async function requireStructureRole(
  _req: NextRequest,
  code: string,
  allowedRoles: readonly StructureRole[],
): Promise<GuardResult>
```

Test : `tests/unit/structure-guard.test.ts` 4 cas.

## Phase 2 sécurité — À faire lundi

### Correctif #3 — Révocation immédiate de session

**Stratégie** : ajouter colonnes `last_jti TEXT`, `last_jti_exp TIMESTAMPTZ` sur `gd_structure_access_codes`. Stocker à chaque login. Sur revoke, insérer dans `gd_revoked_tokens`.

**Migration** : `supabase/migrations/070_access_codes_last_jti.sql`
```sql
ALTER TABLE gd_structure_access_codes
  ADD COLUMN IF NOT EXISTS last_jti TEXT,
  ADD COLUMN IF NOT EXISTS last_jti_exp TIMESTAMPTZ;
```

**Code** :
- `app/api/auth/structure-login/route.ts` : stocker jti après login
- `app/api/structure/[code]/team/[memberId]/revoke/route.ts` : insérer dans `gd_revoked_tokens`

### Correctif #5 — Rate-limit dual IP + email

**Fichiers** : `app/api/auth/structure-login/route.ts`, `app/api/auth/activate-invitation/route.ts`

Pattern : `Promise.all([isRateLimited('struct-login-ip', ip, 10, 15), isRateLimited('struct-login-email', emailNorm, 5, 15)])` et bloquer si l'un OU l'autre est dépassé.

Parser body AVANT rate-limit pour extraire email. Pour activate, utiliser le token comme clé alternative à l'email.

## Phase 3 dette — Sprint dédié

### Correctif #2 — Vue `gd_structure_members`

Migration SQL additive : `CREATE VIEW gd_structure_members AS SELECT ... FROM gd_structure_access_codes WHERE email IS NOT NULL`. Reads progressifs dans routes admin.

### Correctif #4 — Enum `resourceType` étendu

Ajouter à `lib/audit-log.ts:19` : `'team_member' | 'proposition' | 'paiement' | 'delegation' | 'session'`.

14 call-sites à reclasser (voir tableau détaillé dans le rapport architecte original).

### Correctif #8 — Format erreur uniforme + helpers (#12)

~19 routes à migrer vers `{error:{code,message}}`. Ajouter dans `lib/auth-middleware.ts` :
- `unauthorizedResponse(message?)`
- `forbiddenResponse(message?)`
- `errorResponse(code, message, status)`

### Correctif #11 — `buildProSessionToken()` helper

Factorise les 2 SignJWT existants (pro-session + structure-login). Dépend du correctif #6.

## Refactos lourds — sprint dédié à planifier

| Item | Raison de report |
|---|---|
| Renommage table `gd_structure_access_codes` → `gd_structure_members` | 16+ fichiers référencent, risque HIGH, downtime |
| UI "Déconnecter tous les membres" | Design UX direction, hors scope technique pur |
| Rate-limit dual sur toutes routes /auth | Phase 2 couvre les 2 routes critiques |
| E2E Playwright team-invite | Sprint QA dédié |

## Plan de commit complet (11 commits)

Une fois toutes les phases appliquées :

1. ✅ `fix(db): CHECK role whitelist` — appliqué
2. ✅ `docs: CLAUDE.md cookies 2 formes` — appliqué
3. ✅ `chore(audit): actor_role metadata` — appliqué
4. ⏳ `refactor(auth): ProSessionPayload obligatoire + fallback`
5. ⏳ `refactor(structure): requireStructureRole guard`
6. ⏳ `feat(security): session revocation via gd_revoked_tokens`
7. ⏳ `fix(security): rate-limit dual IP+email`
8. ⏳ `refactor(auth): buildProSessionToken helper`
9. ⏳ `refactor(api): {error:{code,message}} uniforme`
10. ⏳ `refactor(audit): enum resourceType étendu`
11. ⏳ `feat(db): vue gd_structure_members`

Ordre impératif : #3 après #6 (dépendance jti), #11 après #6 (dépendance payload).
