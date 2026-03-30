const fs = require('fs');
const path = require('path');

const SCREENS = [
  { name: '🏠 Home Page', file: 'app/home-content.tsx' },
  { name: '📄 Détail Séjour', file: 'app/sejour/[id]/stay-detail.tsx' },
  { name: '🔍 Recherche', file: 'app/recherche/page.tsx' },
  { name: '📝 Inscription (Modal)', file: 'components/booking-modal.tsx' },
  { name: '❤️ Souhait (Modal)', file: 'components/wishlist-modal.tsx' },
  { name: '🧭 Navigation (Header)', file: 'components/header.tsx' }
];

function auditCoherence() {
  console.log('| Écran / Composant | Polices (Familles) | Couleurs (Thème) | Nuances de Gris | ⚠️ Hardcodé | Score Cohérence |');
  console.log('|---|---|---|---|---|---|');

  const allowedDir = path.resolve(process.cwd());
  SCREENS.forEach(screen => {
    const fullPath = path.resolve(process.cwd(), screen.file);
    if (!fullPath.startsWith(allowedDir + path.sep)) return;
    if (!fs.existsSync(fullPath)) return;

    const content = fs.readFileSync(fullPath, 'utf8');

    // 1. Polices
    const fontFamilies = new Set(content.match(/font-(sans|serif|heading|mono)/g) || []);
    const fontCount = fontFamilies.size;
    const fontsStr = fontCount > 0 ? Array.from(fontFamilies).map(f => `\`${f}\``).join(', ') : '*(Défaut)*';

    // 2. Couleurs
    const themeColors = new Set(content.match(/(text|bg|border)-(primary|secondary|accent)/g) || []);
    const grayColors = new Set(content.match(/(text|bg|border)-gray-[0-9]+/g) || []);
    const hardColors = new Set(content.match(/(text|bg|border)-\[#[a-zA-Z0-9]+\]/g) || []); // Ex: text-[#123456]

    const themesStr = themeColors.size > 0 ? `${themeColors.size} vars` : 'Aucune';
    const graysStr = grayColors.size > 0 ? `${grayColors.size} nuances` : 'Aucune';
    const hardStr = hardColors.size > 0 ? Array.from(hardColors).map(c => `\`${c}\``).join(', ') : '✅';

    // 3. Score
    let score = '🟢 Excellent';
    if (hardColors.size > 0) score = '🔴 Mauvais (Hardcodé)';
    else if (fontFamilies.has('font-serif') && fontFamilies.has('font-sans')) score = '🟠 Moyen (Mélange Fonts)';
    else if (fontFamilies.size > 1) score = '🟡 Bon (2 Fonts)';

    // Output Row
    console.log(`| **${screen.name}** | ${fontsStr} | ${themesStr} | ${graysStr} | ${hardStr} | ${score} |`);
  });
}

auditCoherence();
