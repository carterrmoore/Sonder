/**
 * stage1-viator.ts
 *
 * Viator Affiliate API integration for Stage 1 tour candidate discovery.
 *
 * ROLE IN PIPELINE
 * Called by the Stage 1 orchestrator in parallel with Google Maps when
 * category === 'tour'. Returns RawCandidate[] which are then merged with
 * Google Maps results and deduplicated by the shared deduplicateCandidates()
 * utility (50m proximity threshold).
 *
 * API USED
 * Viator Affiliate API (Basic Access)
 * Base URL : https://api.viator.com/partner/
 * Auth     : exp-api-key header
 * Key env  : VIATOR_API_KEY
 *
 * ENDPOINTS
 * POST /products/search         — paginated tour search by destination ID
 * GET  /v1/taxonomy/destinations — destination lookup to resolve city → ID
 *
 * DESTINATION ID CACHING
 * Destination IDs are stable — they don't change between pipeline runs.
 * The first call resolves the ID from the taxonomy endpoint and caches it
 * in memory for the duration of the pipeline run. For multi-city runs,
 * each city resolves once and caches independently.
 *
 * CANDIDATE TARGET
 * 40–60 tour candidates per city (shared with Google Maps, post-dedup).
 * Viator paginates at 50 per request; one page is sufficient for city-level
 * discovery. If a city returns exactly 50, a second page fetch is triggered
 * to ensure full coverage.
 *
 * OUTPUT
 * RawCandidate[] compatible with utils.ts deduplicateCandidates().
 * Each candidate carries a CandidateSource with source: 'viator'.
 * The productUrl returned by Viator already contains the affiliate mcid/pid
 * parameters — this is stored as source_url and used for booking links.
 */

import type { CandidateSource } from "@/types/pipeline";
import type { RawCandidate } from "@/pipeline/utils";
import { withRetry, PipelineStageError } from "@/pipeline/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const VIATOR_BASE_URL = "https://api.viator.com/partner";
const VIATOR_PAGE_SIZE = 50;

/**
 * In-process cache: cityName (lowercase) → Viator destination ID.
 * Populated on first call per city; reused for the duration of the process.
 */
const destinationIdCache = new Map<string, string>();

// ─────────────────────────────────────────────────────────────────────────────
// Types — Viator API response shapes (minimal — only fields we use)
// ─────────────────────────────────────────────────────────────────────────────

