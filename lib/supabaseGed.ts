import { createClient } from '@supabase/supabase-js'

// Lazy singleton — createClient is deferred until first use to prevent
// top-level runtime errors if env vars are missing during Next.js build analysis.
let _supabaseGed: ReturnType<typeof createClient> | null = null

function getClient() {
  if (!_supabaseGed) {
    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://iirfvndgzutbxwfdwawu.supabase.co'
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpcmZ2bmRnenV0Ynh3ZmR3YXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNzI4MDksImV4cCI6MjA4NDg0ODgwOX0.GDBh-u9DEfy-w2btzNTZGm6T2npFlbdX3XK-h-rsUQw'
    _supabaseGed = createClient(url, key)
  }
  return _supabaseGed
}

// Proxy object: typed as 'any' to prevent 'never' inference cascade
// caused by untyped SupabaseClient<any> schema in supabase-js.
export const supabaseGed = new Proxy({} as any, {
  get(_target, prop) {
    return (getClient() as any)[prop]
  },
})

// Types
export interface StayFilters {
  theme?: string
  region?: string
}

export interface SessionPriceFilters {
  slug: string
  city?: string | null
}

export interface Wish {
  stay_slug: string
  child_first_name?: string
  child_last_name?: string
  child_birth_date?: string
  email?: string
}

export interface Inscription {
  stay_slug: string
  session_id?: string
  organisation: string
  social_worker_name: string
  email: string
  phone: string
  child_first_name: string
  child_last_name: string
  child_birth_date: string
  notes?: string
}

// API SÉJOURS
export const getSejours = async (filters: StayFilters = {}): Promise<any[]> => {
  let query = supabaseGed
    .from('gd_stays')
    .select('*, marketing_title, punchline, expert_pitch, programme, title_kids, title_pro, description_kids, description_pro, emotion_tag, carousel_group, spot_label, standing_label, expertise_label, intensity_label, price_includes_features')
    .eq('published', true)
    .order('title')

  // Note: Le filtre 'theme' a été supprimé car les thèmes sont maintenant gérés
  // via gd_stay_themes (multi-thèmes) et non plus via le champ unique ged_theme
  if (filters.region) query = query.eq('location_region', filters.region)

  const { data, error } = await query
  if (error) throw error

  // Mapping manuel snake_case → camelCase pour les champs premium
  return data?.map((stay: any) => ({
    ...stay,
    marketingTitle: stay.marketing_title,
    punchline: stay.punchline,
    expertPitch: stay.expert_pitch,
    programme: stay.programme,
    titleKids: stay.title_kids,
    titlePro: stay.title_pro,
    descriptionKids: stay.description_kids,
    descriptionPro: stay.description_pro,
    emotionTag: stay.emotion_tag,
    carouselGroup: stay.carousel_group,
    spotLabel: stay.spot_label,
    standingLabel: stay.standing_label,
    expertiseLabel: stay.expertise_label,
    intensityLabel: stay.intensity_label,
    priceIncludesFeatures: stay.price_includes_features
  })) || []
}

export const getSejourBySlug = async (slug: string): Promise<any> => {
  const { data, error } = await supabaseGed
    .from('gd_stays')
    .select('*, marketing_title, punchline, expert_pitch, programme, title_kids, title_pro, description_kids, description_pro, emotion_tag, carousel_group, spot_label, standing_label, expertise_label, intensity_label, price_includes_features')
    .eq('slug', slug)
    .single()

  if (error) throw error

  // Mapping manuel snake_case → camelCase
  return {
    ...data,
    marketingTitle: data.marketing_title,
    punchline: data.punchline,
    expertPitch: data.expert_pitch,
    programme: data.programme,
    titleKids: data.title_kids,
    titlePro: data.title_pro,
    descriptionKids: data.description_kids,
    descriptionPro: data.description_pro,
    emotionTag: data.emotion_tag,
    carouselGroup: data.carousel_group,
    spotLabel: data.spot_label,
    standingLabel: data.standing_label,
    expertiseLabel: data.expertise_label,
    intensityLabel: data.intensity_label,
    priceIncludesFeatures: data.price_includes_features,
    // FIX CRITIQUE: ces champs manquaient → validation âge et fallback prix KO
    ageMin: data.age_min,
    ageMax: data.age_max,
    priceFrom: data.price_from,
  }
}

// API PRIX
export const getSessionPrices = async (slug: string, city: string | null = null): Promise<any[]> => {
  let query = supabaseGed
    .from('gd_session_prices')
    .select('*')
    .eq('stay_slug', slug)
    .order('start_date')

  if (city) query = query.eq('city_departure', city)

  const { data, error } = await query
  if (error) throw error
  return data
}

export const getCitiesDeparture = async (slug: string): Promise<string[]> => {
  const { data, error } = await supabaseGed
    .from('gd_session_prices')
    .select('city_departure')
    .eq('stay_slug', slug)

  if (error) throw error
  return [...new Set<string>(data.map((d: any) => d.city_departure))].sort()
}

// API SESSIONS AVEC ÂGES
export const getStaySessions = async (slug: string): Promise<any[]> => {
  const { data, error } = await supabaseGed
    .from('gd_stay_sessions')
    .select('*')
    .eq('stay_slug', slug)
    .order('start_date')

  if (error) throw error
  return data || []
}

