export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getSupabaseUser } from '@/lib/supabase-server';
import { z } from 'zod';
import { sendInscriptionConfirmation, sendAdminNewInscriptionNotification, sendStructureCodeEmail, sendNewEducateurAlert } from '@/lib/email';
import { randomBytes } from 'crypto';
import { auditLog, getClientIp } from '@/lib/audit-log';
import { isRateLimited } from '@/lib/rate-limit';
import { resolveCodeToStructure } from '@/lib/structure';
const inscriptionSchema = z.object({
  staySlug: z.string().min(1),
  sessionDate: z.string().min(1), // Date de début session
  cityDeparture: z.string().min(1),
  organisation: z.string().min(1),
  socialWorkerName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  childFirstName: z.string().min(1),
  childLastName: z.string().optional().default(''),
  childBirthDate: z.string().min(1),
  childSex: z.enum(['M', 'F']).optional(),
  optionsEducatives: z.string().optional(),
  remarques: z.string().optional(),
  priceTotal: z.number().min(0),
  consent: z.boolean().refine(v => v, { message: 'Consentement requis' }),
  // RGPD Art. 8 / CNIL : consentement parental explicite pour mineurs < 15 ans
  parentalConsent: z.boolean().optional(),
  paymentMethod: z.enum(['card', 'bank_transfer', 'cheque', 'transfer', 'check']).optional().default('bank_transfer'),
  // Champs structure (Phase 1 espace structure)
  structureCode: z.string().regex(/^[A-Z0-9]{6,10}$/).optional(),  // Code 6 chars (CDS) ou 10 chars (directeur)
  structureName: z.string().min(1),               // Nom structure (obligatoire)
  structureAddress: z.string().optional(),         // Adresse
  structurePostalCode: z.string().regex(/^\d{5}$/),  // CP (obligatoire, 5 chiffres)
  structureCity: z.string().min(1),                // Ville (obligatoire)
  structureType: z.string().optional(),            // asso, ccas, centre_social, etc.
  structureEmail: z.string().email().optional(),   // Email structure (optionnel)
});

// Mapping front-end → DB constraint values
const PAYMENT_METHOD_MAP: Record<string, string> = {
  card: 'stripe',
  bank_transfer: 'transfer',
  cheque: 'check',
  transfer: 'transfer',
  check: 'check',
};

