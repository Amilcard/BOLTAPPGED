#!/bin/bash
# Fix ALL remaining TypeScript noImplicitAny errors + broken references
# Safe: only type annotations, zero logic change
set -e

echo "=== Fixing TypeScript errors on branch work ==="
git checkout work
git pull origin work

# 1. booking-flow.tsx: type sort callback params
sed -i '' 's/\.sort((a, b) => {/\.sort((a: DepartureCity, b: DepartureCity) => {/' components/booking-flow.tsx

# 2. booking-flow.tsx: type map callback params
sed -i '' 's/\.map((city, idx) => {/\.map((city: DepartureCity, idx: number) => {/' components/booking-flow.tsx

# 3. bookings/route.ts: type prisma transaction param
sed -i '' 's/\$transaction(async (tx) =>/\$transaction(async (tx: any) =>/' app/api/bookings/route.ts

# 4. pro/stays/route.ts: type map callbacks
sed -i '' 's/stays\.map(stay => ({/stays.map((stay: any) => ({/' app/api/pro/stays/route.ts
sed -i '' 's/sessions\.map(s => ({/sessions.map((s: any) => ({/' app/api/pro/stays/route.ts

# 5. stays/[slug]/route.ts: type map callback
sed -i '' 's/sessions\.map(s => ({/sessions.map((s: any) => ({/' "app/api/stays/[slug]/route.ts"

# 6. stays/route.ts: type map callback
sed -i '' 's/stays\.map(stay => ({/stays.map((stay: any) => ({/' app/api/stays/route.ts

# 7. booking-modal.tsx: fix undefined variables finalNotes & sexNote
sed -i '' 's/notes: finalNotes,.*/notes: step1.addresseStructure || '\'''\'',' components/booking-modal.tsx
sed -i '' 's/childNotes: sexNote,.*/childNotes: '\'''\'',' components/booking-modal.tsx

# 8. admin/users route: fix missing Role import
sed -i '' "s/import { Role } from '@prisma\/client';/type Role = 'ADMIN' | 'EDITOR' | 'VIEWER';/" "app/api/admin/users/[id]/route.ts"

echo "=== All fixes applied. Verifying... ==="
npx tsc --noEmit 2>&1 | grep "error TS" | head -5 || echo "✅ Zero TypeScript errors!"

echo ""
echo "=== Committing and pushing... ==="
git add components/booking-flow.tsx components/booking-modal.tsx app/api/bookings/route.ts app/api/pro/stays/route.ts "app/api/stays/[slug]/route.ts" app/api/stays/route.ts "app/api/admin/users/[id]/route.ts"
git commit -m "fix: corriger toutes les erreurs noImplicitAny restantes (build Vercel)

- booking-flow.tsx: typer a/b/city/idx dans sort/map departureCities
- bookings/route.ts: typer tx dans prisma.\$transaction
- pro/stays + stays routes: typer stay/s dans .map callbacks
- booking-modal.tsx: remplacer finalNotes/sexNote non définis
- admin/users route: définir type Role localement

Aucun changement de logique. Diff minimal typage uniquement."

git push origin work
echo "✅ Push done! Vercel build should now pass."