// API VILLES FORMATÉES POUR LE FRONT
// Retourne { city: string, extra_eur: number }[] attendu par stay-detail.tsx
export const getDepartureCitiesFormatted = async (slug: string) => {
  const { data, error } = await supabaseGed
    .from('gd_session_prices')
    .select('city_departure, transport_surcharge_ged')
    .eq('stay_slug', slug)

  if (error) throw error

  // Dédupliquer et formater
  const cityMap = new Map<string, number>()
  for (const row of data || []) {
    if (row.city_departure && !cityMap.has(row.city_departure)) {
      // transport_surcharge_ged = surcoût UFOVAL + 18€ GED
      // Pour extra_eur on veut juste le surcoût transport (sans transport = 0)
      // F7: Fix bug "sans transport" affichait +18€ au lieu de 0€
      const extraEur = row.city_departure === 'sans_transport' ? 0 : (row.transport_surcharge_ged || 0)
      cityMap.set(row.city_departure, extraEur)
    }
  }

  return Array.from(cityMap.entries())
    .map(([city, extra_eur]) => ({ city, extra_eur }))
    .sort((a, b) => {
      if (a.city === 'sans_transport') return -1
      if (b.city === 'sans_transport') return 1
      return a.city.localeCompare(b.city)
    })
}

// API SESSIONS FORMATÉES POUR LE FRONT
// Retourne { date_text, base_price_eur, promo_price_eur }[] attendu par pricing.ts
export const getSessionPricesFormatted = async (slug: string) => {
  const { data, error } = await supabaseGed
    .from('gd_session_prices')
    .select('start_date, end_date, base_price_eur, price_ged_total')
    .eq('stay_slug', slug)
    .eq('city_departure', 'sans_transport') // Prix de base sans transport
    .order('start_date')

  if (error) throw error

  // Dédupliquer par dates
  const sessionMap = new Map<string, { base_price_eur: number | null, promo_price_eur: number | null }>()
  for (const row of data || []) {
    const startD = new Date(row.start_date)
    const endD = new Date(row.end_date)
    const day1 = String(startD.getDate()).padStart(2, '0')
    const month1 = String(startD.getMonth() + 1).padStart(2, '0')
    const day2 = String(endD.getDate()).padStart(2, '0')
    const month2 = String(endD.getMonth() + 1).padStart(2, '0')
    const date_text = `${day1}/${month1} - ${day2}/${month2}`

    if (!sessionMap.has(date_text)) {
      sessionMap.set(date_text, {
        base_price_eur: row.base_price_eur,
        promo_price_eur: row.price_ged_total // Prix GED final comme "promo"
      })
    }
  }

  return Array.from(sessionMap.entries()).map(([date_text, prices]) => ({
    date_text,
    ...prices
  }))
}

// API SOUHAITS & INSCRIPTIONS
export const createWish = async (wish: Wish): Promise<any> => {
  const { data, error } = await supabaseGed
    .from('gd_wishes')
    .insert([wish])
    .select()

  if (error) throw error
  return data?.[0]
}

export const createInscription = async (inscription: Inscription): Promise<any> => {
  const { data, error } = await supabaseGed
    .from('gd_inscriptions')
    .insert([inscription])
    .select()

  if (error) throw error
  return data?.[0]
}

// ============================================
// API THÈMES (gd_stay_themes - multi-thèmes)
// ============================================

/**
 * Récupère les thèmes d'un séjour depuis gd_stay_themes
 * @param staySlug - Le slug du séjour
 * @returns Tableau des thèmes (MER, MONTAGNE, SPORT, DECOUVERTE, PLEIN_AIR)
 */
export const getStayThemes = async (staySlug: string): Promise<string[]> => {
  const { data, error } = await supabaseGed
    .from('gd_stay_themes')
    .select('theme')
    .eq('stay_slug', staySlug)

  if (error) {
    console.error('Error fetching stay themes:', error)
    return []
  }

  return data?.map(d => d.theme) || []
}

/**
 * Récupère tous les thèmes pour tous les séjours (pour le catalogue)
 * Optimisé pour un seul appel réseau
 * @returns Map stay_slug -> [themes]
 */
export const getAllStayThemes = async (): Promise<Record<string, string[]>> => {
  const { data, error } = await supabaseGed
    .from('gd_stay_themes')
    .select('stay_slug, theme')
    .order('stay_slug')

  if (error) {
    console.error('Error fetching all stay themes:', error)
    return {}
  }

  // Regrouper par stay_slug
  const themesMap: Record<string, string[]> = {}
  data?.forEach(row => {
    if (!themesMap[row.stay_slug]) {
      themesMap[row.stay_slug] = []
    }
    themesMap[row.stay_slug].push(row.theme)
  })

  return themesMap
}

// ============================================
// API PRIX MINIMUM (Sprint 2 - Action 4)
// ============================================

/**
 * Récupère le prix minimum par séjour (sans transport) pour affichage HOME.
 * Un seul appel réseau, regroupé par stay_slug → MIN(price_ged_total).
 * @returns Record stay_slug -> prix minimum en euros
 */
export const getMinPricesBySlug = async (): Promise<Record<string, number>> => {
  const { data, error } = await supabaseGed
    .from('gd_session_prices')
    .select('stay_slug, price_ged_total')
    .eq('city_departure', 'sans_transport')

  if (error) {
    console.error('Error fetching min prices:', error)
    return {}
  }

  const pricesMap: Record<string, number> = {}
  for (const row of data || []) {
    const price = row.price_ged_total
    if (price == null || !Number.isFinite(price)) continue
    if (!pricesMap[row.stay_slug] || price < pricesMap[row.stay_slug]) {
      pricesMap[row.stay_slug] = price
    }
  }

  return pricesMap
}
