import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const stays = [
  {
    slug: 'aventure-montagne-printemps',
    title: 'Aventure Montagne',
    descriptionShort: 'Une semaine de découverte en montagne avec randonnées, escalade et nuits en refuge.',
    programme: [
      'Jour 1 : Arrivée et installation au centre',
      'Jour 2 : Randonnée découverte faune et flore',
      'Jour 3 : Initiation escalade sur bloc',
      'Jour 4 : Grande randonnée et nuit en refuge',
      'Jour 5 : Descente et activités nature',
      'Jour 6 : Jeux collectifs et veillée',
      'Jour 7 : Bilan et départ'
    ],
    geography: 'Alpes françaises, Haute-Savoie',
    accommodation: 'Centre de vacances agréé, chambres de 4 à 6 lits',
    supervision: '1 animateur BAFA pour 8 enfants, directeur BAFD',
    priceFrom: 890,
    durationDays: 7,
    period: 'printemps',
    ageMin: 11,
    ageMax: 17,
    themes: ['aventure', 'nature', 'sport'],
    imageCover: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
    published: true
  },
  {
    slug: 'nature-foret-ete',
    title: 'Explorateurs de la Forêt',
    descriptionShort: 'Deux semaines au cœur de la forêt pour apprendre la vie en pleine nature.',
    programme: [
      'Semaine 1 : Découverte de l\'écosystème forestier',
      'Jour 1-2 : Installation et découverte du site',
      'Jour 3-4 : Construction de cabanes',
      'Jour 5-7 : Orientation et survie douce',
      'Semaine 2 : Approfondissement et autonomie',
      'Jour 8-10 : Bivouac en forêt',
      'Jour 11-12 : Projet collectif nature',
      'Jour 13-14 : Restitution et départ'
    ],
    geography: 'Forêt de Fontainebleau, Île-de-France',
    accommodation: 'Gîte forestier, dortoirs de 6 lits',
    supervision: '1 animateur pour 6 enfants, assistant sanitaire',
    priceFrom: 1450,
    durationDays: 14,
    period: 'été',
    ageMin: 6,
    ageMax: 10,
    themes: ['nature', 'aventure'],
    imageCover: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80',
    published: true
  },
  {
    slug: 'sport-nautique-ete',
    title: 'Cap sur l\'Océan',
    descriptionShort: 'Trois semaines de sports nautiques sur la côte atlantique.',
    programme: [
      'Semaine 1 : Initiation',
      'Jour 1-3 : Surf débutant',
      'Jour 4-5 : Paddle et kayak',
      'Jour 6-7 : Voile légère',
      'Semaine 2 : Perfectionnement',
      'Jour 8-10 : Surf intermédiaire',
      'Jour 11-14 : Catamaran',
      'Semaine 3 : Autonomie',
      'Jour 15-18 : Navigation en équipe',
      'Jour 19-21 : Mini-régate et remise des diplômes'
    ],
    geography: 'Côte Basque, Biarritz',
    accommodation: 'Village vacances bord de mer, bungalows 4 places',
    supervision: '1 moniteur diplômé pour 8 jeunes, surveillant de baignade',
    priceFrom: 2100,
    durationDays: 21,
    period: 'été',
    ageMin: 11,
    ageMax: 17,
    themes: ['sport', 'nature'],
    imageCover: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800&q=80',
    published: true
  },
  {
    slug: 'culture-patrimoine-printemps',
    title: 'Sur les Traces de l\'Histoire',
    descriptionShort: 'Une semaine culturelle à la découverte des châteaux de la Loire.',
    programme: [
      'Jour 1 : Arrivée à Tours, visite du centre historique',
      'Jour 2 : Château de Chambord',
      'Jour 3 : Château de Chenonceau et atelier Renaissance',
      'Jour 4 : Château d\'Amboise et Clos Lucé',
      'Jour 5 : Atelier costumes et danses médiévales',
      'Jour 6 : Château de Villandry et jardins',
      'Jour 7 : Spectacle final et départ'
    ],
    geography: 'Val de Loire, Centre-Val de Loire',
    accommodation: 'Auberge de jeunesse, chambres de 4 lits',
    supervision: '1 animateur pour 8 enfants, guide culturel',
    priceFrom: 950,
    durationDays: 7,
    period: 'printemps',
    ageMin: 6,
    ageMax: 10,
    themes: ['culture', 'patrimoine'],
    imageCover: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=800&q=80',
    published: true
  },
  {
    slug: 'multi-activites-ete-petits',
    title: 'Vacances Malices',
    descriptionShort: 'Deux semaines multi-activités pour les plus jeunes.',
    programme: [
      'Semaine 1 : Découvertes',
      'Activités manuelles quotidiennes',
      'Jeux d\'eau et piscine',
      'Mini-randonnées adaptées',
      'Veillées contes',
      'Semaine 2 : Aventures',
      'Sortie à la ferme pédagogique',
      'Olympiades adaptées',
      'Spectacle de fin de séjour',
      'Journée à thème pirates'
    ],
    geography: 'Dordogne, Nouvelle-Aquitaine',
    accommodation: 'Centre de vacances spécialisé petite enfance',
    supervision: '1 animateur pour 5 enfants, infirmière sur place',
    priceFrom: 1280,
    durationDays: 14,
    period: 'été',
    ageMin: 6,
    ageMax: 10,
    themes: ['nature', 'sport', 'culture'],
    imageCover: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&q=80',
    published: true
  },
  {
    slug: 'aventure-medievale-printemps',
    title: 'Chevaliers et Princesses',
    descriptionShort: 'Une semaine médiévale avec tournois, artisanat et vie de château.',
    programme: [
      'Jour 1 : Adoubement et installation au château',
      'Jour 2 : Atelier forge et blasons',
      'Jour 3 : Tir à l\'arc et escrime mousse',
      'Jour 4 : Cuisine médiévale et banquet',
      'Jour 5 : Chasse au trésor dans le château',
      'Jour 6 : Grand tournoi des chevaliers',
      'Jour 7 : Cérémonie de clôture et départ'
    ],
    geography: 'Château de Murol, Auvergne',
    accommodation: 'Dortoirs aménagés dans le château',
    supervision: '1 animateur pour 7 enfants, comédiens médiévistes',
    priceFrom: 870,
    durationDays: 7,
    period: 'printemps',
    ageMin: 6,
    ageMax: 10,
    themes: ['culture', 'aventure'],
    imageCover: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgXgbvLiC5re6Nxm2gnMB7NOhmHZZ9duPaPeFrAeSfjdrmbR1JjFnqopZTlj9fRX2xYfWMtjZmyjV9pNRUivaBLnE_iukMSBJbjGikroV_4V2IPyWPzujTKkhviRzStDR35RM3AwvPeDpsQ/s640/Books-About-Spring-Seasons.png',
    published: true
  },
  {
    slug: 'defi-sport-ete',
    title: 'Défis Sportifs',
    descriptionShort: 'Trois semaines intensives multi-sports pour ados.',
    programme: [
      'Semaine 1 : Sports collectifs',
      'Football, basketball, volleyball',
      'Entraînements quotidiens',
      'Semaine 2 : Sports individuels',
      'Athlétisme, natation, tennis',
      'Préparation physique',
      'Semaine 3 : Compétitions',
      'Tournois inter-équipes',
      'Olympiades finales',
      'Remise des médailles'
    ],
    geography: 'CREPS de Vichy, Auvergne-Rhône-Alpes',
    accommodation: 'Internat sportif, chambres doubles',
    supervision: '1 éducateur sportif pour 10 jeunes, préparateur physique',
    priceFrom: 1950,
    durationDays: 21,
    period: 'été',
    ageMin: 11,
    ageMax: 17,
    themes: ['sport'],
    imageCover: 'https://thumbs.dreamstime.com/b/sports-summer-training-camp-themed-poster-games-vector-illustration-71161787.jpg voices-37d636fe?w=800&q=80',
    published: true
  },
  {
    slug: 'science-nature-ete',
    title: 'Petits Scientifiques',
    descriptionShort: 'Deux semaines d\'expériences et découvertes scientifiques en pleine nature.',
    programme: [
      'Semaine 1 : Observer',
      'Jour 1-2 : Astronomie et observation des étoiles',
      'Jour 3-4 : Botanique et herbier',
      'Jour 5-7 : Géologie et fossiles',
      'Semaine 2 : Expérimenter',
      'Jour 8-10 : Chimie amusante',
      'Jour 11-12 : Robotique et programmation',
      'Jour 13-14 : Expo sciences et départ'
    ],
    geography: 'Observatoire du Pic du Midi, Pyrénées',
    accommodation: 'Chalet scientifique, chambres de 4',
    supervision: '1 animateur scientifique pour 6 enfants',
    priceFrom: 1580,
    durationDays: 14,
    period: 'été',
    ageMin: 11,
    ageMax: 17,
    themes: ['nature', 'culture'],
    imageCover: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
    published: true
  }
];

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.booking.deleteMany();
  await prisma.staySession.deleteMany();
  await prisma.stay.deleteMany();
  await prisma.user.deleteMany();

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
  await prisma.user.upsert({
    where: { email: 'admin@gd.fr' },
    update: {},
    create: {
      email: 'admin@gd.fr',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  // Create PRO user (VIEWER role for professionals)
  const proPasswordHash = await bcrypt.hash('Pro123!', 10);
  await prisma.user.upsert({
    where: { email: 'pro@gd.fr' },
    update: {},
    create: {
      email: 'pro@gd.fr',
      passwordHash: proPasswordHash,
      role: Role.VIEWER,
    },
  });

  // Create test user for NextAuth (required by framework)
  const testHash = await bcrypt.hash('johndoe123', 10);
  await prisma.user.create({
    data: {
      email: 'john@doe.com',
      passwordHash: testHash,
      role: Role.ADMIN,
    },
  });

  console.log('Created admin users');

  // Create stays with sessions
  for (const stayData of stays) {
    const stay = await prisma.stay.create({
      data: stayData,
    });

    // Create 2 sessions per stay
    const baseDate = stayData.period === 'printemps' 
      ? new Date('2026-04-15') 
      : new Date('2026-07-10');
    
    const session1Start = new Date(baseDate);
    const session1End = new Date(baseDate);
    session1End.setDate(session1End.getDate() + stayData.durationDays - 1);

    const session2Start = new Date(baseDate);
    session2Start.setDate(session2Start.getDate() + stayData.durationDays + 7);
    const session2End = new Date(session2Start);
    session2End.setDate(session2End.getDate() + stayData.durationDays - 1);

    await prisma.staySession.createMany({
      data: [
        {
          stayId: stay.id,
          startDate: session1Start,
          endDate: session1End,
          seatsTotal: 20,
          seatsLeft: 15 + Math.floor(Math.random() * 5),
        },
        {
          stayId: stay.id,
          startDate: session2Start,
          endDate: session2End,
          seatsTotal: 20,
          seatsLeft: 10 + Math.floor(Math.random() * 8),
        },
      ],
    });

    console.log(`Created stay: ${stay.title}`);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
