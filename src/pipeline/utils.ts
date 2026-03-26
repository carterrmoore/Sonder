/**
 * utils.ts
 *
 * Pipeline utility functions. No external API calls. Pure logic only.
 * Imported by all other pipeline modules.
 *
 * Contains:
 *  - withRetry()              — exponential backoff (2min, 4min, 8min), max 3 attempts
 *  - deduplicateCandidates()  — 50m proximity merge, Google Maps as primary source
 *  - computeCompositeRating() — weighted composite rating across platforms
 *  - isWithinMeters()         — haversine distance check
 *  - placeTypeMatchesCategory()— Stage 1 pre-triage type mismatch check
 *  - earlyTouristTrapSignals()— Stage 1 restaurant early pre-pass (no Claude)
 *  - computeSeasonalScores()  — rule-based seasonal scores (Claude override for ambiguous)
 *  - batchArray()             — splits arrays into batches of N (for Claude calls)
 *  - getCurrentSeason()       — returns Season based on date + Northern Hemisphere assumption
 *  - sleep()                  — async delay
 *  - PipelineValidationError  — typed error class
 *  - TOURIST_NAME_PATTERNS    — regex list for early trap pre-pass
 */

import type {
  Category,
  Season,
  SeasonalScores,
  AggregateRatings,
  CandidateSource,
} from "@/types/pipeline";

// ─────────────────────────────────────────────────────────────────────────────
// Error types
// ─────────────────────────────────────────────────────────────────────────────

export class PipelineValidationError extends Error {
  constructor(
    public readonly zodError: unknown,
    message = "Pipeline data failed schema validation"
  ) {
    super(message);
    this.name = "PipelineValidationError";
  }
}

export class PipelineStageError extends Error {
  constructor(
    public readonly stage: string,
    public readonly candidateId: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(`[${stage}] Candidate ${candidateId}: ${message}`);
    this.name = "PipelineStageError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry logic
// ─────────────────────────────────────────────────────────────────────────────

/** Delay in milliseconds between retries. Exponential: 2min, 4min, 8min. */
const RETRY_DELAYS_MS = [2 * 60 * 1000, 4 * 60 * 1000, 8 * 60 * 1000];

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps an async operation with exponential backoff retry.
 * Max 3 attempts (1 initial + 2 retries). On all retries exhausted, throws the last error.
 *
 * @param fn         Async function to retry
 * @param context    Log context string (e.g. "gate1:candidate-uuid")
 * @param maxRetries Override default max retries (default: 3)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  maxRetries = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === maxRetries - 1;

      if (isLastAttempt) {
        console.error(
          `[withRetry] ${context}: all ${maxRetries} attempts failed. Final error:`,
          err
        );
        break;
      }

      const delayMs = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS.at(-1)!;
      console.warn(
        `[withRetry] ${context}: attempt ${attempt + 1} failed. Retrying in ${
          delayMs / 1000
        }s.`,
        err instanceof Error ? err.message : err
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Splits an array into chunks of at most `size` items.
 * The last chunk may be smaller. Never returns empty chunks.
 */
export function batchArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) throw new RangeError("Batch size must be > 0");
  const batches: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    batches.push(arr.slice(i, i + size));
  }
  return batches;
}

// ─────────────────────────────────────────────────────────────────────────────
// Geospatial helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Earth radius in metres (WGS-84 mean). */
const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Haversine great-circle distance in metres between two lat/lng points.
 */
export function distanceInMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Returns true if the point is within `thresholdMeters` of ANY landmark in the list.
 * Used in the Stage 1 early tourist trap pre-pass.
 */
