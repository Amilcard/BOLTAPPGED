# DATABASE SCHEMA AUDIT - GED_APP

## LAUNCH READINESS ASSESSMENT: ⚠️ CRITICAL ISSUES FOUND

---

## EXECUTIVE SUMMARY

The database schema is **OUT OF SYNC** with application code. Running only the numbered migrations (001-023) and install_sql.sh will **FAIL TO CREATE ESSENTIAL TABLES AND COLUMNS** that the application expects.

### Critical Problems:

1. **Missing Table Definitions**: 4 tables used by code have NO CREATE TABLE statements in numbered migrations
2. **Incomplete Migrations**: 2 tables exist only in n8n-patches (not in numbered migrations)
3. **Schema/Code Mismatch**: At least 1 table name discrepancy (gd_souhaits vs gd_wishes)
4. **Base Schema Missing**: Core tables (gd_stays, gd_inscriptions, gd_session_prices) have NO numbered migration files
5. **RLS Migration References Non-Existent Table**: Migration 023 tries to ALTER a table that was never created

---

## DETAILED FINDINGS

### TIER 1: TABLES MISSING FROM NUMBERED MIGRATIONS (001-023)

#### A. Tables in n8n-patches/ but NOT in sql/

**Table: gd_dossier_enfant**
- Location: `/n8n-patches/migration_dossier_enfant.sql`
- Status: ONLY in n8n-patches
- Code references (CRITICAL):
  - `app/api/admin/dossier-enfant/[inscriptionId]/route.ts` (line 26)
  - `app/api/dossier-enfant/[inscriptionId]/upload/route.ts` (77, 103, 114, 159, 205, 215)
  - `app/api/dossier-enfant/[inscriptionId]/submit/route.ts` (49, 92)
  - `app/api/admin/inscriptions/[id]/route.ts` (169)
- Impact: **CRITICAL** - File upload and form submission endpoints will crash
- Columns required:
  - id, inscription_id, bulletin_complement, fiche_sanitaire, fiche_liaison_jeune, 
  - fiche_renseignements, documents_joints, completion flags, created_at, updated_at

**Table: gd_propositions_tarifaires**
- Location: `/n8n-patches/migration_propositions_tarifaires.sql`
- Status: ONLY in n8n-patches
- Code references (CRITICAL):
  - `app/api/admin/propositions/route.ts` (lines 17, 62, 73, 98, 166, 198)
  - `app/api/admin/propositions/pdf/route.ts` (32)
- Impact: **CRITICAL** - Admin pricing proposals endpoint will crash
- Columns required:
  - id, structure_nom, structure_adresse, structure_cp, structure_ville,
  - enfant_nom, enfant_prenom, sejour_slug, sejour_titre, session_start, session_end,
  - prix_sejour, prix_transport, prix_encadrement, prix_total, status, inscription_id,
  - pdf_storage_path, created_by, validated_at, created_at, updated_at

---

#### B. Tables With NO CREATE TABLE Statement ANYWHERE

**Table: gd_stay_themes**
- Status: NO CREATE TABLE FOUND in entire repository
- Code references (CRITICAL):
  - `lib/supabaseGed.ts:284` - `getStayThemes()` function - queries this table
  - `lib/supabaseGed.ts:302` - `getAllStayThemes()` function - queries this table
  - Both are called from components to render stay themes
- Impact: **CRITICAL** - Stay theme loading will crash with "table does not exist"
- Required columns: `stay_slug TEXT, theme TEXT`
- Insert script exists but cannot run: `sql/insert_stay_themes.sql` tries to INSERT into a table that doesn't exist
- Type definition exists in `types/database.types.ts` (line 338-351)

**Table: gd_inscription_status_logs**
- Status: NO CREATE TABLE FOUND
- Only reference: `sql/023_rls_inscription_status_logs.sql` tries to ALTER it
- Migration 023 will fail with "relation does not exist"
- Impact: **HIGH** - The RLS migration itself will fail if applied, blocking the entire migration chain

---

### TIER 2: BASE TABLES WITHOUT NUMBERED MIGRATIONS

The following core tables are referenced throughout the application but have **NO CREATE TABLE** statements in any numbered migration (001-023):

