#!/usr/bin/env tsx
/**
 * Script d'import UFOVAL vers Supabase (SQLite)
 *
 * Modes:
 * - dry-run: Analyse sans écriture (défaut)
 * - one-stay: Import 1 séjour test
 * - full: Import tous les séjours
 *
 * Usage:
 *   tsx scripts/ufoval/import-to-supabase.ts --mode dry-run
 *   tsx scripts/ufoval/import-to-supabase.ts --mode one-stay
 *   tsx scripts/ufoval/import-to-supabase.ts --mode full
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface UFOVALSession {
  start_date: string
  end_date: string
  price_base: number
  price_unit: string
  capacity_remaining: number | null
  capacity_total: number | null
  status: string
}

interface UFOVALStay {
  source_url: string
  source_partner: string
  age_min: number
  age_max: number
  location_name: string
  sessions_json: UFOVALSession[]
  pro: {
    title_pro: string
    short_description_pro: string
    description_pro: string
    program_brief_pro: string[]
    educational_option_pro: string
    departure_city_info: string
  }
  kids: {
    title_kids: string
    short_description_kids: string
    description_kids: string
    program_brief_kids: string[]
    educational_option_kids: string
    departure_city_info_kids: string
  }
  generated_at: string
  model: string
}

interface ImportReport {
  mode: string
  processed: number
  upserted: number
  skipped: number
  errors: number
  sessions_created: number
  warnings: string[]
  errors_list: Array<{ stay: string; error: string }>
  missing_departure_cities: string[]
}

// Slugify util
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
}

// Durée en jours
function getDuration(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

// Prix minimum
function getMinPrice(sessions: UFOVALSession[]): number {
  return Math.min(...sessions.map(s => s.price_base))
}

async function main() {
  const args = process.argv.slice(2)
  const modeFlag = args.find(a => a.startsWith('--mode='))
  const mode = modeFlag ? modeFlag.split('=')[1] : 'dry-run'

  if (!['dry-run', 'one-stay', 'full'].includes(mode)) {
    console.error('❌ Mode invalide. Options: dry-run, one-stay, full')
    process.exit(1)
  }

  console.log(`\n🚀 Mode: ${mode.toUpperCase()}`)
  console.log('='.repeat(60))

  // Chargement des données UFOVAL
  const jsonPath = join(__dirname, '../../out/ufoval/rewrite_ready_for_supabase.json')

  // Fallback: try scripts directory if not found (worktree support)
  let rawData: string
  try {
    rawData = readFileSync(jsonPath, 'utf-8')
  } catch (e) {
    const fallbackPath = join(__dirname, '../scripts/ufoval/out/ufoval/rewrite_ready_for_supabase.json')
    rawData = readFileSync(fallbackPath, 'utf-8')
  }
  const stays: UFOVALStay[] = JSON.parse(rawData)

  console.log(`📦 Fichier: ${jsonPath}`)
  console.log(`📊 Séjours à traiter: ${stays.length}`)

  // Limit for one-stay mode
  const staysToProcess = mode === 'one-stay' ? [stays[0]] : stays

  const prisma = new PrismaClient()
  const report: ImportReport = {
    mode,
    processed: 0,
    upserted: 0,
    skipped: 0,
    errors: 0,
    sessions_created: 0,
    warnings: [],
    errors_list: [],
    missing_departure_cities: []
  }

  try {
    for (const stay of staysToProcess) {
      report.processed++

      const stayName = stay.pro.title_pro
      console.log(`\n[${report.processed}/${staysToProcess.length}] ${stayName}`)

      try {
        // Validation
        if (!stay.source_url) {
          report.warnings.push(`⚠️  ${stayName}: Pas de source_url, skip`)
          report.skipped++
          continue
        }

        // Check departure city
        if (stay.pro.departure_city_info === 'Départ à confirmer') {
          report.missing_departure_cities.push(stayName)
          report.warnings.push(`⚠️  ${stayName}: Ville de départ à confirmer`)
        }

        // Generate slug
        const slug = slugify(stay.pro.title_pro)

        // Min price & duration from first session
        const priceFrom = getMinPrice(stay.sessions_json)
        const durationDays = getDuration(
          stay.sessions_json[0].start_date,
          stay.sessions_json[0].end_date
        )

        // Extract themes from program brief
        const themes = stay.pro.program_brief_pro

        // Build contentKids JSON
        const contentKids = {
          title: stay.kids.title_kids,
          short_description: stay.kids.short_description_kids,
          description: stay.kids.description_kids,
          program_brief: stay.kids.program_brief_kids,
          educational_option: stay.kids.educational_option_kids,
          departure_city_info: stay.kids.departure_city_info_kids
        }

        if (mode === 'dry-run') {
          console.log(`  ✅ DRY-RUN: Serait importé`)
          console.log(`     Slug: ${slug}`)
          console.log(`     Source: ${stay.source_url}`)
          console.log(`     Sessions: ${stay.sessions_json.length}`)
          console.log(`     Prix: ${priceFrom}€`)
          report.upserted++
        } else {
          // Check if stay exists with this sourceUrl
          const existingStay = await prisma.stay.findFirst({
            where: { sourceUrl: stay.source_url }
          })

          let upsertedStay

          if (existingStay) {
            // Update existing
            upsertedStay = await prisma.stay.update({
              where: { id: existingStay.id },
              data: {
                title: stay.pro.title_pro,
                descriptionShort: stay.pro.short_description_pro,
                programme: stay.pro.program_brief_pro,
                geography: stay.location_name,
                accommodation: 'À confirmer',
                supervision: 'Encadrement professionnel',
                priceFrom,
                durationDays,
                period: 'Été 2026',
                ageMin: stay.age_min,
                ageMax: stay.age_max,
                themes,
                imageCover: '/images/placeholder.jpg',
                departureCity: stay.pro.departure_city_info,
                educationalOption: stay.pro.educational_option_pro,
                sourceUrl: stay.source_url,
                contentKids,
                importedAt: new Date(),
                lastSyncAt: new Date()
              }
            })
          } else {
            // Create new
            upsertedStay = await prisma.stay.create({
              data: {
                slug,
                title: stay.pro.title_pro,
                descriptionShort: stay.pro.short_description_pro,
                programme: stay.pro.program_brief_pro,
                geography: stay.location_name,
                accommodation: 'À confirmer',
                supervision: 'Encadrement professionnel',
                priceFrom,
                durationDays,
                period: 'Été 2026',
                ageMin: stay.age_min,
                ageMax: stay.age_max,
                themes,
                imageCover: '/images/placeholder.jpg',
                departureCity: stay.pro.departure_city_info,
                educationalOption: stay.pro.educational_option_pro,
                sourceUrl: stay.source_url,
                contentKids,
                importedAt: new Date(),
                lastSyncAt: new Date()
              }
            })
          }

          console.log(`  ✅ Upserté: ${upsertedStay.slug}`)
          report.upserted++

          // Create sessions
          for (const session of stay.sessions_json) {
            const duration = getDuration(session.start_date, session.end_date)

            await prisma.staySession.create({
              data: {
                stayId: upsertedStay.id,
                startDate: new Date(session.start_date),
                endDate: new Date(session.end_date),
                seatsTotal: session.capacity_total || 20,
                seatsLeft: session.capacity_remaining || 10
              }
            })

            report.sessions_created++
          }

          console.log(`     📅 Sessions créées: ${stay.sessions_json.length}`)
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`  ❌ Erreur: ${errorMsg}`)
        report.errors++
        report.errors_list.push({ stay: stayName, error: errorMsg })
      }
    }

    // Rapport final
    console.log('\n' + '='.repeat(60))
    console.log('📊 RAPPORT FINAL')
    console.log('='.repeat(60))
    console.log(`Mode: ${report.mode}`)
    console.log(`Traité: ${report.processed}`)
    console.log(`Upsertés: ${report.upserted}`)
    console.log(`Sautés: ${report.skipped}`)
    console.log(`Erreurs: ${report.errors}`)
    console.log(`Sessions créées: ${report.sessions_created}`)

    if (report.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${report.warnings.length}):`)
      report.warnings.forEach(w => console.log(`  ${w}`))
    }

    if (report.missing_departure_cities.length > 0) {
      console.log(`\n🚨 VILLES DE DÉPART À CONFIRMER (${report.missing_departure_cities.length}):`)
      report.missing_departure_cities.forEach(c => console.log(`  - ${c}`))
    }

    if (report.errors > 0) {
      console.log(`\n❌ ERREURS:`)
      report.errors_list.forEach(e => console.log(`  ${e.stay}: ${e.error}`))
      process.exit(1)
    }

    if (mode === 'dry-run') {
      console.log('\n✅ DRY-RUN terminé. Utilisez --mode=one-stay pour tester.')
    } else {
      console.log('\n✅ Import terminé avec succès!')
    }

  } catch (error) {
    console.error('Erreur fatale:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