export async function POST(request: NextRequest) {
  // Hoisted — permet au catch global de restaurer la capacité si l'inscription
  // échoue après la décrémentation atomique via gd_check_and_decrement_capacity.
  let capacityDecremented = false;
  let rollbackCtx: { slug: string; date: string } | null = null;
  try {
    // Rate limiting DB-backed — persiste entre cold starts (complément middleware in-memory)
    const ip = getClientIp(request) ?? 'unknown';
    if (await isRateLimited('insc', ip, 5, 5)) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Trop de requêtes. Réessayez dans quelques minutes.' } },
        { status: 429, headers: { 'Retry-After': '300' } }
      );
    }

    const supabase = getSupabaseAdmin();       // service_role — pour INSERT, structures, anti-doublon
    const supabasePublic = getSupabaseUser(); // anon — pour SELECT publics (prix, sessions, stays)
    const body = await request.json();

    // ── Enrichissement via pro session (structureCode pré-rempli si connecté pro) ──
    const proToken = request.cookies.get('gd_pro_session')?.value;
    if (proToken && !body.structureCode) {
      try {
        const secret = process.env.NEXTAUTH_SECRET;
        if (secret) {
          const { jwtVerify } = await import('jose');
          const { payload } = await jwtVerify(proToken, new TextEncoder().encode(secret));
          const p = payload as Record<string, unknown>;
          if (p.type === 'pro_session' && p.structureCode) {
            body.structureCode = p.structureCode as string;
          }
        }
      } catch { /* pro session invalide — on continue sans pré-remplissage */ }
    }

    // ── Vérification Turnstile (skip si clé non configurée — env de test) ──
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret) {
      if (!body.turnstileToken) {
        return NextResponse.json(
          { error: { code: 'CAPTCHA_REQUIRED', message: 'Vérification anti-robot requise.' } },
          { status: 400 }
        );
      }
      try {
        const tvRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: turnstileSecret, response: body.turnstileToken }),
          signal: AbortSignal.timeout(3000), // H3 fix : timeout 3s, pas de blocage si Cloudflare down
        });
        const tvData = await tvRes.json();
        if (!tvData.success) {
          return NextResponse.json(
            { error: { code: 'CAPTCHA_FAILED', message: 'Vérification anti-robot échouée. Rechargez la page.' } },
            { status: 400 }
          );
        }
      } catch (tvErr) {
        // Turnstile timeout ou erreur réseau — log + allow (graceful fallback)
        console.error('[inscriptions] Turnstile verification timeout/error, allowing:', tvErr instanceof Error ? tvErr.message : tvErr);
      }
    }

    const parsed = inscriptionSchema.safeParse(body);

    if (!parsed.success) {
      console.error('Validation error:', parsed.error.issues);
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Données invalides' } },
        { status: 400 }
      );
    }

    const data = parsed.data;
    // B3 — capturer le prix envoyé par le front AVANT tout override serveur.
    // Sert au logging RGPD si le serveur le remplace par la valeur DB (écart silencieux).
    const frontPriceTotal = data.priceTotal;

    // Validation âge (garde-fou serveur : 3-17 ans global GED)
    const birthDate = new Date(data.childBirthDate);
    if (isNaN(birthDate.getTime())) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Date de naissance invalide' } },
        { status: 400 }
      );
    }
    // Référence : date de début de session (pas aujourd'hui)
    // Un enfant doit avoir l'âge requis au moment du départ, pas à l'inscription
    const sessionStartDate = new Date(data.sessionDate.split('T')[0]);
    let age = sessionStartDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = sessionStartDate.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && sessionStartDate.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 3 || age > 17) {
      return NextResponse.json(
        { error: { code: 'AGE_INVALID', message: `Âge hors tranche (${age} ans). Les séjours sont réservés aux 3-17 ans.` } },
        { status: 400 }
      );
    }

    // RGPD Art. 8 / CNIL : consentement parental obligatoire pour les mineurs < 15 ans
    if (age < 15 && !data.parentalConsent) {
      return NextResponse.json(
        { error: { code: 'PARENTAL_CONSENT_REQUIRED', message: 'Le consentement parental est obligatoire pour les mineurs de moins de 15 ans (RGPD Art. 8).' } },
        { status: 400 }
      );
    }

    // ── PATCH SÉCURITÉ FINANCIÈRE : vérification prix côté serveur ──
    // Normaliser la date envoyée par le front (peut être ISO ou date pure)
    const normalizedDate = data.sessionDate.split('T')[0]; // "2026-07-05T00:00:00Z" → "2026-07-05"
    // Stratégie: chercher par date pure d'abord, fallback par plage si timestamptz
    interface PriceRow { price_ged_total: number; transport_surcharge_ged: number; city_departure: string; }
    let priceRow: PriceRow | null = null;
    let priceError: unknown = null;

    // Tentative 1: match exact date pure
    const { data: priceRows1, error: priceErr1 } = await supabasePublic
      .from('gd_session_prices')
      .select('price_ged_total, transport_surcharge_ged, city_departure')
      .eq('stay_slug', data.staySlug)
      .eq('start_date', normalizedDate)
      .eq('city_departure', data.cityDeparture)
      .limit(1);

    if (priceErr1) {
      console.error('Price DB error (tentative 1):', priceErr1);
      return NextResponse.json(
        { error: { code: 'PRICE_NOT_FOUND', message: 'Impossible de vérifier le prix pour cette session.' } },
        { status: 400 }
      );
    }
    if (priceRows1 && priceRows1.length > 0) {
      priceRow = priceRows1[0];
    } else {
      // Tentative 2: plage timestamps
      const { data: priceRows2, error: priceErr2 } = await supabasePublic
        .from('gd_session_prices')
        .select('price_ged_total, transport_surcharge_ged, city_departure')
        .eq('stay_slug', data.staySlug)
        .gte('start_date', `${normalizedDate}T00:00:00`)
        .lte('start_date', `${normalizedDate}T23:59:59`)
        .eq('city_departure', data.cityDeparture)
        .limit(1);
      priceRow = priceRows2?.[0] ?? null;
      priceError = priceErr2;
    }

    if (priceError || !priceRow) {
      // Fallback : prix sans transport si ville non trouvée pour cette date
      const { data: baseRows1 } = await supabasePublic
        .from('gd_session_prices')
        .select('price_ged_total')
        .eq('stay_slug', data.staySlug)
        .eq('start_date', normalizedDate)
        .eq('city_departure', 'sans_transport')
        .limit(1);

      let basePriceRow = baseRows1?.[0] ?? null;

      if (!basePriceRow) {
        // Tentative 2: plage timestamps
        const { data: baseRows2 } = await supabasePublic
          .from('gd_session_prices')
          .select('price_ged_total')
          .eq('stay_slug', data.staySlug)
          .gte('start_date', `${normalizedDate}T00:00:00`)
          .lte('start_date', `${normalizedDate}T23:59:59`)
          .eq('city_departure', 'sans_transport')
          .limit(1);
        basePriceRow = baseRows2?.[0] ?? null;
      }

      if (!basePriceRow) {
        console.error('PRICE_NOT_FOUND:', { slug: data.staySlug, date: data.sessionDate, city: data.cityDeparture });
        return NextResponse.json(
          { error: { code: 'PRICE_NOT_FOUND', message: 'Impossible de vérifier le prix pour cette session.' } },
          { status: 400 }
        );
      }

      // FIX PRIX MULTI-SÉJOURS: le front calcule base(sans_transport) + transport_surcharge
      // Si la ville n'est pas dans gd_session_prices pour cette date, chercher le surcoût
      // transport via une autre session pour cette ville (données UFOVAL peuvent être incomplètes)
      const sansBasePrice = basePriceRow.price_ged_total ?? 0;
      let cityTransportSurcharge = 0;
      if (data.cityDeparture !== 'sans_transport') {
        const { data: cityTransportRows } = await supabasePublic
          .from('gd_session_prices')
          .select('transport_surcharge_ged')
          .eq('stay_slug', data.staySlug)
          .eq('city_departure', data.cityDeparture)
          .limit(1);
        cityTransportSurcharge = cityTransportRows?.[0]?.transport_surcharge_ged ?? 0;
      }

      // Accepter si le prix correspond à la base OU à base + transport (formule front)
      const frontCalcFallback = sansBasePrice + cityTransportSurcharge;
      const matchesSansTransport = Math.abs(data.priceTotal - sansBasePrice) <= 1;
      const matchesFrontCalcFallback = Math.abs(data.priceTotal - frontCalcFallback) <= 1;

      if (!matchesSansTransport && !matchesFrontCalcFallback) {
        console.error('PRICE_MISMATCH (fallback):', {
          frontend: data.priceTotal,
          sansBase: sansBasePrice,
          frontCalc: frontCalcFallback,
          transport: cityTransportSurcharge,
        });
        return NextResponse.json(
          { error: { code: 'PRICE_MISMATCH', message: 'Le prix envoyé ne correspond pas au tarif en base.' } },
          { status: 400 }
        );
      }
      // Forcer le prix vérifié (frontCalc si disponible, sinon sansBase)
      data.priceTotal = matchesFrontCalcFallback ? Math.round(frontCalcFallback) : sansBasePrice;
      // B3 — tracer tout écart silencieux front ↔ serveur > 1€ (PII table gd_inscriptions, CLAUDE.md §15)
      if (Math.abs(frontPriceTotal - data.priceTotal) > 1) {
        console.warn('[inscriptions] price_corrected (fallback):', {
          front: frontPriceTotal,
          server: data.priceTotal,
          diff: data.priceTotal - frontPriceTotal,
          city: data.cityDeparture,
          reason: 'frontend_calc_mismatch',
        });
      }
    } else {
      // Prix exact trouvé pour cette ville + session
      const serverCityPrice = priceRow.price_ged_total ?? 0;
      const transportSurcharge = priceRow.transport_surcharge_ged ?? 0;

      // FIX PRIX MULTI-SÉJOURS: Le front calcule base(sans_transport) + transport_surcharge_ged
      // Récupérer aussi le prix sans_transport pour valider la formule du front
      // (certains séjours UFOVAL ont price_ged_total(ville) ≠ price_ged_total(sans_transport) + surcharge)
      const { data: sansRows } = await supabasePublic
        .from('gd_session_prices')
        .select('price_ged_total')
        .eq('stay_slug', data.staySlug)
        .eq('start_date', normalizedDate)
        .eq('city_departure', 'sans_transport')
        .limit(1);
      const sansBasePrice = sansRows?.[0]?.price_ged_total ?? null;
      // Formule attendue par le front: base_sans_transport + transport_surcharge_ged
      const frontCalcPrice = sansBasePrice !== null ? sansBasePrice + transportSurcharge : null;

      // Accepter si le prix correspond AU PRIX VILLE ou À LA FORMULE FRONT
      const matchesCityTotal = Math.abs(data.priceTotal - serverCityPrice) <= 1;
      const matchesFrontCalc = frontCalcPrice !== null && Math.abs(data.priceTotal - frontCalcPrice) <= 1;

      if (!matchesCityTotal && !matchesFrontCalc) {
        console.error('PRICE_MISMATCH:', {
          frontend: data.priceTotal,
          serverCityPrice,
          frontCalcPrice,
          sansBasePrice,
          transportSurcharge,
          city: data.cityDeparture,
        });
        return NextResponse.json(
          { error: { code: 'PRICE_MISMATCH', message: 'Le prix envoyé ne correspond pas au tarif en base.' } },
          { status: 400 }
        );
      }
      // Forcer le prix serveur validé (prix ville DB = source de vérité)
      data.priceTotal = serverCityPrice;
      // B3 — tracer tout écart silencieux front ↔ serveur > 1€ (PII table gd_inscriptions, CLAUDE.md §15)
      if (Math.abs(frontPriceTotal - data.priceTotal) > 1) {
        console.warn('[inscriptions] price_corrected:', {
          front: frontPriceTotal,
          server: data.priceTotal,
          diff: data.priceTotal - frontPriceTotal,
          city: data.cityDeparture,
          reason: 'frontend_calc_mismatch',
        });
      }
    }

    // Validation âge session-spécifique AVANT la décrémentation de capacité
    // (le RPC décrémente atomiquement — une validation post-RPC perdrait la place si l'âge est invalide)
    const { data: sessionAgeBounds } = await supabasePublic
      .from('gd_stay_sessions')
      .select('age_min, age_max')
      .eq('stay_slug', data.staySlug)
      .eq('start_date', normalizedDate)
      .single();

    if (sessionAgeBounds) {
      const ageMin = sessionAgeBounds.age_min ?? 3;
      const ageMax = sessionAgeBounds.age_max ?? 17;
      if (age < ageMin || age > ageMax) {
        return NextResponse.json(
          { error: { code: 'AGE_INCOMPATIBLE', message: `Âge incompatible (${age} ans). Ce séjour requiert ${ageMin}-${ageMax} ans.` } },
          { status: 400 }
        );
      }
    }

    // ── CAPACITY CHECK + DECREMENT atomique via RPC (SELECT FOR UPDATE + UPDATE) ──
    const { data: capacityCheck, error: rpcError } = await supabase
      .rpc('gd_check_and_decrement_capacity', {
        p_slug: data.staySlug,
        p_start_date: normalizedDate,
      });

    if (rpcError) {
      // Pas de fallback non-atomique — risque d'overbooking
      console.error('Capacity check RPC error (inscription bloquée):', rpcError);
      return NextResponse.json(
        { error: { code: 'CAPACITY_CHECK_FAILED', message: 'Vérification de disponibilité impossible. Veuillez réessayer.' } },
        { status: 503 }
      );
    } else if (capacityCheck && !capacityCheck.allowed) {
      return NextResponse.json(
        { error: { code: 'SESSION_FULL', message: 'Cette session est complète. Plus de places disponibles.' } },
        { status: 400 }
      );
    }

    // Flag : seat effectivement décrémenté (RPC retourne seats_left uniquement dans ce cas).
    // Si l'INSERT inscription échoue plus bas, on devra restituer le seat via gd_increment_capacity.
    capacityDecremented = capacityCheck?.seats_left !== undefined;
    rollbackCtx = { slug: data.staySlug, date: normalizedDate };
    const restoreCapacityIfNeeded = async (): Promise<void> => {
      if (!capacityDecremented) return;
      const { error: restoreErr } = await supabase.rpc('gd_increment_capacity', {
        p_slug: data.staySlug,
        p_start_date: normalizedDate,
      });
      if (restoreErr) {
        console.error('[inscriptions] capacity rollback failed:', restoreErr.message);
      } else {
        capacityDecremented = false; // évite double-rollback via catch global
      }
    };

    // Validation âge depuis le résultat RPC ou fallback DB
    const ageMin = capacityCheck?.age_min ?? null;
    const ageMax = capacityCheck?.age_max ?? null;
    if (ageMin !== null && ageMax !== null) {
      if (age < ageMin || age > ageMax) {
        await restoreCapacityIfNeeded();
        return NextResponse.json(
          { error: { code: 'AGE_INCOMPATIBLE', message: `Âge incompatible (${age} ans). Ce séjour requiert ${ageMin}-${ageMax} ans.` } },
          { status: 400 }
        );
      }
    }

    // ── VÉRIFICATION cohérence session → séjour ──
    const { data: sessionCheckRows } = await supabasePublic
      .from('gd_stay_sessions')
      .select('stay_slug')
      .eq('stay_slug', data.staySlug)
      .eq('start_date', normalizedDate)
      .limit(1);
    const sessionCheck = sessionCheckRows?.[0] ?? null;

    // Si pas de session trouvée, on vérifie au moins que le séjour existe
    // (certains séjours n'ont pas de sessions dans gd_stay_sessions mais ont des prix)
    if (!sessionCheck) {
      const { data: stayExists } = await supabasePublic
        .from('gd_stays')
        .select('slug')
        .eq('slug', data.staySlug)
        .limit(1);
      if (!stayExists || stayExists.length === 0) {
        return NextResponse.json(
          { error: { code: 'SESSION_INVALID', message: 'Ce séjour n\'existe pas.' } },
          { status: 400 }
        );
      }
      // Le séjour existe mais pas de session dans gd_stay_sessions → on continue
      // (la vérification prix a déjà validé via gd_session_prices)
    }

    // ── VÉRIFICATION is_full UFOVAL (source de vérité) ──
    const { data: isFullRows } = await supabasePublic
      .from('gd_session_prices')
      .select('is_full')
      .eq('stay_slug', data.staySlug)
      .eq('start_date', normalizedDate)
      .eq('city_departure', data.cityDeparture)
      .limit(1);
    const isFullRow = isFullRows?.[0] ?? null;

    if (isFullRow?.is_full === true) {
      await restoreCapacityIfNeeded();
      return NextResponse.json(
        { error: { code: 'SESSION_FULL', message: 'Cette session est complète.' } },
        { status: 400 }
      );
    }

    // Créer l'inscription dans gd_inscriptions
    // Phase 1 pro : organisation dédiée + dossier_ref généré côté serveur
    const now = new Date();
    const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = randomBytes(5).toString('hex').substring(0, 8).toUpperCase();
    const dossierRef = `DOS-${datePrefix}-${randomSuffix}`;
    // Remarques nettoyées (on ne stocke plus l'orga dedans, elle a sa propre colonne)
    const cleanRemarks = data.remarques || '';
    // Normaliser la méthode de paiement pour correspondre à la contrainte DB
    const dbPaymentMethod = PAYMENT_METHOD_MAP[data.paymentMethod] || 'transfer';
    // Anti-doublon : vérifier si une inscription identique existe déjà
    const { data: existing } = await supabase
      .from('gd_inscriptions')
      .select('id, dossier_ref')
      .eq('referent_email', data.email)
      .eq('sejour_slug', data.staySlug)
      .eq('session_date', normalizedDate)
      .eq('jeune_date_naissance', (data.childBirthDate as string).split('T')[0])
      .not('status', 'eq', 'annulee')
      .maybeSingle();

    if (existing) {
      await restoreCapacityIfNeeded();
      return NextResponse.json(
        { error: { code: 'DUPLICATE', message: 'Une inscription identique existe déjà.', dossierRef: existing.dossier_ref } },
        { status: 409 }
      );
    }

    // ── Résolution structure ──────────────────────────────────────────
    let structureId: string | null = null;
    let structurePendingName: string | null = null;

    if (data.structureCode) {
      // L'éducateur a un code → résolution via resolveCodeToStructure
      // Supporte codes CDS (6 chars), directeur (10 chars) et gd_structure_access_codes
      const resolved = await resolveCodeToStructure(data.structureCode);

      if (resolved) {
        structureId = resolved.structure.id as string;
      } else {
        // Code invalide ou expiré/révoqué → on continue sans bloquer, mais on log
        console.warn('[inscriptions] Code structure invalide ou expiré');
        structurePendingName = data.structureName;
      }
    } else {
      // Pas de code → chercher structure existante par nom + CP (déduplication)
      const { data: existingStruct } = await supabase
        .from('gd_structures')
        .select('id')
        .ilike('name', data.structureName)
        .eq('postal_code', data.structurePostalCode)
        .eq('status', 'active')
        .maybeSingle();

      if (existingStruct) {
        structureId = existingStruct.id;
      } else {
        // Structures sur même CP (pour alerte admin si doublon potentiel)
        const { data: existingOnCP } = await supabase
          .from('gd_structures')
          .select('id, name, code, city')
          .eq('postal_code', data.structurePostalCode)
          .eq('status', 'active');

        // Créer la structure automatiquement
        const { data: newStruct, error: structErr } = await supabase
          .from('gd_structures')
          .insert({
            name: data.structureName,
            address: data.structureAddress || null,
            postal_code: data.structurePostalCode,
            city: data.structureCity,
            type: data.structureType || null,
            email: data.structureEmail || null,
            domain: null,  // Pas de domaine automatique en Phase 1
            created_by_email: data.email,
          })
          .select('id, code')
          .single();

        if (newStruct && !structErr) {
          structureId = newStruct.id;
          // Envoyer le code par email à l'éducateur (fire-and-forget)
          const codeRecipient = data.structureEmail || data.email;
          await sendStructureCodeEmail({
            recipientEmail: codeRecipient,
            structureName: data.structureName,
            structureCode: newStruct.code,
            educateurPrenom: data.socialWorkerName,
          }).catch((err) => console.error('[inscriptions] sendStructureCodeEmail failed:', err));

          // Si des structures existaient déjà sur ce CP → alerte admin
          if (existingOnCP && existingOnCP.length > 0) {
            await sendNewEducateurAlert({
              existingStructures: existingOnCP as Array<{ name: string; code: string; city: string }>,
              newEducateurNom: data.socialWorkerName,
              newEducateurEmail: data.email,
              structureDeclaredName: data.structureName,
              postalCode: data.structurePostalCode,
            }).catch((err) => console.error('[inscriptions] sendNewEducateurAlert failed:', err));
          }
        } else {
          console.error('[inscriptions] Erreur création structure:', structErr);
          structurePendingName = data.structureName;
        }
      }
    }

    const { data: inscriptionRows, error } = await supabase
      .from('gd_inscriptions')
      .insert({
        sejour_slug: data.staySlug,
        session_date: normalizedDate,
        city_departure: data.cityDeparture,
        jeune_prenom: data.childFirstName,
        jeune_nom: data.childLastName || '',
        jeune_date_naissance: data.childBirthDate,
        referent_nom: data.socialWorkerName,
        referent_email: data.email,
        referent_tel: data.phone,
        organisation: data.structureName,  // Le champ organisation reste rempli pour rétrocompatibilité
        dossier_ref: dossierRef,
        // suivi_token est auto-généré par Supabase (DEFAULT gen_random_uuid())
        options_educatives: data.optionsEducatives || null,
        jeune_sexe: data.childSex || null,
        remarques: cleanRemarks,
        price_total: Math.round(data.priceTotal),
        status: 'en_attente',
        payment_status: 'pending_payment',
        payment_method: dbPaymentMethod,
        // Champs structure
        structure_id: structureId,
        structure_pending_name: structurePendingName,
        structure_email: data.structureEmail || null,
        structure_postal_code: data.structurePostalCode,
        structure_city: data.structureCity,
        structure_type: data.structureType || null,
        structure_address: data.structureAddress || null,
        // RGPD : consentement parental pour < 15 ans
        parental_consent_at: data.parentalConsent ? new Date().toISOString() : null,
        parental_consent_version: data.parentalConsent ? 'v2026.1' : null,
      })
      .select();
    const inscription = inscriptionRows?.[0] ?? null;

    if (error || !inscription) {
      console.error('Supabase insert error:', error);
      await restoreCapacityIfNeeded();
      return NextResponse.json(
        { error: { code: 'INSERT_ERROR', message: 'Impossible de créer l\'inscription.' } },
        { status: 500 }
      );
    }

    // INSERT inscription réussi — le seat est définitivement attribué.
    // Neutraliser le flag pour éviter un rollback accidentel depuis le catch global
    // sur une exception ultérieure (email, audit, etc.).
    capacityDecremented = false;

    // M9 — Audit RGPD : enregistrer le consentement parental si applicable (Art. 9 données mineurs)
    if (data.parentalConsent && inscription.id) {
      await auditLog(supabase, {
        action: 'create',
        resourceType: 'inscription',
        resourceId: inscription.id as string,
        actorType: 'referent',
        actorId: data.email,
        ipAddress: getClientIp(request),
        metadata: {
          parental_consent_version: 'v2026.1',
          child_birth_date: data.childBirthDate,
        },
      });
    }

    // B3 — Audit RGPD : tracer tout écart silencieux prix front ↔ serveur > 1€.
    // Mutation PII (gd_inscriptions) — auditLog obligatoire (CLAUDE.md §15).
    if (inscription.id && Math.abs(frontPriceTotal - data.priceTotal) > 1) {
      await auditLog(supabase, {
        action: 'update',
        resourceType: 'inscription',
        resourceId: inscription.id as string,
        actorType: 'referent',
        actorId: data.email,
        ipAddress: getClientIp(request),
        metadata: {
          event: 'price_corrected',
          front: frontPriceTotal,
          server: data.priceTotal,
          diff: data.priceTotal - frontPriceTotal,
          city: data.cityDeparture,
          reason: 'frontend_calc_mismatch',
        },
      });
    }

    // Récupérer le nom marketing du séjour pour l'email
    const { data: stayInfo } = await supabasePublic
      .from('gd_stays')
      .select('marketing_title')
      .eq('slug', data.staySlug)
      .limit(1);
    const sejourDisplayName = stayInfo?.[0]?.marketing_title || data.staySlug.replace(/-/g, ' ');

    // Emails non-bloquants (fire-and-forget)
    const appBaseUrl = process.env.NEXTAUTH_URL || 'https://app.groupeetdecouverte.fr';
    const suiviUrl = inscription.suivi_token ? `${appBaseUrl}/suivi/${inscription.suivi_token}` : null;
    const emailData = {
      referentNom: data.socialWorkerName,
      referentEmail: data.email,
      jeunePrenom: data.childFirstName,
      jeuneNom: data.childLastName || '',
      sejourSlug: sejourDisplayName,
      sessionDate: normalizedDate,
      cityDeparture: data.cityDeparture === 'sans_transport' ? 'Sans transport' : data.cityDeparture,
      // B3 — source de vérité = prix persisté en DB (évite tout désalignement futur
      // si un trigger/policy modifie price_total à l'INSERT).
      priceTotal: (inscription.price_total as number | null) ?? data.priceTotal,
      paymentMethod: data.paymentMethod,
      paymentReference: inscription.payment_reference || inscription.id,
      dossierRef: inscription.dossier_ref || dossierRef,
      organisation: data.organisation,
      suiviUrl,
    };
    // Await both emails before returning — fire-and-forget is killed by serverless on return
    await Promise.allSettled([
      sendInscriptionConfirmation(emailData),
      sendAdminNewInscriptionNotification(emailData),
    ]);

    const response = NextResponse.json(
      {
        id: inscription.id,
        payment_reference: inscription.payment_reference,
        dossier_ref: inscription.dossier_ref,
        suivi_token: inscription.suivi_token,
        status: inscription.status,
      },
      { status: 201 }
    );

    // Supprimer cookie pro après inscription réussie (re-auth requise pour chaque enfant)
    // + révoquer le jti dans gd_revoked_tokens pour invalider immédiatement le JWT
    // si un attaquant l'avait intercepté (S4 backlog).
    const proCookie = request.cookies.get('gd_pro_session')?.value;
    if (proCookie) {
      response.cookies.set('gd_pro_session', '', { maxAge: 0, path: '/' });
      try {
        const secret = process.env.NEXTAUTH_SECRET;
        if (secret) {
          const { jwtVerify } = await import('jose');
          const encodedSecret = new TextEncoder().encode(secret);
          const { payload } = await jwtVerify(proCookie, encodedSecret).catch(() => ({ payload: null }));
          if (payload?.jti && payload?.exp) {
            const expiresAt = new Date(payload.exp * 1000).toISOString();
            const { error: dbErr } = await supabase
              .from('gd_revoked_tokens')
              .insert({ jti: payload.jti as string, expires_at: expiresAt });
            if (dbErr && dbErr.code !== '23505') {
              console.error('[inscriptions] pro jti revoke failed:', dbErr.message);
            }
          }
        }
      } catch (revokeErr) {
        console.error('[inscriptions] pro session revoke exception:', revokeErr);
      }
    }

    return response;
  } catch (error: unknown) {
    console.error('POST /api/inscriptions error:', error);

    // Exception non-catchée entre la décrémentation RPC et la finalisation INSERT →
    // restaurer le seat pour éviter l'overbooking silencieux.
    if (capacityDecremented && rollbackCtx) {
      try {
        const supabase = getSupabaseAdmin();
        const { error: restoreErr } = await supabase.rpc('gd_increment_capacity', {
          p_slug: rollbackCtx.slug,
          p_start_date: rollbackCtx.date,
        });
        if (restoreErr) {
          console.error('[inscriptions] catch-global capacity rollback failed:', restoreErr.message);
        }
      } catch (rollbackErr) {
        console.error('[inscriptions] catch-global capacity rollback exception:', rollbackErr);
      }
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Erreur serveur.' } },
      { status: 500 }
    );
  }
}