**gd_stays** (PRIMARY - all application data depends on this)
- Used in: `lib/supabaseGed.ts`, `app/page.tsx`, `app/recherche/page.tsx`, and 20+ other files
- Type definition: `types/database.types.ts` (lines 353-483)
- Migration status: NOT CREATED in repository
- Must be pre-existing in production Supabase

**gd_inscriptions** (PRIMARY - enrollment system)
- Used in: Stripe webhooks, API routes, admin panel (40+ locations)
- Type definition: `types/database.types.ts` (lines 158-228)
- Migration status: NOT CREATED in repository
- Columns expected: id, jeune_prenom, jeune_nom, jeune_date_naissance, referent_email, sejour_slug, status, payment_* fields, and migration 020 adds: structure_domain, structure_id

**gd_stay_sessions** (CRITICAL)
- Used in: Price fetching, session availability checks
- Type definition: `types/database.types.ts` (lines 290-336)
- Migration status: NOT CREATED in repository
- Columns expected: stay_slug, start_date, end_date, age_min, age_max, city_departure, price, price_ged, seats_left, is_full

**gd_session_prices** (CRITICAL)
- Used in: All pricing calculations, reservation flows
- Type definition: `types/database.types.ts` (lines 251-288)
- Migration status: NOT CREATED in repository
- Columns expected: stay_slug, start_date, end_date, base_price_eur, price_ged_total, city_departure, transport_surcharge_ged, transport_surcharge_ufoval, is_full

**gd_educ_options** (Referenced in code)
- Type definition: `types/database.types.ts` (lines 137-156)
- Migration status: NOT CREATED in repository
- Columns: code, label, extra_eur, is_active

---

### TIER 3: SCHEMA/CODE MISMATCHES

**Table Name Discrepancy: gd_souhaits vs gd_wishes**

Migration 020 creates table: **gd_souhaits** (lines 117-153)
- Table structure includes many columns specific to educator workflows
- Has RLS policies defined

Code references:
- **8 locations** call `.from('gd_souhaits')` - API routes
  - `app/api/souhaits/route.ts` (lines 53, 62, 70, 99)
  - `app/api/souhaits/kid/[kidToken]/route.ts` (line 23)
  - `app/api/educateur/souhait/[token]/route.ts` (lines 23, 35, 76, 86)

- **1 location** calls `.from('gd_wishes')` - WRONG TABLE NAME
  - `lib/supabaseGed.ts:256` - `createWish()` function (should be `gd_souhaits`)

Type Definition Issue:
- `types/database.types.ts` defines a table named **gd_wishes** (lines 485-519)
- But migration 020 creates **gd_souhaits** with different structure
- gd_wishes has fewer columns than gd_souhaits needs

**Impact**: Function `createWish()` in supabaseGed.ts will insert into non-existent table, causing runtime error.

---

### TIER 4: COLUMNS ADDED IN LATER MIGRATIONS

**gd_inscriptions** column additions (Migration 020):
- `structure_domain TEXT` - added via ALTER (line 49)
- `structure_id UUID REFERENCES gd_structures(id)` - added via ALTER (line 52)
- Indexes created for both
- **Assumption**: gd_inscriptions table must exist before migration 020 runs

**gd_stays** column additions (Migration from gd_dossier_enfant):
- `documents_requis JSONB` - added via ALTER
- **Assumption**: gd_stays table must exist before this migration runs

**gd_souhaits** column additions (Migration 021):
- `educateur_token UUID UNIQUE` - added via ALTER (line 7)
- `educateur_prenom TEXT` - added via ALTER (line 11)
- `kid_session_token UUID` - added via ALTER (line 17)
- Indexes created for tokens
- **Assumption**: gd_souhaits table must exist from migration 020

---

## WHAT HAPPENS IF YOU RUN ONLY NUMBERED MIGRATIONS (001-023)

