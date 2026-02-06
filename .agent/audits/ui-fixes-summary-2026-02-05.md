# GED App — UI Fixes Summary & QA Checklist

**Date** : 05 Février 2026
**Mode** : UI ONLY — No functional changes, no breaking changes
**Scope** : Kids Wishlist Modal + Pro Booking Modal

---

## Summary of Changes

### Files Modified
1. `components/wishlist-modal.tsx` — Kids "Souhait" modal
2. `components/booking-modal.tsx` — Pro "Inscription" modal

---

## Kids Modal (Wishlist) — Fixes Implemented

### ✅ P0: Copy Sequencing (KIDS_COPY_SEQUENCING)
- **Fixed**: Title now shows "Ce séjour te plaît ?" on initial open (neutral)
- **Fixed**: After save, title changes to "C'est noté !" with personalized message
- **Fixed**: Share button only appears AFTER successful save (not before)
- **File**: `wishlist-modal.tsx:106-108, 273-281`

### ✅ P0: Required Fields & Validation (KIDS_REQUIRED_FIELDS_AND_VALIDATION)
- **Already Present**: Prénom min 2 chars validation
- **Already Present**: Email strict validation (@ + domain required)
- **Already Present**: Message min 20 chars validation
- **Already Present**: Inline errors on blur with helpful messages
- **Added**: Focus management on modal open and error appearance
- **File**: `wishlist-modal.tsx:31-44, 123-149, 206-229`

### ✅ P0: Referent Personalization (KIDS_REFERENT_FIRSTNAME_PERSONALIZATION)
- **Already Present**: Prénom référent field (optional)
- **Fixed**: Confirmation message uses prenom if provided, else "ton référent"
- **File**: `wishlist-modal.tsx:152-164, 115`

### ✅ P0: Share Clarity (KIDS_SHARE_CLARITY)
- **Fixed**: Share action separated from save — only shows after "Enregistrer ma demande"
- **Added**: Mailto warning modal when native share unavailable
- **File**: `wishlist-modal.tsx:273-295`

### ✅ Global: A11y Focus Management
- **Added**: Auto-focus on first field (Prénom) when modal opens
- **Added**: Focus on first error message when validation fails
- **Added**: ARIA attributes (aria-invalid, aria-describedby) on error fields
- **File**: `wishlist-modal.tsx:38-48, 136`

### ✅ Global: Anti-Double-Submit
- **Added**: isSubmitting state prevents multiple clicks
- **Added**: Disabled button during submission with "Enregistrement..." text
- **File**: `wishlist-modal.tsx:66-76, 254`

---

## Pro Modal (Booking) — Fixes Implemented

### ✅ P0: Missing Admin Fields (PRO_MISSING_ADMIN_FIELDS)
- **Already Present**: Adresse postale structure field (required, min 10 chars)
- **Already Present**: Sexe child field (select: Fille/Garçon/Autre)
- **Validation**: Both fields validated before step progression
- **File**: `booking-modal.tsx:25, 35, 412-423, 490-503`

### ✅ P0: Email/Phone Validation (PRO_EMAIL_PHONE_VALIDATION)
- **Already Present**: Email validation on blur with helpful error
- **Already Present**: Phone validation (FR format: 10 digits or +33) on blur
- **File**: `booking-modal.tsx:430-435, 441-446`

### ✅ P0: Step Labels & Sticky Recap (PRO_STEP_LABELS_AND_STICKY_RECAP)
- **Fixed**: Normalized step labels: "Étape 1/4 : Structure", "Étape 2/4 : Enfant", "Étape 3/4 : Validation"
- **Added**: Sticky recap bar on steps 3-4 showing session date + city + total price
- **File**: `booking-modal.tsx:89-100, 216-226`

### ✅ P1: Age Calculation Display
- **Added**: Real-time age display next to birthdate field (ex: "Âge : 12 ans")
- **File**: `booking-modal.tsx:103-110, 487-493`

