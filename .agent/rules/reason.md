---
trigger: always_on
---

GED — CONTEXT (what this workspace is)


IMPORTANT: Do NOT apply changes automatically.
Always propose changes first, wait for explicit confirmation, then apply.
If permissions allow auto-apply, still behave as "ask-first".

CRITICAL:
Never auto-apply changes.
Always propose modifications first.
Wait for explicit confirmation before writing files.
Even if execution permissions allow it.


This workspace is the Groupe & Découverte web app (GED), connected to Supabase.
Data includes stays imported from a partner (UFOVAL-like) and editorial content rewritten for GED.
The app has 2 experiences:
- Kids: discovery + choices/forms, NO pricing
- Pro: pricing + registration information

GED — NON-NEGOTIABLE RULES (must always hold)

1) No regression / no break:
Never break existing routes, navigation, stay pages, or deployment paths.

2) Supabase is the source of truth:
Never invent fields or data rules. If missing, propose a safe migration.

3) Never overwrite GED editorial content:
Partner sync must NEVER overwrite manually rewritten GED text.
If a stay has been edited by GED, treat it as protected.

4) Sync must be safe and idempotent:
If partner source did not change, do nothing.
If it changed, update ONLY source fields, never GED editorial fields.

5) Kids vs Pro separation is strict:
Kids must not display pricing or pro-only registration details.

6) Robust UI:
Missing image/text/session must not crash pages. Always use fallbacks.

7) Minimal change policy:
Prefer small, safe edits. No large refactors without explicit justification + rollback path.                    






     This app will later have a separate marketing/vitrine website.
The vitrine must remain separate from the application codebase.
Do not merge site vitrine and app in the same structure.

