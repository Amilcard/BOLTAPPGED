// ================================================================
// FIX CRITIQUE — Node "Extract Detail + Sessions"
// Workflow n8n : VERIFICATION COMPLETUDE SEJOURS UFOVAL (kG6OASM4PxZaBt9H)
//
// PROBLÈMES CORRIGÉS :
//   P1 BLOQUANT : Ancien regex ciblait <option> (villes de transport)
//                  → sessions_count = 0 pour tous les séjours
//   P2 BLOQUANT : is_available hardcodé true → is_full jamais détecté
//   P3 IMPORTANT : updated_at absent du body upsert
//   P4 IMPORTANT : is_full jamais propagé
//
// STRUCTURE HTML UFOVAL RÉELLE (vérifiée 2026-03-08) :
//   Session dispo  : <label for="cart_step_availability_availability_1111">
//   Session complet: <label class="availability-status-full" for="...">
//                      <div class="tag small tag-danger">Complet</div>
//   Dates          : <div class="date h6">18 juil.</div>
//   Prix           : <div class="final-price">1 390 €</div>
//
// COMMENT APPLIQUER :
//   1. Ouvrir workflow kG6OASM4PxZaBt9H dans n8n
//   2. Cliquer sur le node "Extract Detail + Sessions"
//   3. Ctrl+A dans l'éditeur → coller ce fichier entier → Sauvegarder
//   4. Dans le node HTTP__UPSERT_GD_STAYS, ajouter dans le body JSON :
//      "updated_at": "={{ new Date().toISOString() }}"
//   5. Ctrl+S → Tester manuellement → Vérifier destination-soleil : 4 sessions
// ================================================================

// Référentiel GED ↔ UFOVAL (v02_03 définitif — 24 séjours)
const SLUG_TO_UFOVAL = {
  'annecy-element':              'Annecy Elément',
  'aqua-fun':                    "Aqua'Fun",
  'sperienza-in-corsica-1':      'Sperienza in Corsica',
  'dh-experience-11-13-ans':     'DH Experience',
  'moto-moto':                   'Moto Moto',
  'destination-soleil':          'Destination Soleil',
  'surf-sur-le-bassin':          'Surf sur le Bassin',
  'mountain-and-chill':          "Mountain & Chill'",
  'explore-mountain':            'Explore Mountain',
  'aqua-mix':                    "Aqua'Mix",
  'breizh-equit-kids-8-11-ans':  "Breizh Equit' Kids",
  'glieraventures':              "Glièr'Aventures",
  'destination-bassin-darcachon-1': 'Destination Bassin',
  'e-sport-and-sport':           'E-Sport & Sport',
  'survie-dans-le-beaufortain':  'Survie dans le Beaufortain',
  'yamakasi':                    'Yamakasi',
  'laventure-verticale':         "L'Aventure Verticale",
  'les-robinson-des-glieres':    'Les Robinson des Glières',
  'nature-picture':              'Nature Picture',
  'croc-marmotte':               "Croc' Marmotte",
  'aqua-gliss':                  "Aqua'Gliss",
  'les-apprentis-montagnards':   'Les Apprentis Montagnards',
  'les-ptits-puisotins-1':       "Les P'tits Puisotins",
  'natation-et-sensation':       'Natation & Sensation',
};

// ─── Parser date française → ISO ───────────────────────────────
// "18 juil." → "2026-07-18"   "4 août" → "2026-08-04"
function parseDateFR(text) {
  if (!text || typeof text !== 'string') return null;

  const MOIS = {
    'janv': 1, 'jan': 1,
    'févr': 2, 'fev': 2, 'fevr': 2,
    'mars': 3, 'mar': 3,
    'avr': 4, 'avril': 4,
    'mai': 5,
    'juin': 6,
    'juil': 7,
    'août': 8, 'aout': 8, 'aou': 8,
    'sept': 9, 'sep': 9,
    'oct': 10,
    'nov': 11,
    'déc': 12, 'dec': 12,
  };

  const clean = text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accents → ascii
    .toLowerCase()
    .replace(/\./g, '')
    .trim();

  const match = clean.match(/(\d{1,2})\s+([a-z]+)/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const moisKey = Object.keys(MOIS).find(k => match[2].startsWith(k));
  if (!moisKey) return null;

  const month = MOIS[moisKey];
  // Saison été : mois < mars → année suivante
  const year = month < 3 ? new Date().getFullYear() + 1 : new Date().getFullYear();

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ─── Extraction prix ────────────────────────────────────────────
function extractPrice(labelHtml) {
  const priceMatch = labelHtml.match(/class="final-price"[^>]*>([\d\s]+)(?:\s*€|\s*&euro;)/);
  if (!priceMatch) return null;
  const raw = priceMatch[1].replace(/\s/g, '');
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

// ─── Corps principal ────────────────────────────────────────────
const output = [];

for (const item of $input.all()) {
  const slug = item.json.slug;
  const html = item.json.body || item.json.data || item.json.html || '';

  if (!slug || !html || html.length < 500) {
    output.push({ json: {
      slug: slug || 'UNKNOWN',
      status: 'NO_HTML',
      sessions: [],
      sessions_json: '[]',
      is_full: false,
      extracted_sessions_count: 0,
    }});
    continue;
  }

  // Extraire tous les <label for="cart_step_availability_availability_\d+">
  const labelRegex = /<label[^>]*for="cart_step_availability_availability_\d+"[^>]*>[\s\S]*?<\/label>/gi;
  const labels = html.match(labelRegex) || [];

  const sessions = [];

  for (const label of labels) {
    // Détection COMPLET
    const isComplet =
      /availability-status-full/i.test(label) ||
      /class="tag[^"]*tag-danger[^"]*"[^>]*>Complet/i.test(label);

    // Extraire toutes les dates h6 dans ce label
    const dateMatches = [...label.matchAll(/<div[^>]*class="[^"]*date[^"]*h6[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
    if (dateMatches.length < 2) continue;

    const startDate = parseDateFR(dateMatches[0][1].replace(/<[^>]*>/g, '').trim());
    const endDate   = parseDateFR(dateMatches[dateMatches.length - 1][1].replace(/<[^>]*>/g, '').trim());

    if (!startDate || !endDate) continue;

    const price = extractPrice(label);

    sessions.push({
      start_date:   startDate,
      end_date:     endDate,
      status:       isComplet ? 'complet' : 'open',
      is_available: !isComplet,
      price_eur:    price,
    });
  }

  // is_full = toutes les sessions sont complètes (et il y en a au moins 1)
  const is_full = sessions.length > 0 && sessions.every(s => s.status === 'complet');

  output.push({ json: {
    slug,
    ufoval_name:              SLUG_TO_UFOVAL[slug] || slug,
    status:                   sessions.length > 0 ? 'OK' : 'NO_SESSIONS',
    sessions,
    sessions_json:            JSON.stringify(sessions),
    is_full,
    extracted_sessions_count: sessions.length,
  }});
}

return output;
