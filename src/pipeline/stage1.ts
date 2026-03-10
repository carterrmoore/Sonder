/**
 * stage1.ts — Candidate Discovery
 *
 * Discovers candidates for a given city + category from all relevant sources,
 * runs zero-cost pre-triage and (for restaurants) early tourist trap pre-pass,
 * fetches Place Details only for candidates that survive pre-triage,
 * deduplicates by 50m proximity, and writes pipeline_candidates rows to Supabase.
 *
 * Sources by category:
 *   restaurant    — Google Maps only (multiple search passes for sub-types)
 *   accommodation — Google Maps + Booking.com Content API (parallel)
 *   tour          — Google Maps + Viator + GetYourGuide (parallel)
 *   sight         — Google Maps only
 *   nightlife     — Google Maps + Foursquare Places API (parallel)
 *
 * Cost optimisations [v1.1]:
 *   - Pre-triage on Text Search data eliminates ~20-25% of Place Details calls
 *   - Restaurant early trap pre-pass eliminates obvious tourist traps before Place Details
 *   - Secondary sources run in parallel with Google Maps, never after
 *
 * Google Maps Places API (New) endpoints used:
 *   Text Search  — POST https://places.googleapis.com/v1/places:searchText
 *   Place Details — GET  https://places.googleapis.com/v1/places/{place_id}
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, CandidateSource, RawReview } from "@/types/pipeline";
import {
  passesPretriage,
  earlyTouristTrapSignals,
  deduplicateCandidates,
  computeCompositeRating,
  type TextSearchResult,
} from "./utils";
import { buildSearchQueries, DISCOVERY_TARGETS } from "@/pipeline/stage1-search-queries";
import { fetchCityContext } from "@/types/language-config";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GMAPS_BASE = "https://places.googleapis.com/v1";
const GMAPS_KEY = process.env.GOOGLE_MAPS_API_KEY!;

// Place Details fields fetched per candidate — only what gates actually need
// Comma-separated field mask for the X-Goog-FieldMask header
const PLACE_DETAILS_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "currentOpeningHours",
  "businessStatus",
  "websiteUri",
  "nationalPhoneNumber",
  "editorialSummary",
  "reviews",
  "plusCode",
  "photos",
  "priceLevel",
  "types",
].join(",");


// ─────────────────────────────────────────────────────────────────────────────
// Return type
// ─────────────────────────────────────────────────────────────────────────────

export interface Stage1Result {
  candidateIds: string[];
  discovered: number;
  deduplicated: number;
  pretriageRejected: number;
  earlyTrapRejected: number;
  enteringGate0: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Maps API helpers
// ─────────────────────────────────────────────────────────────────────────────

interface GMapsTextSearchResult {
  id: string;          // place_id in New API
  displayName: { text: string; languageCode: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  businessStatus?: string;
}

interface GMapsTextSearchResponse {
  places?: GMapsTextSearchResult[];
  nextPageToken?: string;
}

/**
 * Runs a single Text Search query against Google Maps Places API (New).
 * Returns up to maxResults results (paginated if needed).
 * Pagination: follow nextPageToken up to 3 pages (60 results max per query).
 */
async function googleTextSearch(
  query: string,
  cityName: string,
  maxResults: number
): Promise<GMapsTextSearchResult[]> {
  const results: GMapsTextSearchResult[] = [];
  let pageToken: string | undefined;
  let page = 0;

  while (results.length < maxResults && page < 3) {
    const body: Record<string, unknown> = {
      textQuery: query,
      locationBias: {
        // Kraków centre — tighten for accuracy
        circle: {
          center: { latitude: 50.0647, longitude: 19.9450 },
          radius: 15000,  // 15km — covers Greater Kraków
        },
      },
      maxResultCount: Math.min(20, maxResults - results.length),
      languageCode: "en",
    };

    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(`${GMAPS_BASE}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GMAPS_KEY,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.businessStatus,nextPageToken",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Text Search failed (${res.status}): ${text}`);
    }

    const data: GMapsTextSearchResponse = await res.json();
    const places = data.places ?? [];
    results.push(...places);
    pageToken = data.nextPageToken;
    page++;

    if (!pageToken) break;
  }

  return results;
}

/**
 * Normalises a GMapsTextSearchResult into the TextSearchResult shape
 * used by utils.ts pre-triage functions.
 */
