// Script de seed pour la base de données Prisma (dev)
import 'dotenv/config';
import { prisma } from '../lib/db';

async function main() {
  console.log('🌱 Seeding database...');

  // Créer un séjour de test
  const stay = await prisma.stay.upsert({
    where: { slug: 'croc-marmotte' },
    update: {},
    create: {
      slug: 'croc-marmotte',
      title: 'ALPOO KIDS',
      descriptionShort: 'Séjour montagne apaisant',
      programme: JSON.stringify(['Randonnée', 'Découverte nature']),
      geography: 'Savoie - Beaufortain',
      accommodation: 'Centre montagne apaisant',
      supervision: 'Gestion éloignement + lien famille',
      priceFrom: 629,
      durationDays: 7,
      period: 'été',
      ageMin: 6,
      ageMax: 17,
      themes: JSON.stringify(['Montagne', 'Nature']),
      imageCover: '/images/default-cover.jpg',
      published: true,
      sourceManual: true,
    },
  });

  console.log('✅ Stay created:', stay.slug);

  // Créer les sessions de test
  const sessions = await Promise.all([
    prisma.staySession.upsert({
      where: { id: `croc-marmotte-0` },
      update: {},
      create: {
        id: `croc-marmotte-0`,
        stayId: stay.id,
        startDate: new Date('2026-07-05'),
        endDate: new Date('2026-07-11'),
        seatsTotal: 30,
        seatsLeft: 30,
      },
    }),
    prisma.staySession.upsert({
      where: { id: `croc-marmotte-1` },
      update: {},
      create: {
        id: `croc-marmotte-1`,
        stayId: stay.id,
        startDate: new Date('2026-07-12'),
        endDate: new Date('2026-07-18'),
        seatsTotal: 30,
        seatsLeft: 30,
      },
    }),
  ]);

  console.log(`✅ Created ${sessions.length} sessions`);
  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
