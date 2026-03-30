const fs = require('fs');
const path = require('path');

const FILES_TO_AUDIT = [
  'app/sejour/[id]/stay-detail.tsx',
  'components/booking-modal.tsx',
  'components/wishlist-modal.tsx',
  'components/header.tsx',
  'components/filter-sheet.tsx',
  'app/home-content.tsx',
  'app/recherche/page.tsx'
];

function analyzeFile(filePath) {
  const allowedDir = path.resolve(process.cwd());
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fullPath.startsWith(allowedDir + path.sep)) return;
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ Fichier introuvable: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  console.log(`\n================================================================================`);
  console.log(`📂 FICHIER : ${filePath}`);
  console.log(`--------------------------------------------------------------------------------`);

  // 1. TYPOGRAPHIE
  const typos = extractMatches(content, /font-(serif|sans|heading|mono|bold|extrabold|semibold)/g);
  console.log(`📝 TYPOS DÉTECTÉES:`);
  console.log(typos.length ? `   • ${[...new Set(typos)].join(', ')}` : '   (Aucune)');

  // 2. COULEURS (Primaires, Secondaires, Hardcodées)
  const colors = extractMatches(content, /(text|bg|border)-(primary|secondary|accent|muted|card|popover|brand)(-[a-z0-9]+)?/g);
  const hardColors = extractMatches(content, /(text|bg|border)-\[#[a-zA-Z0-9]+\]/g);
  const grayColors = extractMatches(content, /(text|bg|border)-gray-[0-9]+/g);

  console.log(`🎨 COULEURS THÈME:`);
  console.log(colors.length ? `   • ${[...new Set(colors)].slice(0, 10).join(', ')}` : '   (Aucune)');

  console.log(`⚠️ COULEURS HARDCODÉES:`);
  console.log(hardColors.length ? `   • ${[...new Set(hardColors)].join(', ')}` : '   (Aucune)');

  console.log(`🌫️ NUANCES DE GRIS (Tailwind):`);
  console.log(grayColors.length ? `   • ${[...new Set(grayColors)].slice(0, 10).join(', ')} ...` : '   (Aucune)');

  // 3. BOUTONS & STYLE
  const buttons = extractMatches(content, /rounded-(pill|full|lg|xl|2xl)/g);
  console.log(`🔘 BOUTONS / ARRONDIS:`);
  console.log(buttons.length ? `   • ${[...new Set(buttons)].join(', ')}` : '   (Aucune spécifique)');
}

function extractMatches(content, regex) {
  const matches = content.match(regex) || [];
  return matches;
}

console.log('🔍 AUDIT GRAPHIQUE ÉCRAN PAR ÉCRAN (APP & MODALES)\n');
FILES_TO_AUDIT.forEach(analyzeFile);