function toTextSearchResult(r: GMapsTextSearchResult): TextSearchResult {
  return {
    name: r.displayName?.text ?? "",
    types: r.types ?? [],
    rating: r.rating ?? 0,
    user_ratings_total: r.userRatingCount ?? 0,
    geometry: {
      location: {
        lat: r.location.latitude,
        lng: r.location.longitude,
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Place Details fetch
// ─────────────────────────────────────────────────────────────────────────────

interface GMapsPlaceDetails {
  id: string;
  displayName?: { text: string; languageCode: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: {
    openNow?: boolean;
    periods?: unknown[];
    weekdayDescriptions?: string[];
  };
  businessStatus?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  editorialSummary?: { text: string; languageCode: string };
  reviews?: Array<{
    name: string;
    relativePublishTimeDescription: string;
    rating: number;
    text?: { text: string; languageCode: string };
    originalText?: { text: string; languageCode: string };
    authorAttribution?: { displayName: string };
    publishTime: string;
    flagContentUri?: string;
    googleMapsUri?: string;
  }>;
  photos?: Array<{ name: string; widthPx: number; heightPx: number }>;
  priceLevel?: string;  // "PRICE_LEVEL_INEXPENSIVE" | "PRICE_LEVEL_MODERATE" | etc.
  types?: string[];
  plusCode?: { globalCode: string; compoundCode: string };
}

/** Maps Google's PRICE_LEVEL string enum to numeric 0-4 scale. */
function parsePriceLevel(priceLevel?: string): number | null {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return priceLevel ? (map[priceLevel] ?? null) : null;
}

/**
 * Fetches full Place Details for a given Google place_id.
 * Cost: $0.017 per call — only call for candidates that passed pre-triage.
 */
async function fetchPlaceDetails(placeId: string): Promise<GMapsPlaceDetails> {
  const res = await fetch(`${GMAPS_BASE}/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": GMAPS_KEY,
      "X-Goog-FieldMask": PLACE_DETAILS_FIELDS,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Place Details fetch failed for ${placeId} (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Converts Google's review objects into RawReview shape.
 */
function parseGoogleReviews(
  details: GMapsPlaceDetails,
  maxReviews = 5
): RawReview[] {
  if (!details.reviews) return [];

  return details.reviews.slice(0, maxReviews).map((r) => {
    const lang = r.text?.languageCode ?? r.originalText?.languageCode ?? "en";
    const text = r.text?.text ?? r.originalText?.text ?? "";
    const isEnglish = lang === "en";

    return {
      source: "google_maps" as const,
      author_name: r.authorAttribution?.displayName ?? null,
      review_date: r.publishTime?.split("T")[0] ?? new Date().toISOString().split("T")[0],
      rating: r.rating,
      text,
      language: lang,
      text_english: isEnglish ? null : null, // Translation deferred — Claude handles multilingual
      is_local_guide: false,  // Google Places API (New) doesn't surface Local Guide status in this field
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Apify Google Reviews scraper
// ─────────────────────────────────────────────────────────────────────────────

const APIFY_BASE = "https://api.apify.com/v2";
const APIFY_KEY = process.env.APIFY_API_KEY;
const APIFY_REVIEWS_ACTOR = "compass~google-maps-reviews-scraper";
const APIFY_MAX_REVIEWS = 75;
const APIFY_POLL_INTERVAL_MS = 5_000;
const APIFY_MAX_POLL_ATTEMPTS = 18; // 18 × 5s = 90 seconds max

if (!APIFY_KEY) {
  console.warn("[stage1] APIFY_API_KEY not set — Apify review enrichment disabled, falling back to Google's 5 reviews");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ApifyReview {
  text: string;
  stars: number;
  publishedAtDate: string;
  language?: string;
  isLocalGuide?: boolean;
  likesCount?: number;
  name?: string;
  textTranslated?: string;
}

/**
 * Fetches up to 200 Google Maps reviews for a Place ID via Apify's
 * compass/google-maps-reviews-scraper actor.
 *
 * Uses async run + polling (not sync run) for reliability.
 * Returns parsed RawReview array. Falls back to empty array on any failure
 * — Apify reviews are an enrichment, not a hard dependency.
 */
export async function fetchApifyReviews(placeId: string): Promise<RawReview[]> {
  console.log(`[stage1:apify] Starting fetch for placeId: ${placeId}`);
  if (!APIFY_KEY) {
    console.log(`[stage1:apify] No APIFY_KEY set, skipping`);
    return [];
  }

  try {
    // Start an async actor run
    const runRes = await fetch(
      `${APIFY_BASE}/acts/${APIFY_REVIEWS_ACTOR}/runs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${APIFY_KEY}`,
        },
        body: JSON.stringify({
          startUrls: [{ url: `https://www.google.com/maps/place/?q=place_id:${placeId}` }],
          maxReviews: APIFY_MAX_REVIEWS,
          reviewsSort: "mostRelevant",
          language: "en",
          personalDataOptions: "INCLUDE",
        }),
      }
    );

    console.log(`[stage1:apify] Run response status: ${runRes.status}`);

    if (!runRes.ok) {
      console.warn(`[stage1] Apify run start failed for ${placeId} (${runRes.status})`);
      return [];
    }

    const run = await runRes.json();
    console.log(`[stage1:apify] Run data:`, JSON.stringify(run.data));
    const runId = run.data?.id;
    if (!runId) {
      console.warn(`[stage1] Apify run start returned no run ID for ${placeId}`);
      return [];
    }

    // Poll for completion
    for (let attempt = 0; attempt < APIFY_MAX_POLL_ATTEMPTS; attempt++) {
      await sleep(APIFY_POLL_INTERVAL_MS);

      const statusRes = await fetch(
        `${APIFY_BASE}/actor-runs/${runId}`,
        { headers: { "Authorization": `Bearer ${APIFY_KEY}` } }
      );

      if (!statusRes.ok) continue;

      const status = await statusRes.json();
      const runStatus = status.data?.status;

      if (runStatus === "SUCCEEDED") break;
      if (["FAILED", "ABORTED", "TIMED-OUT"].includes(runStatus)) {
        console.warn(`[stage1] Apify run ${runId} ended with status ${runStatus} for ${placeId}`);
        return [];
      }
    }

    // Fetch dataset items
    const datasetRes = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}/dataset/items`,
      { headers: { "Authorization": `Bearer ${APIFY_KEY}` } }
    );

    if (!datasetRes.ok) {
      console.warn(`[stage1] Apify dataset fetch failed for ${placeId} (${datasetRes.status})`);
      return [];
    }

    const items: ApifyReview[] = await datasetRes.json();

    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    return items
      .filter((item) => item.text || item.textTranslated)
      .map((item): RawReview => ({
        source: "google_maps",
        author_name: item.name ?? null,
        review_date: (item.publishedAtDate ?? new Date().toISOString()).split("T")[0],
        rating: item.stars ?? null,
        text: item.text ?? item.textTranslated ?? "",
        language: item.language ?? "en",
        text_english: item.textTranslated ?? null,
        is_local_guide: item.isLocalGuide ?? false,
      }));
  } catch (err) {
    console.warn(
      `[stage1] Apify reviews failed for ${placeId}:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Secondary source: Foursquare (nightlife)
// ─────────────────────────────────────────────────────────────────────────────

const FSQ_BASE = "https://places-api.foursquare.com";
const FSQ_KEY = process.env.FOURSQUARE_API_KEY!;

// Foursquare category IDs for nightlife venues
const FSQ_NIGHTLIFE_CATEGORIES = [
  "13003",  // Bar
  "13002",  // Nightclub
  "13013",  // Cocktail Bar
  "13035",  // Pub
  "13046",  // Wine Bar
  "13009",  // Jazz Club
  "13028",  // Live Music Venue
  "13056",  // Beer Garden / Biergarten
].join(",");

interface FoursquareVenue {
  fsq_place_id: string;
  name: string;
  location: {
    formatted_address: string;
    latitude: number;
    longitude: number;
  };
  rating?: number;
  stats?: { total_ratings: number; total_tips: number; total_photos: number };
  website?: string;
  tips?: Array<{ fsq_tip_id: string; text: string; created_at: string; lang: string }>;
}

async function foursquareSearch(cityName: string, maxResults: number): Promise<FoursquareVenue[]> {
  if (!process.env.FOURSQUARE_API_KEY) {
    console.warn("[stage1] FOURSQUARE_API_KEY not set — skipping Foursquare search");
    return [];
  }

  const params = new URLSearchParams({
    query: `bars nightlife ${cityName}`,
    near: cityName,
    categories: FSQ_NIGHTLIFE_CATEGORIES,
    limit: String(Math.min(maxResults, 50)),
    fields: "fsq_place_id,name,location,rating,stats,website,tips",
  });

  const res = await fetch(`${FSQ_BASE}/places/search?${params}`, {
    headers: {
      Authorization: `Bearer ${FSQ_KEY}`,
      Accept: "application/json",
      "X-Places-Api-Version": "2025-06-17",
    },
  });

  if (!res.ok) {
    const text = await res.text();

    if (res.status === 402 || res.status === 403 || text.includes("no API credits")) {
      console.warn(`[stage1] Foursquare billing/credits issue (${res.status}) — skipping, Google Maps results only`);
      return [];
    }

    throw new Error(`Foursquare search failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.results ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Secondary source stubs — Booking.com, Viator, GetYourGuide
// These APIs require partner-level access obtained after affiliate approval.
// The function signatures and return shapes are final; implementations follow
// once API credentials are live.
// ─────────────────────────────────────────────────────────────────────────────

interface BookingProperty {
  hotel_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  review_score: number;     // 0-10 scale
  review_count: number;
  hotel_url: string;
}

async function bookingSearch(_cityName: string, _maxResults: number): Promise<BookingProperty[]> {
  // TODO: Implement once Stay22/Booking.com affiliate API credentials are live.
  // Endpoint: Booking.com Demand API /v1/hotels
  // Auth: API key from affiliate dashboard
  console.warn("[stage1] Booking.com search not yet implemented — returning empty");
  return [];
}

interface ViatorTour {
  productCode: string;
  title: string;
  description: string;
  rating: number;
  reviewCount: number;
  webURL: string;
  // Viator doesn't always provide precise coordinates — use city centre as fallback
  lat?: number;
  lng?: number;
}

async function viatorSearch(_cityName: string, _maxResults: number): Promise<ViatorTour[]> {
  // TODO: Implement once Viator affiliate API credentials are live.
  // Endpoint: Viator /products/search with destinationId
  // Kraków destination ID: 737 (confirm against Viator destination taxonomy)
  console.warn("[stage1] Viator search not yet implemented — returning empty");
  return [];
}

async function getYourGuideSearch(_cityName: string, _maxResults: number): Promise<unknown[]> {
  // TODO: Implement once GetYourGuide affiliate API credentials are live.
  console.warn("[stage1] GetYourGuide search not yet implemented — returning empty");
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidate record builder
// ─────────────────────────────────────────────────────────────────────────────

interface PendingCandidate {
  name: string;
  address: string;
  lat: number;
  lng: number;
  google_place_id: string | null;
  sources: CandidateSource[];
  google_maps_rating: number | null;
  google_maps_review_count: number | null;
  booking_com_rating: number | null;
  tripadvisor_rating: number | null;
  tripadvisor_review_count: number | null;
  price_level: number | null;
  opening_hours_text: string | null;
  business_status: string | null;
  website: string | null;
  recent_reviews: RawReview[];
  review_source: "apify" | "google";
  review_count_fetched: number;
  photo_name: string | null;     // first photo resource name for curator display
  early_trap_flag: boolean;      // 1 early trap signal detected
  early_trap_rejected: boolean;  // 2+ early trap signals — rejected before Place Details
  pretriage_rejected: boolean;   // failed zero-cost pre-triage
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: runStage1
// ─────────────────────────────────────────────────────────────────────────────

// TEST MODE ONLY — never ship this to production.
interface Stage1Options {
  testMode?: boolean;
  maxCandidates?: number;
}

export async function runStage1(
  cityId: string,
  category: Category,
  supabase: SupabaseClient,
  options: Stage1Options = {}
): Promise<Stage1Result> {
  const { testMode = false, maxCandidates = 10 } = options;
  const cityContext = await fetchCityContext(cityId, supabase);
  console.log(`[stage1] Starting: city=${cityContext.name}, category=${category}`);

  const queries = buildSearchQueries(category, cityContext);
  const targetCount = DISCOVERY_TARGETS[category];

  // ── Step 1: Text Search — collect raw candidates from all queries ─────────
  // Deduplicate by place_id during collection to avoid re-fetching Place Details.
  const seenPlaceIds = new Set<string>();
  const textSearchResults: GMapsTextSearchResult[] = [];

  // Run all search queries in parallel
  const searchPromises = queries.map((q) =>
    googleTextSearch(q, cityContext.name, Math.ceil(targetCount / queries.length) + 10)
      .catch((err) => {
        console.warn(`[stage1] Text search failed for query "${q}":`, err.message);
        return [] as GMapsTextSearchResult[];
      })
  );

  const searchBatches = await Promise.all(searchPromises);
  for (const batch of searchBatches) {
    for (const result of batch) {
      if (!seenPlaceIds.has(result.id)) {
        seenPlaceIds.add(result.id);
        textSearchResults.push(result);
      }
    }
  }

  console.log(`[stage1] Text Search collected ${textSearchResults.length} unique candidates`);

  // ── Step 2: Pre-triage — eliminate before Place Details call [v1.1] ───────
  const pretriageRejected: GMapsTextSearchResult[] = [];
  const earlyTrapRejected: GMapsTextSearchResult[] = [];
  const earlyTrapFlagged: Set<string> = new Set();
  let passingTextResults: GMapsTextSearchResult[] = [];

  for (const result of textSearchResults) {
    const tsr = toTextSearchResult(result);

    // Zero-cost pre-triage (all categories)
    if (!passesPretriage(tsr, category)) {
      pretriageRejected.push(result);
      continue;
    }

    // Restaurant early tourist trap pre-pass (restaurants only) [v1.1]
    if (category === "restaurant") {
      const signals = earlyTouristTrapSignals(tsr, cityContext);

      if (signals.length >= 2) {
        // Multi-signal rejection — skip Place Details entirely
        earlyTrapRejected.push(result);
        continue;
      }

      if (signals.length === 1) {
        // Single signal — fetch Place Details but flag for heightened Gate 1 scrutiny
        earlyTrapFlagged.add(result.id);
      }
    }

    passingTextResults.push(result);
  }

  console.log(
    `[stage1] Pre-triage: ${pretriageRejected.length} rejected, ` +
    `${earlyTrapRejected.length} early trap rejected, ` +
    `${passingTextResults.length} proceeding to Place Details`
  );

  // TEST MODE ONLY — cap before Place Details to avoid burning API credits
  if (testMode) {
    const original = passingTextResults.length;
    passingTextResults = passingTextResults.slice(0, maxCandidates);
    console.log(`[TEST MODE] Capped before Place Details: ${original} → ${passingTextResults.length}`);
  }

  // ── Step 3: Fetch Place Details for surviving candidates ─────────────────
  // Parallelise with a concurrency limit to stay under API rate limits.
  const CONCURRENCY = 5;
  const pendingCandidates: PendingCandidate[] = [];

  // Run secondary source searches in parallel with Place Details fetching
  const secondaryPromise = fetchSecondarySource(category, cityContext.name, targetCount);

  // Process Place Details in batches of CONCURRENCY
  for (let i = 0; i < passingTextResults.length; i += CONCURRENCY) {
    const batch = passingTextResults.slice(i, i + CONCURRENCY);

    const detailPromises = batch.map(async (textResult) => {
      try {
        const details = await fetchPlaceDetails(textResult.id);
        const googleReviews = parseGoogleReviews(details);
        // Apify enrichment moved to post-Gate 1 in index.ts
        const reviews = googleReviews;

        const candidate: PendingCandidate = {
          name: details.displayName?.text ?? textResult.displayName?.text ?? "",
          address: details.formattedAddress ?? textResult.formattedAddress ?? "",
          lat: details.location?.latitude ?? textResult.location.latitude,
          lng: details.location?.longitude ?? textResult.location.longitude,
          google_place_id: details.id,
          sources: [
            {
              source: "google_maps",
              source_id: details.id,
              source_url: `https://maps.google.com/?cid=${details.id}`,
              is_primary: true,
            },
          ],
          google_maps_rating: details.rating ?? null,
          google_maps_review_count: details.userRatingCount ?? null,
          booking_com_rating: null,
          tripadvisor_rating: null,
          tripadvisor_review_count: null,
          price_level: parsePriceLevel(details.priceLevel),
          opening_hours_text:
            details.currentOpeningHours?.weekdayDescriptions?.join("; ") ?? null,
          business_status: details.businessStatus ?? null,
          website: details.websiteUri ?? null,
          recent_reviews: reviews,
          review_source: "google",
          review_count_fetched: reviews.length,
          photo_name: details.photos?.[0]?.name ?? null,
          early_trap_flag: earlyTrapFlagged.has(textResult.id),
          early_trap_rejected: false,
          pretriage_rejected: false,
        };

        return candidate;
      } catch (err) {
        console.warn(
          `[stage1] Place Details failed for ${textResult.id}:`,
          err instanceof Error ? err.message : err
        );
        return null;
      }
    });

    const batchResults = await Promise.all(detailPromises);
    for (const c of batchResults) {
      if (c) pendingCandidates.push(c);
    }
  }

  console.log(
    `[stage1] Place Details fetched for ${pendingCandidates.length} candidates`
  );

  // ── Step 4: Merge secondary source candidates ─────────────────────────────
  const secondaryCandidates = await secondaryPromise;
  const allCandidates = [...pendingCandidates, ...secondaryCandidates];

  // ── Step 5: Deduplicate by 50m proximity ──────────────────────────────────
  const deduped = deduplicateCandidates(
    allCandidates.map((c) => ({
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      sources: c.sources,
      google_maps_rating: c.google_maps_rating,
      google_maps_review_count: c.google_maps_review_count,
      // Carry through all other fields
      _candidate: c,
    }))
  );

  const dedupedCandidates: PendingCandidate[] = deduped.map((d) => {
    return { ...d._candidate, sources: d.sources };
  });

  console.log(
    `[stage1] After deduplication: ${dedupedCandidates.length} unique candidates ` +
    `(${allCandidates.length - dedupedCandidates.length} merged)`
  );

  // ── Step 6: Write pipeline_candidates rows to Supabase ────────────────────
  // Write pre-triage rejected candidates with a minimal record for audit trail.
  // Write passing candidates as 'queued' with full data.
  const candidateIds: string[] = [];

  // Write rejected (pre-triage) — minimal records for audit
  await writePretriageRejected(cityId, category, pretriageRejected, supabase);

  // Write early-trap rejected — minimal records
  await writeEarlyTrapRejected(cityId, category, earlyTrapRejected, supabase);

  // Write passing candidates
  for (const candidate of dedupedCandidates) {
    try {
      // ── Duplicate and dual-mode detection ─────────────────────────────
      // Same google_place_id + same category = duplicate, skip.
      // Same google_place_id + different category = dual-mode venue, proceed with flag.
      let dualModeVenue = false;
      let dualModeNote: string | null = null;

      if (candidate.google_place_id) {
        // Check for same place_id + same category (true duplicate)
        const { data: sameCatEntry } = await supabase
          .from("entries")
          .select("id, name")
          .eq("google_place_id", candidate.google_place_id)
          .eq("city_id", cityId)
          .eq("category", category)
          .maybeSingle();

        if (sameCatEntry) {
          console.log(`[stage1] Skipping duplicate: ${candidate.name} already exists as "${sameCatEntry.name}" in ${category}`);
          continue;
        }

        const { data: sameCatCandidate } = await supabase
          .from("pipeline_candidates")
          .select("id, name")
          .eq("google_place_id", candidate.google_place_id)
          .eq("city_id", cityId)
          .eq("category", category)
          .eq("processing_status", "queued")
          .maybeSingle();

        if (sameCatCandidate) {
          console.log(`[stage1] Skipping duplicate candidate: ${candidate.name} already queued in ${category}`);
          continue;
        }

        // Check for same place_id + different category (dual-mode venue)
        const { data: diffCatEntry } = await supabase
          .from("entries")
          .select("id, name, category")
          .eq("google_place_id", candidate.google_place_id)
          .eq("city_id", cityId)
          .neq("category", category)
          .maybeSingle();

        const { data: diffCatCandidate } = await supabase
          .from("pipeline_candidates")
          .select("id, name, category")
          .eq("google_place_id", candidate.google_place_id)
          .eq("city_id", cityId)
          .neq("category", category)
          .eq("processing_status", "queued")
          .maybeSingle();

        const dualMatch = diffCatEntry || diffCatCandidate;
        if (dualMatch) {
          dualModeVenue = true;
          dualModeNote = `Shares location with existing ${dualMatch.category} entry: ${dualMatch.name}`;
          console.log(`[stage1] Dual-mode venue detected: ${candidate.name} — ${dualModeNote}`);
        }
      }

      const { composite_rating, composite_review_count } = computeCompositeRating(
        candidate.google_maps_rating,
        candidate.google_maps_review_count,
        candidate.booking_com_rating,
        candidate.tripadvisor_rating,
        candidate.tripadvisor_review_count
      );

      const { data, error } = await supabase
        .from("pipeline_candidates")
        .upsert({
          city_id: cityId,
          category,
          name: candidate.name,
          address: candidate.address,
          lat: candidate.lat,
          lng: candidate.lng,
          google_place_id: candidate.google_place_id,
          sources: candidate.sources,
          pipeline_version: 1,
          processing_status: "queued",
          // Reset gate results for fresh reprocessing
          gate0_result: null,
          gate1_result: null,
          gate2_result: null,
          stage3_result: null,
          failure_stage: null,
          failure_reason: null,
          ...(dualModeVenue && {
            dual_mode_venue: true,
            dual_mode_note: dualModeNote,
          }),
          // Stage 1 enrichment: Place Details, ratings, reviews, and operational
          // data. Stored in stage1_result so it persists after Gate 0 writes its
          // own output to gate0_result.
          stage1_result: {
            _stage1_enrichment: true,
            aggregate_ratings: {
              google_maps_rating: candidate.google_maps_rating,
              google_maps_review_count: candidate.google_maps_review_count,
              booking_com_rating: candidate.booking_com_rating,
              tripadvisor_rating: candidate.tripadvisor_rating,
              tripadvisor_review_count: candidate.tripadvisor_review_count,
              composite_rating,
              composite_review_count,
            },
            recent_reviews: candidate.recent_reviews,
            review_source: candidate.review_source,
            review_count_fetched: candidate.review_count_fetched,
            editorial_mentions: [],
            opening_hours_text: candidate.opening_hours_text,
            business_status: candidate.business_status,
            website: candidate.website,
            photo_name: candidate.photo_name,
            price_level: candidate.price_level,
            early_trap_flag: candidate.early_trap_flag,
          },
        }, { onConflict: "google_place_id,city_id,category" })
        .select("id")
        .single();

      if (error || !data) {
        console.warn(`[stage1] Failed to write candidate ${candidate.name}:`, error?.message);
        continue;
      }

      candidateIds.push(data.id);
    } catch (err) {
      console.warn(
        `[stage1] Exception writing candidate ${candidate.name}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log(
    `[stage1] Written ${candidateIds.length} queued candidates to pipeline_candidates`
  );

  return {
    candidateIds,
    discovered: textSearchResults.length,
    deduplicated: allCandidates.length - dedupedCandidates.length,
    pretriageRejected: pretriageRejected.length,
    earlyTrapRejected: earlyTrapRejected.length,
    enteringGate0: candidateIds.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Secondary source dispatcher
// ─────────────────────────────────────────────────────────────────────────────

async function fetchSecondarySource(
  category: Category,
  cityName: string,
  maxResults: number
): Promise<PendingCandidate[]> {
  switch (category) {
    case "nightlife":
      return fetchFoursquareCandidates(cityName, maxResults);
    case "accommodation":
      return fetchBookingCandidates(cityName, maxResults);
    case "tour":
      return fetchTourCandidates(cityName, maxResults);
    default:
      return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Secondary source builders
// ─────────────────────────────────────────────────────────────────────────────

async function fetchFoursquareCandidates(
  cityName: string,
  maxResults: number
): Promise<PendingCandidate[]> {
  try {
    const venues = await foursquareSearch(cityName, maxResults);
    return venues.map((v): PendingCandidate => ({
      name: v.name,
      address: v.location.formatted_address,
      lat: v.location.latitude,
      lng: v.location.longitude,
      google_place_id: null,  // enriched during deduplication if Google match found
      sources: [
        {
          source: "foursquare",
          source_id: v.fsq_place_id,
          source_url: `https://foursquare.com/v/${v.fsq_place_id}`,
          is_primary: true,
        },
      ],
      google_maps_rating: null,
      google_maps_review_count: null,
      booking_com_rating: null,
      tripadvisor_rating: v.rating ?? null,  // Foursquare rating used as proxy
      tripadvisor_review_count: v.stats?.total_ratings ?? null,
      price_level: null,
      opening_hours_text: null,
      business_status: null,
      website: v.website ?? null,
      recent_reviews: (v.tips ?? []).slice(0, 5).map((tip): RawReview => ({
        source: "local_platform",
        author_name: null,
        review_date: tip.created_at?.split("T")[0] ?? new Date().toISOString().split("T")[0],
        rating: null,
        text: tip.text,
        language: tip.lang ?? "en",
        text_english: null,
        is_local_guide: false,
      })),
      review_source: "google",
      review_count_fetched: (v.tips ?? []).slice(0, 5).length,
      photo_name: null,
      early_trap_flag: false,
      early_trap_rejected: false,
      pretriage_rejected: false,
    }));
  } catch (err) {
    console.warn("[stage1] Foursquare fetch failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

async function fetchBookingCandidates(
  cityName: string,
  maxResults: number
): Promise<PendingCandidate[]> {
  try {
    const properties = await bookingSearch(cityName, maxResults);
    return properties.map((p): PendingCandidate => ({
      name: p.name,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      google_place_id: null,
      sources: [
        {
          source: "booking_com",
          source_id: String(p.hotel_id),
          source_url: p.hotel_url,
          is_primary: true,
        },
      ],
      google_maps_rating: null,
      google_maps_review_count: null,
      booking_com_rating: p.review_score,   // 0-10 scale
      tripadvisor_rating: null,
      tripadvisor_review_count: null,
      price_level: null,
      opening_hours_text: null,
      business_status: null,
      website: p.hotel_url,
      recent_reviews: [],
      review_source: "google",
      review_count_fetched: 0,
      photo_name: null,
      early_trap_flag: false,
      early_trap_rejected: false,
      pretriage_rejected: false,
    }));
  } catch (err) {
    console.warn("[stage1] Booking.com fetch failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

async function fetchTourCandidates(
  cityName: string,
  maxResults: number
): Promise<PendingCandidate[]> {
  // Viator and GYG run in parallel
  const [viator, gyg] = await Promise.allSettled([
    viatorSearch(cityName, maxResults),
    getYourGuideSearch(cityName, maxResults),
  ]);

  const candidates: PendingCandidate[] = [];

  if (viator.status === "fulfilled") {
    for (const tour of viator.value) {
      candidates.push({
        name: tour.title,
        address: cityName,  // Tour departure points use city as fallback
        lat: tour.lat ?? 50.0647,   // Kraków centre fallback
        lng: tour.lng ?? 19.9450,
        google_place_id: null,
        sources: [
          {
            source: "viator",
            source_id: tour.productCode,
            source_url: tour.webURL,
            is_primary: true,
          },
        ],
        google_maps_rating: null,
        google_maps_review_count: null,
        booking_com_rating: null,
        tripadvisor_rating: tour.rating,
        tripadvisor_review_count: tour.reviewCount,
        price_level: null,
        opening_hours_text: null,
        business_status: null,
        website: tour.webURL,
        recent_reviews: [],
        review_source: "google",
        review_count_fetched: 0,
        photo_name: null,
        early_trap_flag: false,
        early_trap_rejected: false,
        pretriage_rejected: false,
      });
    }
  }

  // GetYourGuide — shape TBD once API credentials are live
  // if (gyg.status === "fulfilled") { ... }

  return candidates;
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit trail writers — minimal records for rejected candidates
// ─────────────────────────────────────────────────────────────────────────────

async function writePretriageRejected(
  cityId: string,
  category: Category,
  rejected: GMapsTextSearchResult[],
  supabase: SupabaseClient
): Promise<void> {
  if (rejected.length === 0) return;

  const rows = rejected.map((r) => ({
    city_id: cityId,
    category,
    name: r.displayName?.text ?? "",
    address: r.formattedAddress ?? "",
    lat: r.location.latitude,
    lng: r.location.longitude,
    google_place_id: r.id,
    sources: [
      {
        source: "google_maps",
        source_id: r.id,
        source_url: null,
        is_primary: true,
      },
    ],
    pipeline_version: 1,
    processing_status: "rejected",
    stage1_result: {
      _stage1_enrichment: true,
      pre_filter_triage: true,
      google_maps_rating: r.rating ?? null,
      google_maps_review_count: r.userRatingCount ?? null,
    },
  }));

  // Insert in batches to avoid request size limits
  for (let i = 0; i < rows.length; i += 20) {
    const { error } = await supabase
      .from("pipeline_candidates")
      .upsert(rows.slice(i, i + 20), {
        onConflict: "google_place_id,city_id,category",
        ignoreDuplicates: true,
      });

    if (error) {
      console.warn("[stage1] Failed to write pre-triage rejected batch:", error.message);
    }
  }
}

async function writeEarlyTrapRejected(
  cityId: string,
  category: Category,
  rejected: GMapsTextSearchResult[],
  supabase: SupabaseClient
): Promise<void> {
  if (rejected.length === 0) return;

  const rows = rejected.map((r) => ({
    city_id: cityId,
    category,
    name: r.displayName?.text ?? "",
    address: r.formattedAddress ?? "",
    lat: r.location.latitude,
    lng: r.location.longitude,
    google_place_id: r.id,
    sources: [
      {
        source: "google_maps",
        source_id: r.id,
        source_url: null,
        is_primary: true,
      },
    ],
    pipeline_version: 1,
    processing_status: "rejected",
    stage1_result: {
      _stage1_enrichment: true,
      early_tourist_trap_rejected: true,
      google_maps_rating: r.rating ?? null,
      google_maps_review_count: r.userRatingCount ?? null,
    },
  }));

  for (let i = 0; i < rows.length; i += 20) {
    const { error } = await supabase
      .from("pipeline_candidates")
      .upsert(rows.slice(i, i + 20), {
        onConflict: "google_place_id,city_id,category",
        ignoreDuplicates: true,
      });

    if (error) {
      console.warn("[stage1] Failed to write early trap rejected batch:", error.message);
    }
  }
}