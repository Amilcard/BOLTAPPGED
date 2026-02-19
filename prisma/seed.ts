// Script de seed pour la base de données Prisma (dev)
import 'dotenv/config';
import { prisma } from '../lib/db';

async function main() {
  console.log('🌱 Seeding database...');

  // Créer un séjour de test
  const stay = await prisma.gd_stays.upsert({
    where: { slug: 'croc-marmotte' },
    update: {},
    create: {
      slug: 'croc-marmotte',
      title: 'ALPOO KIDS',
      description_kids: 'Séjour montagne apaisant',
      programme: JSON.stringify(['Randonnée', 'Découverte nature']),
      location_region: 'Savoie - Beaufortain',
      duration_days: 7,
      season: 'été',
      age_min: 6,
      age_max: 17,
      tags: JSON.stringify(['Montagne', 'Nature']),
      published: true,
    },
  });

  console.log('✅ Stay created:', stay.slug);

  // Créer les sessions de test
  const sessions = await Promise.all([
    prisma.gd_stay_sessions.upsert({
      where: {
        stay_slug_start_date_end_date: {
          stay_slug: 'croc-marmotte',
          start_date: new Date('2026-07-05'),
          end_date: new Date('2026-07-11'),
        },
      },
      update: {},
      create: {
        stay_slug: 'croc-marmotte',
        start_date: new Date('2026-07-05'),
        end_date: new Date('2026-07-11'),
        seats_left: 30,
      },
    }),
    prisma.gd_stay_sessions.upsert({
      where: {
        stay_slug_start_date_end_date: {
          stay_slug: 'croc-marmotte',
          start_date: new Date('2026-07-12'),
          end_date: new Date('2026-07-18'),
        },
      },
      update: {},
      create: {
        stay_slug: 'croc-marmotte',
        start_date: new Date('2026-07-12'),
        end_date: new Date('2026-07-18'),
        seats_left: 30,
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
