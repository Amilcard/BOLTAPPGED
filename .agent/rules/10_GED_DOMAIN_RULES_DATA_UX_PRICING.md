---
trigger: always_on
---

GED PROJECT RULES

CONTEXT
This workspace is Groupe & Découverte web app (GED).
Next.js + Supabase + partner data (UFOVAL).
Content is manually reformulated and must never be overwritten.

DATA PRIORITY
Supabase is the single source of truth.

Never overwrite reformulated GED content with partner source content.
Always separate:
- source content
- GED edited content

If content edited manually → protect it from sync overwrite.

SYNC RULES
Night sync must be idempotent:
If source unchanged → do nothing.
If source updated → update only source fields.
Never touch edited GED fields.

UI/UX RULES
Never break:
- homepage
- stay page
- navigation
- bottom nav
- routes

Always add fallback if:
- image missing
- text missing
- session missing

KIDS vs PRO
Keep strict separation:
Kids = no prices
Pro = prices + registration info

Never expose pro pricing in kids interface.

ROUTES / HOSTINGER
Project must stay compatible with static hosting.
Never change base paths or asset paths without verification.

SAFE EDIT POLICY
Before modifying structure:
1. Explain plan
2. Modify
3. Verify build
4. Confirm result

No destructive refactor without confirmation.