export function isWithinMeters(
  point: { lat: number; lng: number },
  landmarks: Array<{ lat: number; lng: number }>,
  thresholdMeters: number
): boolean {
  return landmarks.some(
    (lm) => distanceInMeters(point.lat, point.lng, lm.lat, lm.lng) <= thresholdMeters
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-triage: type mismatch check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps Sonder categories to the Google Maps place types that are acceptable for each.
 * A Text Search result that returns none of these types for its category fails pre-triage.
 *
 * These are Google Places API (New) `types` field values.
 */
const CATEGORY_PLACE_TYPES: Record<Category, string[]> = {
  restaurant: [
    "restaurant",
    "cafe",
    "coffee_shop",
    "bakery",
    "food",
    "meal_takeaway",
    "meal_delivery",
    "bar",           // some bars serve food as primary
    "fast_food_restaurant",
    "ice_cream_shop",
    "sandwich_shop",
    "pizza_restaurant",
    "breakfast_restaurant",
  ],
  accommodation: [
    "lodging",
    "hotel",
    "hostel",
    "motel",
    "bed_and_breakfast",
    "guest_house",
    "apartment_complex",
  ],
  tour: [
    "travel_agency",
    "tourist_attraction",
    "tour_operator",
    "point_of_interest",
    "establishment",  // fallback — Viator/GYG tours may not have a Maps type
  ],
  sight: [
    "tourist_attraction",
    "museum",
    "art_gallery",
    "church",
    "cathedral",
    "synagogue",
    "mosque",
    "monument",
    "park",
    "natural_feature",
    "castle",
    "historic_site",
    "cemetery",      // some historic cemeteries are genuine sights
    "aquarium",
    "zoo",
    "amusement_park",
    "point_of_interest",
    "establishment",
    "library",
  ],
  cafe: [
    "cafe",
    "coffee_shop",
    "bakery",
    "patisserie",
    "breakfast_restaurant",
  ],
  nightlife: [
    "bar",
    "night_club",
    "casino",
    "liquor_store",  // some bottle shops act as bars
    "point_of_interest",
  ],
};

/**
 * Returns true if at least one of the result's `types` matches the expected types
 * for the given category. Used in Stage 1 zero-cost pre-triage.
 *
 * A petrol station appearing in restaurant results → false (rejected).
 */
export function placeTypeMatchesCategory(
  types: string[],
  category: Category
): boolean {
  const expected = CATEGORY_PLACE_TYPES[category];
  return types.some((t) => expected.includes(t));
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-triage: zero-cost filter (Stage 1)
// ─────────────────────────────────────────────────────────────────────────────

export interface TextSearchResult {
  name: string;
  types: string[];
  rating: number;
  user_ratings_total: number;
  geometry: { location: { lat: number; lng: number } };
}

/**
 * Stage 1 zero-cost pre-triage filter.
 * Runs on Text Search data BEFORE any Place Details call ($0.017 each).
 * Returns false to eliminate obviously unqualifiable candidates.
 *
 * Hard reject criteria (any one = fail):
 *  1. Rating < 3.5 AND review count < 20 (both very low — no signal worth paying for)
 *  2. Fewer than 5 reviews total (insufficient signal for any gate)
 *  3. Business type mismatch (e.g. petrol station in restaurant results)
 */
export function passesPretriage(
  result: TextSearchResult,
  category: Category
): boolean {
  // Hard reject: rating + review count both very low
  if (result.rating < 3.5 && result.user_ratings_total < 20) return false;

  // Hard reject: fewer than 5 reviews total
  if (result.user_ratings_total < 5) return false;

  // Hard reject: business type mismatch
  if (!placeTypeMatchesCategory(result.types, category)) return false;

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Early tourist trap pre-pass (restaurants only — Stage 1, before Place Details)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Name patterns that correlate with tourist-trap restaurants.
 * Each regex is tested against the lowercased venue name.
 * Matching a pattern is ONE signal — it alone does not reject.
 *
 * Rationale: generic English names, "traditional" in the name, and names
 * that lean on national stereotypes often indicate tourist-facing positioning.
 */
export const TOURIST_NAME_PATTERNS: RegExp[] = [
  /traditional\s+(polish|czech|hungarian|austrian|european)/i,
  /\b(olde?|ye\s+olde?)\b/i,                  // "Ye Olde Tavern"
  /\b(souvenir|gift\s+shop)\b/i,               // restaurant + souvenir combo
  /\b(folk(lore)?|folklore)\b/i,               // "Folklore Restaurant"
  /\bfamous\b.*\b(since|est\.?)\s*\d{4}/i,     // "Famous Since 1975" in the name
  /\bauthenti[ck]\b.*\bkitchen\b/i,            // "Authentic Polish Kitchen"
  /\bsightseeing\b/i,
  /\btourist\b/i,
];

export interface CityContext {
  id: string;
  slug: string;
  name: string;
  country: string;
  /** Coordinates of the top tourist landmarks (used in early trap pre-pass) */
  top_tourist_landmarks: Array<{ lat: number; lng: number; name: string }>;
}

export type EarlyTrapSignal =
  | "landmark_proximity"   // within 80m of a top-3 landmark
  | "high_volume_mediocre" // >2000 reviews AND rating < 4.3
  | "name_pattern";        // matches a TOURIST_NAME_PATTERNS regex

/**
 * Stage 1 early tourist trap signal check for restaurant candidates.
 * Runs on Text Search data BEFORE Place Details call.
 * Returns a list of triggered signals (empty = clean).
 *
 * Guard against false positives:
 *  - Proximity alone never rejects (a good restaurant near Wawel is fine)
 *  - Only 2+ independent signals trigger early rejection
 *  - Candidates with exactly 1 signal get Place Details but are flagged
 */
export function earlyTouristTrapSignals(
  result: TextSearchResult,
  city: CityContext
): EarlyTrapSignal[] {
  const signals: EarlyTrapSignal[] = [];

  // Signal 1: within 80m of a top tourist landmark
  if (
    isWithinMeters(
      result.geometry.location,
      city.top_tourist_landmarks,
      80
    )
  ) {
    signals.push("landmark_proximity");
  }

  // Signal 2: suspiciously high review count with mediocre rating
  if (result.user_ratings_total > 2000 && result.rating < 4.3) {
    signals.push("high_volume_mediocre");
  }

  // Signal 3: tourist-trap name pattern
  const lowerName = result.name.toLowerCase();
  if (TOURIST_NAME_PATTERNS.some((p) => p.test(lowerName))) {
    signals.push("name_pattern");
  }

  return signals;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seasonal scores — rule-based pre-computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal candidate shape needed for rule-based seasonal scoring.
 * Stage 4 passes a fuller object; we only extract what the rules need.
 */
export interface CandidateForSeasonalRules {
  category: Category;
  tags?: string[];
  name: string;
  outdoor_confirmed?: boolean;
  indoor_confirmed?: boolean;
  seasonal_closure_note?: string | null;
  is_weekend_only?: boolean;
}

/**
 * Computes seasonal scores via rule-based logic, WITHOUT calling Claude.
 * Returns null for ambiguous candidates that require Claude to score.
 * Expected to cover ~60–70% of candidates (primarily restaurants and indoor sights).
 *
 * [v1.1] This eliminates seasonal scoring tokens from the majority of Stage 4 calls.
 */
export function computeSeasonalScores(
  candidate: CandidateForSeasonalRules
): SeasonalScores | null {
  // Rule: rooftop venues — strong summer, weak winter
  if (
    candidate.tags?.some((t) => t === "rooftop") ||
    candidate.name.toLowerCase().includes("rooftop")
  ) {
    return { spring: 4, summer: 5, autumn: 3, winter: 1 };
  }

  // Rule: confirmed outdoor sight — strong spring/summer
  if (candidate.category === "sight" && candidate.outdoor_confirmed && !candidate.indoor_confirmed) {
    return { spring: 4, summer: 5, autumn: 4, winter: 2 };
  }

  // Rule: confirmed indoor-only sight — mild season variation, winter boost
  if (candidate.category === "sight" && candidate.indoor_confirmed && !candidate.outdoor_confirmed) {
    return { spring: 3, summer: 3, autumn: 3, winter: 4 };
  }

  // Rule: restaurant or cafe with no outdoor seating — all-season baseline
  if (
    (candidate.category === "restaurant" || candidate.category === "cafe") &&
    !candidate.tags?.includes("outdoor_seating") &&
    !candidate.outdoor_confirmed
  ) {
    return { spring: 4, summer: 4, autumn: 4, winter: 4 };
  }

  // Rule: explicit seasonal closure — ambiguous, send to Claude
  if (candidate.seasonal_closure_note) return null;

  // Rule: weekend-only operation — ambiguous, send to Claude
  if (candidate.is_weekend_only) return null;

  // No rule matched — ambiguous, send to Claude
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite rating
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a weighted composite rating across all platforms, normalised to 0–5 scale.
 * Google Maps is weighted most heavily; Booking.com and TripAdvisor are secondary.
 * All-null returns 0.
 */
export function computeCompositeRating(
  google_maps_rating: number | null,
  google_maps_review_count: number | null,
  booking_com_rating: number | null,
  tripadvisor_rating: number | null,
  tripadvisor_review_count: number | null
): Pick<AggregateRatings, "composite_rating" | "composite_review_count"> {
  // Booking.com uses 1–10 scale; normalise to 0–5
  const bookingNormalised =
    booking_com_rating !== null ? booking_com_rating / 2 : null;

  const sources: Array<{ rating: number; count: number; weight: number }> = [];

  if (google_maps_rating !== null) {
    sources.push({
      rating: google_maps_rating,
      count: google_maps_review_count ?? 1,
      weight: 3,
    });
  }
  if (bookingNormalised !== null) {
    sources.push({ rating: bookingNormalised, count: 1, weight: 1.5 });
  }
  if (tripadvisor_rating !== null) {
    sources.push({
      rating: tripadvisor_rating,
      count: tripadvisor_review_count ?? 1,
      weight: 1,
    });
  }

  if (sources.length === 0) {
    return { composite_rating: 0, composite_review_count: 0 };
  }

  const totalWeight = sources.reduce((sum, s) => sum + s.weight, 0);
  const weightedSum = sources.reduce((sum, s) => sum + s.rating * s.weight, 0);
  const composite_rating =
    Math.round((weightedSum / totalWeight) * 100) / 100;

  const composite_review_count =
    (google_maps_review_count ?? 0) + (tripadvisor_review_count ?? 0);

  return { composite_rating, composite_review_count };
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidate deduplication
// ─────────────────────────────────────────────────────────────────────────────

export interface RawCandidate {
  id?: string;
  name: string;
  lat: number;
  lng: number;
  sources: CandidateSource[];
  google_maps_rating?: number | null;
  google_maps_review_count?: number | null;
  [key: string]: unknown;
}

/**
 * Deduplicates a list of raw candidates by location proximity (50m radius).
 * When two candidates represent the same venue, they are merged into one record:
 *  - Google Maps is used as the primary source where overlap exists.
 *  - All sources from both candidates are merged into the resulting `sources[]`.
 *  - The primary candidate's name and coordinates win in a conflict.
 *
 * Secondary-source-only candidates (no Google Maps match) are returned as-is.
 */
export function deduplicateCandidates<T extends RawCandidate>(
  candidates: T[],
  thresholdMeters = 50
): T[] {
  const merged: T[] = [];
  const consumed = new Set<number>();

  for (let i = 0; i < candidates.length; i++) {
    if (consumed.has(i)) continue;

    const base = { ...candidates[i] } as T;
    const mergedSources = [...base.sources];

    for (let j = i + 1; j < candidates.length; j++) {
      if (consumed.has(j)) continue;

      const other = candidates[j];
      const dist = distanceInMeters(base.lat, base.lng, other.lat, other.lng);

      if (dist <= thresholdMeters) {
        // Merge: Google Maps source takes priority on coordinate/name
        const baseIsGoogle = base.sources.some(
          (s) => s.source === "google_maps" && s.is_primary
        );
        const otherIsGoogle = other.sources.some(
          (s) => s.source === "google_maps" && s.is_primary
        );

        if (!baseIsGoogle && otherIsGoogle) {
          // Swap: other is Google Maps, use it as the base data
          Object.assign(base, {
            name: other.name,
            lat: other.lat,
            lng: other.lng,
            google_maps_rating: other.google_maps_rating,
            google_maps_review_count: other.google_maps_review_count,
          });
        }

        // Merge sources from the other candidate, avoid duplicates by source_id
        for (const src of other.sources) {
          if (!mergedSources.some((s) => s.source_id === src.source_id)) {
            mergedSources.push({ ...src, is_primary: false });
          }
        }

        consumed.add(j);
      }
    }

    base.sources = mergedSources;
    merged.push(base);
    consumed.add(i);
  }

  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// Season detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the current meteorological season for the Northern Hemisphere.
 * All Sonder launch cities (Central Europe) are Northern Hemisphere.
 *
 * Meteorological seasons (not astronomical):
 *   Spring: March, April, May
 *   Summer: June, July, August
 *   Autumn: September, October, November
 *   Winter: December, January, February
 */
export function getCurrentSeason(date = new Date()): Season {
  const month = date.getMonth() + 1; // 1-indexed
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

// ─────────────────────────────────────────────────────────────────────────────
// Misc
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a short batch ID for Claude call tracing.
 * Format: "{stage}-{timestamp}-{random4}" e.g. "gate1-1709123456789-a3f2"
 */
export function generateBatchId(stage: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 6);
  return `${stage}-${ts}-${rand}`;
}