interface ViatorDestination {
  destinationId: number;
  destinationUrlName: string;
  destinationName: string;
  parentId: number | null;
  type: string; // "CITY" | "REGION" | "COUNTRY" | etc.
  iataCode: string | null;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

interface ViatorDestinationsResponse {
  data: ViatorDestination[];
}

interface ViatorProductReviewSummary {
  sources: Array<{
    provider: "VIATOR" | "TRIPADVISOR";
    totalCount: number;
    averageRating: number;
  }>;
  totalReviews: number;
  combinedAverageRating: number;
}

interface ViatorPricing {
  summary: {
    fromPrice: number;
    fromPriceBeforeDiscount: number;
  };
  currency: string;
}

interface ViatorProduct {
  productCode: string;
  title: string;
  description: string;
  reviews: ViatorProductReviewSummary;
  pricing: ViatorPricing;
  /** Affiliate URL — already contains mcid/pid/medium params */
  productUrl: string;
  destinations: Array<{
    ref: string;
    primary: boolean;
  }>;
  tags: number[];
  flags: string[];
}

interface ViatorSearchResponse {
  products: ViatorProduct[];
  totalCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Destination ID resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves a city name to a Viator destination ID.
 *
 * Searches the full taxonomy for a CITY-type destination whose name matches
 * the provided city name (case-insensitive, trimmed). Falls back to partial
 * match if no exact match found.
 *
 * Caches results in memory — safe to call multiple times per run.
 *
 * @throws PipelineStageError if no destination match found
 */
export async function resolveViatorDestinationId(cityName: string): Promise<string> {
  const cacheKey = cityName.toLowerCase().trim();

  if (destinationIdCache.has(cacheKey)) {
    return destinationIdCache.get(cacheKey)!;
  }

  const apiKey = process.env.VIATOR_API_KEY;
  if (!apiKey) throw new Error("VIATOR_API_KEY is not set");

  const data = await withRetry(async () => {
    const response = await fetch(`${VIATOR_BASE_URL}/v1/taxonomy/destinations`, {
      method: "GET",
      headers: {
        "exp-api-key": apiKey,
        "Accept": "application/json;version=2.0",
        "Accept-Language": "en-US",
      },
    });

    if (!response.ok) {
      throw new PipelineStageError(
        "stage1:viator:destinations",
        cityName,
        `Destinations endpoint returned ${response.status}: ${await response.text()}`
      );
    }

    return response.json() as Promise<ViatorDestinationsResponse>;
  }, "stage1:viator:destinations");

  const normalised = cacheKey;

  // Exact match first (city-type destinations only)
  let match = data.data.find(
    (d) =>
      d.type === "CITY" &&
      d.destinationName.toLowerCase().trim() === normalised
  );

  // Fall back to partial match (e.g. "Kraków" vs "Krakow")
  if (!match) {
    match = data.data.find(
      (d) =>
        d.type === "CITY" &&
        (d.destinationName.toLowerCase().includes(normalised) ||
          normalised.includes(d.destinationName.toLowerCase().trim()))
    );
  }

  // Broader fallback — any type (e.g. district, region)
  if (!match) {
    match = data.data.find(
      (d) => d.destinationName.toLowerCase().trim() === normalised
    );
  }

  if (!match) {
    throw new PipelineStageError(
      "stage1:viator:destinations",
      cityName,
      `No Viator destination found for city: "${cityName}". Check the taxonomy endpoint for the correct name.`
    );
  }

  const destinationId = String(match.destinationId);
  destinationIdCache.set(cacheKey, destinationId);

  console.log(`[stage1-viator] Resolved "${cityName}" → destination ID ${destinationId} (${match.destinationName})`);

  return destinationId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Product search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches one page of tour products for a given Viator destination ID.
 * Sorted by TRAVELER_RATING descending to surface highest-quality candidates.
 */
async function fetchViatorProductPage(
  destinationId: string,
  start: number,
  count: number
): Promise<ViatorSearchResponse> {
  const apiKey = process.env.VIATOR_API_KEY;
  if (!apiKey) throw new Error("VIATOR_API_KEY is not set");

  return withRetry(async () => {
    const response = await fetch(`${VIATOR_BASE_URL}/products/search`, {
      method: "POST",
      headers: {
        "exp-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json;version=2.0",
        "Accept-Language": "en-US",
      },
      body: JSON.stringify({
        filtering: {
          destination: destinationId,
        },
        sorting: {
          sort: "TRAVELER_RATING",
          order: "DESCENDING",
        },
        pagination: {
          start,
          count,
        },
        currency: "EUR",
      }),
    });

    if (!response.ok) {
      throw new PipelineStageError(
        "stage1:viator:search",
        destinationId,
        `Products search returned ${response.status}: ${await response.text()}`
      );
    }

    return response.json() as Promise<ViatorSearchResponse>;
  }, "stage1:viator:search");
}

// ─────────────────────────────────────────────────────────────────────────────
// Response → RawCandidate mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a Viator product to the RawCandidate shape used by the pipeline.
 *
 * Coordinate note: Viator's /products/search does not return lat/lng in the
 * basic affiliate response. Coordinates are set to null here; the Stage 1
 * orchestrator resolves them via Google Maps Text Search lookup for any
 * candidate that lacks coordinates (standard flow for secondary-source-only
 * candidates).
 *
 * Rating note: Viator uses a 1–5 scale (combinedAverageRating). Stored as-is
 * in google_maps_rating field for pre-triage compatibility; the gate scoring
 * system normalises by source.
 */
function mapViatorProductToCandidate(product: ViatorProduct): RawCandidate {
  const source: CandidateSource = {
    source: "viator",
    source_id: product.productCode,
    source_url: product.productUrl, // affiliate URL with mcid/pid already embedded
    is_primary: false, // Google Maps is primary where overlap exists
  };

  const viatorRating = product.reviews.combinedAverageRating ?? null;
  const viatorReviewCount = product.reviews.totalReviews ?? null;

  return {
    name: product.title,
    lat: 0, // Resolved by Google Maps Text Search lookup in Stage 1 orchestrator
    lng: 0, // Resolved by Google Maps Text Search lookup in Stage 1 orchestrator
    sources: [source],
    google_maps_rating: null,      // Not yet resolved — pending Google enrichment
    google_maps_review_count: null,
    // Viator-specific fields stored for Gate scoring and editorial use
    viator_product_code: product.productCode,
    viator_rating: viatorRating,
    viator_review_count: viatorReviewCount,
    viator_price_from_eur: product.pricing.summary.fromPrice,
    viator_description: product.description,
    viator_flags: product.flags,   // e.g. FREE_CANCELLATION, LIKELY_TO_SELL_OUT
    viator_tags: product.tags,     // numeric tag IDs — cross-reference taxonomy if needed
    viator_affiliate_url: product.productUrl,
    // Pre-triage compatibility — use Viator rating as proxy until Google enrichment
    _viator_pretriage_rating: viatorRating,
    _viator_pretriage_review_count: viatorReviewCount,
    _needs_coordinate_enrichment: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public interface
// ─────────────────────────────────────────────────────────────────────────────

export interface ViatorSearchOptions {
  /**
   * City name as it appears in Sonder's cities table.
   * Used to resolve the Viator destination ID via taxonomy lookup.
   */
  cityName: string;
  /**
   * Maximum number of candidates to return.
   * Defaults to 50 (one full page). Set higher to trigger pagination.
   * Pipeline target for tours: 40–60 candidates total across all sources.
   */
  maxCandidates?: number;
}

/**
 * Discovers tour candidates from Viator for a given city.
 *
 * This is the main entry point called by the Stage 1 orchestrator.
 * Run in parallel with searchGoogleMapsTours() using Promise.allSettled().
 *
 * Returns RawCandidate[] ready for deduplication against Google Maps results.
 * Candidates with lat/lng === 0 require Google Maps Text Search enrichment
 * before entering Gate 0 — this is the standard secondary-source flow.
 *
 * @example
 * const [googleResults, viatorResults] = await Promise.allSettled([
 *   searchGoogleMapsTours(city),
 *   searchViatorTours({ cityName: city.name }),
 * ]);
 */
export async function searchViatorTours(
  options: ViatorSearchOptions
): Promise<RawCandidate[]> {
  const { cityName, maxCandidates = VIATOR_PAGE_SIZE } = options;

  console.log(`[stage1:viator] Starting tour discovery for "${cityName}"`);

  // Step 1: Resolve destination ID
  const destinationId = await resolveViatorDestinationId(cityName);

  // Step 2: Fetch first page
  const firstPage = await fetchViatorProductPage(destinationId, 1, Math.min(maxCandidates, VIATOR_PAGE_SIZE));

  let products = firstPage.products;

  console.log(
    `[stage1:viator] Page 1: ${products.length} products returned (totalCount: ${firstPage.totalCount})`
  );

  // Step 3: If first page returned exactly 50 AND we want more AND there are more, fetch page 2
  if (
    products.length === VIATOR_PAGE_SIZE &&
    maxCandidates > VIATOR_PAGE_SIZE &&
    firstPage.totalCount > VIATOR_PAGE_SIZE
  ) {
    const secondPage = await fetchViatorProductPage(
      destinationId,
      VIATOR_PAGE_SIZE + 1,
      Math.min(maxCandidates - VIATOR_PAGE_SIZE, VIATOR_PAGE_SIZE)
    );
    products = [...products, ...secondPage.products];
    console.log(
      `[stage1:viator] Page 2: ${secondPage.products.length} additional products`
    );
  }

  // Step 4: Map to RawCandidate[]
  const candidates = products.map(mapViatorProductToCandidate);

  console.log(
    `[stage1:viator] Returning ${candidates.length} candidates for "${cityName}" (destination ID: ${destinationId})`
  );

  return candidates;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: clear destination ID cache (for testing)
// ─────────────────────────────────────────────────────────────────────────────

export function clearViatorDestinationCache(): void {
  destinationIdCache.clear();
}