### ✅ Global: A11y Focus Management
- **Added**: Auto-focus on first input when step changes
- **Added**: Focus on first error when validation fails
- **File**: `booking-modal.tsx:61-77, 405, 487`

### ✅ Global: Anti-Double-Submit
- **Already Present**: Loading state with spinner on final submit
- **Already Present**: Disabled button during submission
- **File**: `booking-modal.tsx:620-625`

---

## QA Checklist — Testing Instructions

### Kids Modal Testing
1. ✅ Open modal → Title should be "Ce séjour te plaît ?" (NOT "Ajouté")
2. ✅ Try email without @ → Should show "Il manque le @ ou le domaine"
3. ✅ Try email like "test@" → Should show error about domain
4. ✅ Try valid email → Should clear error
5. ✅ Enter message with < 20 chars → Should show error
6. ✅ Enter message with 20+ chars → Should clear error
7. ✅ "Enregistrer ma demande" button should be disabled while form invalid
8. ✅ After save → Title changes to "C'est noté !"
9. ✅ After save → Share button appears
10. ✅ Click share (if no native share) → Warning modal appears about mailto
11. ✅ Tab navigation should focus first field on open
12. ✅ Error state should focus first error message

### Pro Modal Testing
1. ✅ Step 1 (Structure): All fields required including Address
2. ✅ Address < 10 chars → Should show "Adresse trop courte"
3. ✅ Email without @ → Should show "Email invalide"
4. ✅ Phone with letters → Should show "Téléphone invalide"
5. ✅ Phone "0612345678" → Should pass validation
6. ✅ Step 2 (Child): Age should display next to birthdate
7. ✅ Sexe field required — can't proceed without selection
8. ✅ Steps 3-4: Sticky recap should show session + city + price
9. ✅ Step labels should be "Étape 1/4", "Étape 2/4", "Étape 3/4"
10. ✅ Tab navigation should focus first field when step changes
11. ✅ Submit button shows spinner during loading
12. ✅ Cannot double-submit (button disabled during loading)

---

## Email Confirmation Handling

**Current State**: No email service active
**UI Behavior**:
- Kids: Shows "Ta demande sera envoyée à {prenom}..." (future tense)
- Pro: Shows confirmation with reference, but no email promise

**Future Note**: When email service is enabled, update confirmation copy to reflect actual email sending.

---

## Technical Notes

### Backend Compatibility
- All new fields (addresseStructure, childSex) use "pass-through" strategy
- Data is sent to API; if backend doesn't store, form won't crash
- Existing minimisation approach maintained (childLastName sent as empty string)

### Browser Compatibility
- Native Share API: Falls back to mailto on unsupported browsers
- Mailto warning: Only shows when native share unavailable
- Focus management: Uses setTimeout for cross-browser compatibility

---

## Before/After Screenshots Needed

1. **Kids Modal**:
   - Initial state (before save)
   - Error states (email, message length)
   - Success state with share button
   - Mailto warning modal

2. **Pro Modal**:
   - Step 1 (Structure) with step label
   - Step 2 (Child) with age display
   - Steps 3-4 with sticky recap
   - Final confirmation

---

## Git Commit Message

```
fix(ui): implement P0/P1 checklist fixes for Kids + Pro forms

UI-ONLY CHANGES — No functional or breaking changes

Kids Modal (wishlist-modal.tsx):
- Fix sequenced UX: neutral title on open, success only after save
- Separate share action: only shows after successful save
- Add mailto warning when native share unavailable
- Add focus management for accessibility (A11y)
- Add anti-double-submit protection

Pro Modal (booking-modal.tsx):
- Normalize step labels to 1/4 format
- Add sticky recap with session info on steps 3-4
- Add real-time age calculation display for birthdate
- Add focus management for accessibility (A11y)

Addresses checklist from .agent/audits/checklist-form-ui.md

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```