```
✓ Migration 020: Creates gd_structures, gd_souhaits, alters gd_inscriptions
✓ Migration 021: Adds columns to gd_souhaits
✗ Migration 023: FAILS - tries to ALTER gd_inscription_status_logs (doesn't exist)

MISSING TABLES (will cause app crash on first load):
- gd_dossier_enfant (try to access /dossier-enfant endpoints)
- gd_propositions_tarifaires (try to access /admin/propositions endpoints)
- gd_stay_themes (try to load any stay details)
- gd_inscription_status_logs (RLS enforcement failed)

ALSO MISSING (pre-existing in production, NOT created):
- gd_stays (all pages crash)
- gd_stay_sessions (no sessions available)
- gd_session_prices (no pricing data)
- gd_inscriptions (no enrollment system) - though base table exists, might be missing columns from migrations
- gd_educ_options (option pricing broken)
```

---

## WHICH MIGRATIONS MUST RUN (DEPENDENCY CHAIN)

### Safe to run (self-contained):
- 001-012: Data modifications and column additions (assumes base tables exist)
- 006: Creates `sejours_images` table
- 007: Creates `smart_form_submissions`, `notification_queue`
- 008-011: Various protections and payment system
- 009: References `registrations` table (not in scope - different schema)
- 013-019: Not numbered, likely data corrections

### Problematic:
- 020: **REQUIRES** gd_inscriptions table to pre-exist ✓ Can verify
- 021: **REQUIRES** gd_souhaits table from 020 ✓ Can verify
- 023: **REQUIRES** gd_inscription_status_logs table to pre-exist ✗ **BROKEN** - table never created

### Must run from n8n-patches:
- `migration_dossier_enfant.sql` - Creates gd_dossier_enfant
- `migration_propositions_tarifaires.sql` - Creates gd_propositions_tarifaires

---

## INSTALL SCRIPT ANALYSIS

**install_sql.sh** only runs:
1. `sql/006_create_sejours_images_table.sql`
2. `sql/007_smart_form_routing_helpers.sql`

Does NOT include:
- gd_dossier_enfant migration
- gd_propositions_tarifaires migration
- gd_stay_themes table creation
- gd_inscription_status_logs table creation

**Conclusion**: install_sql.sh is incomplete for launch.

---

## REQUIRED ACTIONS FOR LAUNCH

### 1. IMMEDIATE (must be done before launch)

**Create missing table: gd_stay_themes**
```sql
CREATE TABLE IF NOT EXISTS gd_stay_themes (
  stay_slug TEXT NOT NULL,
  theme TEXT NOT NULL,
  PRIMARY KEY (stay_slug, theme)
);
```

**Create missing table: gd_inscription_status_logs**
- Need to determine schema - check if it's related to payment_status_logs
- Migration 023 assumes it exists

**Fix code mismatch**
- `lib/supabaseGed.ts:256` change `.from('gd_wishes')` to `.from('gd_souhaits')`

**Include n8n-patches in migration suite**
- `migration_dossier_enfant.sql` MUST be included
- `migration_propositions_tarifaires.sql` MUST be included

### 2. VERIFICATION CHECKLIST

Before deploying to production:

- [ ] Verify gd_stays table exists with all required columns
- [ ] Verify gd_inscriptions table exists with migration 020 columns added
- [ ] Verify gd_stay_sessions table exists
- [ ] Verify gd_session_prices table exists
- [ ] Verify gd_educ_options table exists
- [ ] Create gd_stay_themes table
- [ ] Create gd_inscription_status_logs table
- [ ] Include migration_dossier_enfant.sql
- [ ] Include migration_propositions_tarifaires.sql
- [ ] Fix supabaseGed.ts table name (gd_wishes → gd_souhaits)
- [ ] Run migration 023 (should succeed after gd_inscription_status_logs is created)
- [ ] Run insert_stay_themes.sql to populate themes

### 3. DEPLOYMENT INSTRUCTIONS

1. Ensure all base tables exist in Supabase
2. Run numbered migrations 001-023 in order
3. Run n8n-patches migrations
4. Run insert_stay_themes.sql
5. Verify schema with types/database.types.ts

---

## RISK LEVEL: 🔴 CRITICAL

The application **CANNOT LAUNCH** without:
1. All base tables (gd_stays, gd_inscriptions, gd_session_prices, gd_stay_sessions)
2. The gd_stay_themes table (used in every stay detail page)
3. The gd_dossier_enfant table (used in enrollment flow)
4. The gd_propositions_tarifaires table (admin pricing)
5. Fixing the gd_wishes/gd_souhaits mismatch

These are not optional features - they are core application functionality.

