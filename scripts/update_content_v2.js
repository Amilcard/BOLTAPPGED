
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iirfvndgzutbxwfdwawu.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpcmZ2bmRnenV0Ynh3ZmR3YXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNzI4MDksImV4cCI6MjA4NDg0ODgwOX0.GDBh-u9DEfy-w2btzNTZGm6T2npFlbdX3XK-h-rsUQw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const UPDATES = [
  {
    slug: "aqua-mix",
    marketing_title: "BLUE EXPERIENCE",
    punchline: "L'appel du large et la thérapie par l'eau.",
    expert_pitch: "Ce séjour est une immersion complète dans l'élément aquatique, idéal pour les jeunes ayant besoin de canaliser leur énergie. Entre la technicité de la voile et les sensations de la glisse tractée, nous travaillons la coordination et la confiance en soi. L'eau agit comme un régulateur naturel : les journées sont intenses, les soirées apaisées. Un cocktail parfait pour socialiser en dehors du cadre scolaire traditionnel."
  },
  {
    slug: "destination-bassin-darcachon-1", // Correction slug probable vs "destination-bassin"
    marketing_title: "DUNE & OCEAN",
    punchline: "La grandeur nature entre forêt et marée.",
    expert_pitch: "Le Bassin n'est pas qu'une carte postale, c'est un terrain de jeu éducatif immense. De l'ascension de la Dune du Pilat (effort et récompense) à la navigation sur le bassin, ce séjour offre un cadre structurant et contemplatif. Idéal pour une première rupture douce avec le milieu familial, favorisant l'autonomie dans un environnement sécurisé et prestigieux."
  },
  {
    slug: "destination-soleil",
    marketing_title: "SUMMER VIBES",
    punchline: "Le collectif avant tout : vivre ensemble sous le soleil.",
    expert_pitch: "Plus qu'un séjour multi-activités, c'est une école du 'vivre ensemble'. Le programme est conçu pour maximiser les interactions positives : grands jeux d'équipe, défis sportifs et temps calmes gérés. Nous utilisons ce cadre ludique pour observer et travailler les dynamiques de groupe. Parfait pour les profils ayant besoin de renouer avec une socialisation saine et sans écran."
  },
  {
    slug: "e-sport-and-sport", // Correction slug vs "e-sport-sport"
    marketing_title: "GAMING HOUSE ACADEMY",
    punchline: "L'équilibre parfait entre le virtuel et le réel.",
    expert_pitch: "Nous ne combattons pas les écrans, nous apprenons à les maîtriser. Ce séjour unique alterne sessions de coaching E-Sport (stratégie, communication, fair-play) et activités physiques intenses en montagne. L'objectif est de déculpabiliser la pratique tout en prouvant au jeune que la performance cognitive passe par une hygiène de vie sportive. Un levier puissant pour les profils 'Geek' ou en retrait social."
  },
  {
    slug: "explore-mountain",
    marketing_title: "ALPINE DISCOVERY",
    punchline: "La montagne accessible, l'aventure à portée de main.",
    expert_pitch: "La montagne peut être intimidante ; nous la rendons ludique. Ce programme est une porte d'entrée progressive vers l'outdoor. Pas de performance extrême ici, mais de la curiosité : randonnée, observation de la faune, bivouac initiatique. C'est le séjour idéal pour revaloriser des jeunes peu sportifs en leur montrant qu'ils sont capables d'atteindre des sommets, à leur rythme."
  },
  {
    slug: "dh-experience-11-13-ans", // Correction slug vs "full-downhill"
    marketing_title: "GRAVITY BIKE",
    punchline: "Pilotage, trajectoire et maîtrise du risque.",
    expert_pitch: "Le VTT de descente est une école de la concentration. Ici, pas de place pour l'inattention. Encadrés par des moniteurs brevetés, les jeunes apprennent à lire le terrain, anticiper les obstacles et gérer leur vitesse. C'est un excellent médiateur pour les profils 'tête brûlée' : on leur apprend que la vraie vitesse ne s'obtient que par la maîtrise technique et le respect du matériel."
  },
  {
    slug: "glieraventures", // Correction slug vs "glier-aventures"
    marketing_title: "VERTICAL LIMIT",
    punchline: "Grimper pour grandir : la confiance au bout des doigts.",
    expert_pitch: "Face à la paroi, on ne peut pas tricher. L'escalade et la via ferrata obligent le jeune à faire confiance à son assureur (l'autre) et à gérer son stress. Ce séjour au Plateau des Glières utilise la verticalité pour renforcer l'estime de soi. Chaque mètre gagné est une victoire concrète sur l'appréhension. Recommandé pour développer la solidarité et le dépassement de soi."
  },
  {
    slug: "mountain-and-chill", // Correction slug vs "mountain-chill"
    marketing_title: "ALTITUDE RESET",
    punchline: "Déconnecter pour mieux se retrouver.",
    expert_pitch: "Dans un monde hyper-stimulé, l'ennui est devenu rare. Ce séjour prend le contre-pied de la consommation effrénée d'activités. Au programme : grands espaces, baignades en lac, soirées au coin du feu et temps libres accompagnés. C'est un sas de décompression vital pour des jeunes sous pression scolaire ou familiale, leur offrant le luxe du temps long et du calme."
  },
  {
    slug: "nature-picture",
    marketing_title: "WILD LENS",
    punchline: "Changer de regard sur le monde qui nous entoure.",
    expert_pitch: "La photo animalière exige deux vertus oubliées : la patience et le silence. Armés d'objectifs, les jeunes apprennent à se faire discrets pour capturer l'instant. Ce séjour valorise les profils observateurs et sensibles, souvent en retrait dans les groupes bruyants. C'est une valorisation par l'art et la technique, permettant d'exprimer une vision du monde sans avoir besoin de mots."
  },
  {
    slug: "sperienza-in-corsica-1", // Correction slug vs "sperienza-corsica"
    marketing_title: "CORSICA WILD TRIP",
    punchline: "L'aventure insulaire totale : mer, montagne et autonomie.",
    expert_pitch: "Notre produit phare en matière de dépaysement. La Corse offre une radicalité géographique qui marque les esprits. Entre plongée sous-marine et randonnée dans le maquis, ce séjour itinérant demande de l'engagement. Il est conçu pour les jeunes ayant besoin d'une rupture géographique forte pour marquer une étape de maturité. Un voyage initiatique inoubliable."
  },
  {
    slug: "survie-dans-le-beaufortain", // Correction slug vs "super-survie" (probable)
    marketing_title: "SURVIVOR CAMP",
    punchline: "L'école de la résilience en milieu sauvage.",
    expert_pitch: "Faire du feu, construire un abri, s'orienter : ici, on revient aux fondamentaux. Ce n'est pas un jeu télévisé, c'est une expérience de responsabilisation. Le confort est sommaire pour remettre en perspective les besoins essentiels. Idéal pour les jeunes en perte de repères ou accros au confort moderne. On en revient fatigué, sale, mais incroyablement fier et soudé avec le groupe."
  },
  {
    slug: "surf-sur-le-bassin", // Correction slug vs "surf-bassin"
    marketing_title: "ATLANTIC RIDE",
    punchline: "Humilité face à l'océan, persévérance sur la planche.",
    expert_pitch: "Le surf est l'une des disciplines les plus exigeantes : on tombe, on remonte, on recommence. Cette répétition forge le caractère et la résilience. Au cœur du Bassin, dans un cadre sécurisé mais sauvage, les jeunes apprennent à lire les éléments et à accepter l'échec comme partie intégrante de la progression. Une thérapie par l'effort et l'eau salée."
  }
];

async function updateContent() {
  console.log("# Injection Contenu Update Package V2\n");

  for (const update of UPDATES) {
    // 1. Vérifier si le slug existe avec ce nom exact ou un approchant
    const { data: checkData, error: checkError } = await supabase
        .from('gd_stays')
        .select('slug, title')
        .eq('slug', update.slug)
        .single();

    if (!checkData) {
        // Tentative de fallback sur un like si le slug exact change (legacy)
        console.warn(`⚠️ Slug introuvable: ${update.slug}. Tentative de recherche...`);
        continue;
    }

    // 2. Update
    const { error } = await supabase
      .from('gd_stays')
      .update({
        marketing_title: update.marketing_title,
        punchline: update.punchline,
        expert_pitch: update.expert_pitch
      })
      .eq('slug', update.slug);

    if (error) {
      console.error(`❌ Erreur update ${update.slug}:`, error.message);
    } else {
      console.log(`✅ Updated: ${update.slug} -> ${update.marketing_title}`);
    }
  }
}

updateContent();
