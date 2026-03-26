/**
 * POST /api/pipeline/nominate
 *
 * Accepts a curator nomination with a Google Maps URL, extracts the Place ID,
 * creates a pipeline_candidates record, and runs processCandidate() on it.
 *
 * Auth: session-based (curator must be logged in)
 *
 * Request body (URL mode):
 *   { city_id, category, google_maps_url, nomination_note? }
 *
 * Request body (manual mode):
 *   { city_id, category, place_name, place_address, nomination_note? }
 *
 * Response:
 *   { success: true, candidate_id: string, status: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { processCandidate } from '@/pipeline/index'
import type { Category } from '@/types/pipeline'
import type { CityContext } from '@/pipeline/utils'

const VALID_CATEGORIES: Category[] = [
  'restaurant', 'cafe', 'accommodation', 'tour', 'sight', 'nightlife'
]

function extractPlaceId(url: string): { placeId: string; isHex: boolean } | null {
  // Format 1: ChIJ... Place ID in data parameter
  const chijMatch = url.match(/!1s(ChIJ[^!&]+)/)
  if (chijMatch) return { placeId: chijMatch[1], isHex: false }

  // Format 2: place_id= query parameter
  const paramMatch = url.match(/[?&]place_id=([^&]+)/)
  if (paramMatch) return { placeId: paramMatch[1], isHex: false }

  // Format 3: Direct ChIJ string passed
  if (url.startsWith('ChIJ')) return { placeId: url.trim(), isHex: false }

  // Format 4: Hex format 0x...:0x... in !1s parameter (newer Google Maps URLs)
  const hexMatch = url.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/)
  if (hexMatch) return { placeId: hexMatch[1], isHex: true }

  return null
}

function extractUrlContext(url: string): { name: string | null; lat: number | null; lng: number | null } {
  const nameMatch = url.match(/\/maps\/place\/([^/@]+)/)
  const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  const name = nameMatch ? decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')) : null
  const lat = coordMatch ? parseFloat(coordMatch[1]) : null
  const lng = coordMatch ? parseFloat(coordMatch[2]) : null
  return { name, lat, lng }
}

async function resolveChijPlaceId(name: string, lat: number, lng: number): Promise<string | null> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY!,
      'X-Goog-FieldMask': 'places.id',
    },
    body: JSON.stringify({
      textQuery: name,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 200,
        },
      },
    }),
  })
  const data = await res.json()
  console.log('[nominate] resolveChijPlaceId response:', JSON.stringify(data, null, 2))
  if (data.places?.[0]?.id) return data.places[0].id
  return null
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !['curator', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    city_id?: string; category?: string; google_maps_url?: string;
    place_name?: string; place_address?: string; nomination_note?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { city_id, category, google_maps_url, place_name, place_address, nomination_note } = body

  if (!city_id || !category) {
    return NextResponse.json({ error: 'city_id and category are required' }, { status: 400 })
  }

  if (!google_maps_url && (!place_name || !place_address)) {
    return NextResponse.json({ error: 'Provide either google_maps_url or both place_name and place_address' }, { status: 400 })
  }

  if (!VALID_CATEGORIES.includes(category as Category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  let placeId: string
  let resolvedName: string | null = null
  let resolvedAddress: string | null = null
  let resolvedLat: number | null = null
  let resolvedLng: number | null = null

  if (google_maps_url) {
    // URL mode: extract Place ID from Google Maps URL
    const extracted = extractPlaceId(google_maps_url)
    console.log('[nominate] extractPlaceId result:', JSON.stringify(extracted))
    if (!extracted) {
      return NextResponse.json({
        error: 'Could not extract a Place ID from this URL. Make sure you are copying the full Google Maps URL from the browser address bar.'
      }, { status: 400 })
    }

    placeId = extracted.placeId

    // Hex Place IDs need resolution to ChIJ format via Find Place API
    if (extracted.isHex) {
      const ctx = extractUrlContext(google_maps_url)
      if (ctx.name && ctx.lat !== null && ctx.lng !== null) {
        const resolved = await resolveChijPlaceId(ctx.name, ctx.lat, ctx.lng)
        if (resolved) {
          placeId = resolved
        } else {
          return NextResponse.json({
            error: 'Could not resolve a valid Place ID from this URL. Try searching for the place directly in Google Maps and copying the URL from the place details page.'
          }, { status: 400 })
        }
      } else {
        return NextResponse.json({
          error: 'Could not resolve a valid Place ID from this URL. Try searching for the place directly in Google Maps and copying the URL from the place details page.'
        }, { status: 400 })
      }
    }
  } else {
    // Manual mode: resolve Place ID from name + address via Text Search (New)
    const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY!,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({
        textQuery: `${place_name} ${place_address}`,
        locationBias: {
          circle: {
            center: { latitude: 50.0647, longitude: 19.9450 },
            radius: 30000,
          },
        },
      }),
    })
    const searchData = await searchRes.json()
    console.log('[nominate] manual mode Text Search response:', JSON.stringify(searchData, null, 2))

    const place = searchData.places?.[0]
    if (!place?.id) {
      return NextResponse.json({
        error: 'Could not find this place in Google Maps. Check the name and address and try again.'
      }, { status: 400 })
    }

    placeId = place.id
    resolvedName = place.displayName?.text ?? place_name
    resolvedAddress = place.formattedAddress ?? place_address
    resolvedLat = place.location?.latitude ?? null
    resolvedLng = place.location?.longitude ?? null
  }

  // Use service role for pipeline writes
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check for exact duplicate (same place_id + same category)
  const { data: duplicate } = await serviceClient
    .from('entries')
    .select('id, name')
    .eq('google_place_id', placeId)
    .eq('city_id', city_id)
    .eq('category', category)
    .maybeSingle()

  if (duplicate) {
    return NextResponse.json({
      error: `This place already exists in the database as "${duplicate.name}" in the ${category} category.`
    }, { status: 409 })
  }

  // Check for dual-mode venue (same place_id, different category)
  const { data: existingEntry } = await serviceClient
    .from('entries')
    .select('id, name, category')
    .eq('google_place_id', placeId)
    .eq('city_id', city_id)
    .neq('category', category)
    .maybeSingle()

  const { data: existingCandidate } = await serviceClient
    .from('pipeline_candidates')
    .select('id, name, category')
    .eq('google_place_id', placeId)
    .eq('city_id', city_id)
    .neq('category', category)
    .maybeSingle()

  const dualModeMatch = existingEntry || existingCandidate

  const resolvedNote = dualModeMatch
    ? `${nomination_note ? nomination_note + ' | ' : ''}Dual-mode venue: shares location with existing ${dualModeMatch.category} entry "${dualModeMatch.name}"`
    : nomination_note || null

  // Check if candidate already exists in pipeline
  const { data: existingPipelineCandidate } = await serviceClient
    .from('pipeline_candidates')
    .select('id, processing_status')
    .eq('google_place_id', placeId)
    .eq('city_id', city_id)
    .eq('category', category)
    .maybeSingle()

  let candidateId: string

  if (existingPipelineCandidate) {
    if (['failed', 'queued'].includes(existingPipelineCandidate.processing_status)) {
      // Reset and reprocess
      const { error: updateError } = await serviceClient
        .from('pipeline_candidates')
        .update({
          processing_status: 'queued',
          retry_count: 0,
          failure_stage: null,
          failure_reason: null,
          is_curator_nomination: true,
          nominated_by: profile.id,
          nomination_note: resolvedNote,
          stage1_result: null,
          ...(resolvedName && { name: resolvedName }),
          ...(resolvedAddress && { address: resolvedAddress }),
          ...(resolvedLat !== null && { lat: resolvedLat }),
          ...(resolvedLng !== null && { lng: resolvedLng }),
          ...(dualModeMatch && {
            dual_mode_venue: true,
            dual_mode_note: `Shares location with existing ${dualModeMatch.category} entry: ${dualModeMatch.name}`,
          }),
        })
        .eq('id', existingPipelineCandidate.id)

      if (updateError) {
        console.error('[nominate] pipeline_candidates update failed:', updateError.message, updateError.details, updateError.hint)
        return NextResponse.json({ error: 'Failed to reset existing nomination', detail: updateError.message }, { status: 500 })
      }

      candidateId = existingPipelineCandidate.id
      console.log(`[nominate] Reset existing candidate ${candidateId} (was ${existingPipelineCandidate.processing_status}) for place_id=${placeId}, category=${category}`)
    } else if (existingPipelineCandidate.processing_status === 'passed') {
      return NextResponse.json({
        error: 'This place has already been processed and is in your review queue.'
      }, { status: 409 })
    } else {
      return NextResponse.json({
        error: 'This place is already being processed.'
      }, { status: 409 })
    }
  } else {
    // Create new pipeline_candidates record
    const { data: candidate, error: insertError } = await serviceClient
      .from('pipeline_candidates')
      .insert({
        city_id,
        category,
        name: resolvedName ?? 'Nominated entry',
        google_place_id: placeId,
        is_curator_nomination: true,
        nominated_by: profile.id,
        nomination_note: resolvedNote,
        processing_status: 'queued',
        sources: [{ source: 'curator_nomination', source_id: placeId, source_url: null, is_primary: true }],
        ...(resolvedAddress && { address: resolvedAddress }),
        ...(resolvedLat !== null && { lat: resolvedLat }),
        ...(resolvedLng !== null && { lng: resolvedLng }),
        ...(dualModeMatch && {
          dual_mode_venue: true,
          dual_mode_note: `Shares location with existing ${dualModeMatch.category} entry: ${dualModeMatch.name}`,
        }),
      })
      .select('id')
      .single()

    if (insertError || !candidate) {
      console.error('[nominate] pipeline_candidates insert failed:', insertError?.message, insertError?.details, insertError?.hint)
      return NextResponse.json({ error: 'Failed to create nomination record', detail: insertError?.message }, { status: 500 })
    }

    candidateId = candidate.id
    console.log(`[nominate] Created candidate ${candidateId} for place_id=${placeId}, category=${category}`)
  }

  // Load city context for pipeline processing
  const { data: city, error: cityError } = await serviceClient
    .from('cities')
    .select('id, slug, display_name, country, city_context')
    .eq('id', city_id)
    .single()

  if (cityError || !city) {
    console.error(`[nominate] City fetch failed for ${city_id}:`, cityError?.message, cityError?.details)
    return NextResponse.json({ error: `City not found: ${city_id}`, detail: cityError?.message }, { status: 400 })
  }

  const cityContext: CityContext = {
    id: city.id,
    slug: city.slug,
    name: city.display_name,
    country: city.country,
    top_tourist_landmarks: city.city_context?.top_tourist_landmarks ?? [],
  }

  console.log(`[nominate] Starting processCandidate for ${candidateId} in ${city.display_name}`)

  // Run pipeline on this single candidate -- non-blocking
  processCandidate(candidateId, cityContext, category as Category).catch(err => {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error(`[nominate] processCandidate failed for ${candidateId}:`, message)
    if (stack) console.error(`[nominate] stack:`, stack)
  })

  return NextResponse.json({
    success: true,
    candidate_id: candidateId,
    status: 'Pipeline started. The entry will appear in your review queue if it passes all gates.',
  }, { status: 200 })
}
