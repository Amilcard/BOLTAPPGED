/**
 * upload-pdf-sejours.mjs
 * ──────────────────────────────────────────────────────────────────────────
 * Upload les PDFs locaux vers Supabase Storage (bucket: descriptifs)
 * puis met à jour le champ pdf_url dans gd_stays.
 *
 * Usage :
 *   node scripts/upload-pdf-sejours.mjs --dry-run   ← simulation, rien ne change
 *   node scripts/upload-pdf-sejours.mjs             ← injection réelle
 *
 * Prérequis :
 *   npm install @supabase/supabase-js   (une seule fois dans le projet)
 * ──────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, basename, resolve } from 'path';

// ── Config ──────────────────────────────────────────────────────────────────
// ⚠️  Ne JAMAIS hardcoder de secrets ici — utiliser les variables d'environnement
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iirfvndgzutbxwfdwawu.supabase.co';
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY manquante. Lancez avec :\n   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/upload-pdf-sejours.mjs');
  process.exit(1);
}
const BUCKET            = 'descriptifs';
const PDF_FOLDER        = '/Users/laidhamoudi/Downloads/PREPARATION ETE 2026/DESCRIPTIF SEJOURS GED 2026';
const DRY_RUN           = process.argv.includes('--dry-run');

// ── Mapping : titre exact (tel qu'en base) → nom de fichier PDF local ───────
const MAPPING = [
  { title: 'HUSKY ADVENTURE',      pdf: '7_HUSKY ADVENTURE.pdf'      },
  { title: 'MY LITTLE FOREST',     pdf: '6_MY LITTLE FOREST.pdf'     },
  { title: 'BABY RIDERS',          pdf: '26_BABY RIDERS.pdf'         },
  { title: 'SWIM ACADEMY',         pdf: '27_SWIM ACADEMY.pdf'        },
  { title: 'ALPOO KIDS',           pdf: '16_ALPOO KIDS.pdf'          },
  { title: 'ALPINE TREK JUNIOR',   pdf: '20_ALPINE TREK JUNIOR.pdf'  },
  { title: 'GAMING HOUSE 1850',    pdf: '10_GAMING HOUSE 1850.pdf'   },
  { title: 'SURVIVOR CAMP 74',     pdf: '5_SURVIVOR CAMP 74.pdf'     },
  { title: 'INTO THE WILD',        pdf: '2_INTO THE WILD.pdf'        },
  { title: 'DUNE & OCEAN KIDS',    pdf: '15_DUNE & OCEAN KIDS.pdf'   },
  { title: 'PARKOUR',              pdf: '22_PARKOUR.pdf'             },
  { title: 'DUAL CAMP',            pdf: '9_DUAL CAMP.pdf'            },
  { title: 'ROCKS & PADDLE',       pdf: '21_ROCKS & PADDLE.pdf'      },
  { title: 'ADRENALINE & CHILL',   pdf: '8_ADRENALINE & CHILL.pdf'   },
  { title: 'BLUE EXPERIENCE',      pdf: '24_BLUE EXPERIENCE.pdf'     },
  { title: 'WILDLIFE REPORTER',    pdf: '12_WILDLIFE REPORTER.pdf'   },
  { title: 'ALPINE SKY CAMP',      pdf: '4_ALPINE SKY CAMP.pdf'      },
  { title: 'GRAVITY BIKE PARK',    pdf: '23_GRAVITY BIKE PARK.pdf'   },
  { title: 'WEST COAST SURF CAMP', pdf: '3_WEST COAST SURF CAMP.pdf' },
  { title: 'RIVIERA SPEED CLUB',   pdf: '25_RIVIERA SPEED CLUB.pdf'  },
  { title: 'MX RIDER ACADEMY',     pdf: '10_MX RIDER ACADEMY.pdf'    },
  { title: 'AZUR DIVE & JET',      pdf: '14_AZUR DIVE & JET.pdf'     },
  { title: 'CORSICA WILD TRIP',    pdf: '1_CORSICA WILD TRIP.pdf'    },
  { title: 'BRETAGNE OCEAN RIDE',  pdf: 'BRETAGNE OCEAN RIDE.pdf'    },
];

// ── Main ─────────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

console.log(`\n${'═'.repeat(70)}`);
console.log(`  GED 2026 — Upload PDFs Supabase Storage → gd_stays.pdf_url`);
console.log(`  Mode : ${DRY_RUN ? '🔍 DRY-RUN (aucune modification)' : '🚀 INJECTION RÉELLE'}`);
console.log(`${'═'.repeat(70)}\n`);

// 1. Récupérer les slugs et pdf_url actuels depuis gd_stays
console.log('→ Lecture gd_stays en base…');
const { data: stays, error: staysErr } = await supabase
  .from('gd_stays')
  .select('slug, marketing_title, pdf_url');

if (staysErr) {
  console.error('❌ Erreur lecture gd_stays :', staysErr.message);
  process.exit(1);
}
console.log(`   ${stays.length} séjours trouvés en base.\n`);

// Indexer par marketing_title pour lookup rapide (= titre affiché dans l'app)
const staysByTitle = Object.fromEntries(
  stays.map(s => [s.marketing_title?.trim()?.toUpperCase(), s]).filter(([key]) => key)
);

// 2. Vérifier / créer le bucket
if (!DRY_RUN) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === BUCKET);
  if (!exists) {
    console.log(`→ Création du bucket "${BUCKET}"…`);
    const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (bucketErr) {
      console.error('❌ Impossible de créer le bucket :', bucketErr.message);
      process.exit(1);
    }
    console.log(`   Bucket "${BUCKET}" créé avec accès public.\n`);
  }
}

// 3. Traiter chaque entrée du mapping
let ok = 0, skipped = 0, errors = 0;

for (const { title, pdf } of MAPPING) {
  const pdfPath  = join(PDF_FOLDER, pdf);
  const stayKey  = title.toUpperCase();
  const stay     = Object.prototype.hasOwnProperty.call(staysByTitle, stayKey) ? staysByTitle[stayKey] : null;

  process.stdout.write(`  [${title}]\n`);

  // Vérifier que le séjour existe en base
  if (!stay) {
    console.log(`    ⚠️  Séjour introuvable en base (titre exact non trouvé)\n`);
    errors++;
    continue;
  }

  // Vérifier que le fichier PDF existe localement
  let fileBuffer;
  try {
    const resolvedPath = resolve(pdfPath);
    if (!resolvedPath.startsWith(resolve(PDF_FOLDER))) {
      throw new Error(`Invalid path: ${pdfPath}`);
    }
    fileBuffer = readFileSync(resolvedPath);
  } catch {
    console.log(`    ❌ Fichier PDF introuvable : ${pdfPath}\n`);
    errors++;
    continue;
  }

  // Construire le chemin de stockage : sejour/<slug>.pdf
  const storagePath = `sejours/${stay.slug}.pdf`;
  const publicUrl   = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

  // Déjà à jour ?
  if (stay.pdf_url === publicUrl) {
    console.log(`    ✅ Déjà à jour — pdf_url identique, skip.\n`);
    skipped++;
    continue;
  }

  console.log(`    PDF local  : ${pdf}`);
  console.log(`    Storage    : ${BUCKET}/${storagePath}`);
  console.log(`    URL finale : ${publicUrl}`);
  if (stay.pdf_url) {
    console.log(`    Ancien URL : ${stay.pdf_url}`);
  }

  if (DRY_RUN) {
    console.log(`    → [DRY-RUN] Aucune action effectuée.\n`);
    ok++;
    continue;
  }

  // Upload vers Supabase Storage (upsert = écrase si déjà présent)
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadErr) {
    console.log(`    ❌ Erreur upload : ${uploadErr.message}\n`);
    errors++;
    continue;
  }

  // Mise à jour pdf_url dans gd_stays
  const { error: updateErr } = await supabase
    .from('gd_stays')
    .update({ pdf_url: publicUrl })
    .eq('slug', stay.slug);

  if (updateErr) {
    console.log(`    ❌ Erreur update DB : ${updateErr.message}\n`);
    errors++;
    continue;
  }

  console.log(`    ✅ Upload + DB mis à jour.\n`);
  ok++;
}

// 4. Résumé
console.log('═'.repeat(70));
console.log(`  RÉSUMÉ : ${ok} traités | ${skipped} déjà à jour | ${errors} erreurs`);
if (DRY_RUN) {
  console.log('\n  ℹ️  Dry-run terminé. Relancez sans --dry-run pour appliquer.');
}
console.log('═'.repeat(70) + '\n');
