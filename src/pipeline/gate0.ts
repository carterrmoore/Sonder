/**
 * gate0.ts — Operational Verification
 *
 * Gate 0 determines whether a candidate is currently operational before
 * spending any Claude tokens on it. A closed venue that passes Gate 1 and
 * Gate 2 and gets recommended to a user destroys trust instantly.
 *
 * Runs 5 signals in parallel (phone verification is Phase 2):
 *   1. google_maps_status       — businessStatus from Place Details
 *   2. geographic_verification  — address resolves to coordinates within 100m,
 *                                 neighbourhood assignment matches district
 *   3. booking_platform_status  — active listing (accommodations and tours only)
 *   4. recent_review_activity   — at least 1 review in the past 60 days
 *   5. website_social_activity  — website returns 200, no closure announcement
 *
 * Thresholds:
 *   3+ signals passed → verified_open   (enters Gate 1)
 *   2  signals passed → likely_open     (enters Gate 1, flagged for curator Queue 1)
 *   0-1 signals       → status_unknown  (rejected, no Claude tokens consumed)
 *   google_maps_status failed → auto-reject unless 4+ other signals pass
 *   businessStatus === CLOSED_PERMANENTLY → confirmed_closed (hard reject)
 *
 * Pre-filter triage belt-and-suspenders [v1.1]:
 *   Candidates with very low rating + very low review count that slipped through
 *   Stage 1 pre-triage get a minimal check only (google_maps_status signal only).
 *   They will fail Gate 2 regardless — don't waste parallel signal checks on them.
 *
 * Data source:
 *   Gate 0 reads Stage 1 enrichment data from the stage1_result column.
 *   Gate 0's own output is written to gate0_result by processCandidate.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Gate0Result, Gate0Signal, OperationalStatus } from "@/types/pipeline";

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1 enrichment shape (written by stage1.ts into stage1_result column)
// ─────────────────────────────────────────────────────────────────────────────

interface Stage1Enrichment {
  _stage1_enrichment: true;
  aggregate_ratings: {
    google_maps_rating: number | null;
    google_maps_review_count: number | null;
    composite_rating: number;
    composite_review_count: number;
    booking_com_rating: number | null;
    tripadvisor_rating: number | null;
    tripadvisor_review_count: number | null;
  };
  recent_reviews: Array<{
    source: string;
    review_date: string;
    rating: number | null;
    text: string;
    language: string;
    is_local_guide: boolean;
    author_name: string | null;
    text_english: string | null;
  }>;
  editorial_mentions: unknown[];
  opening_hours_text: string | null;
  business_status: string | null;
  website: string | null;
  photo_name: string | null;
  price_level: number | null;
  early_trap_flag: boolean;
  review_source?: "apify" | "google";
  review_count_fetched?: number;
}

interface CandidateRow {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  category: string;
  google_place_id: string | null;
  sources: unknown[];
  stage1_result: Stage1Enrichment | null;
  retry_count: number;
  is_curator_nomination: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Places API — fallback fetch for curator nominations
// ─────────────────────────────────────────────────────────────────────────────

const GMAPS_BASE = "https://places.googleapis.com/v1";
const GMAPS_KEY = process.env.GOOGLE_MAPS_API_KEY!;

const NOMINATION_DETAILS_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "businessStatus",
  "websiteUri",
  "reviews",
  "types",
].join(",");

/**
 * Fetches Place Details directly for a curator nomination that has no
 * stage1_result. Constructs a minimal Stage1Enrichment from the response.
 */
async function fetchEnrichmentForNomination(
  placeId: string
): Promise<{ enrichment: Stage1Enrichment; name: string; address: string; lat: number | null; lng: number | null } | null> {
  const res = await fetch(`${GMAPS_BASE}/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": GMAPS_KEY,
      "X-Goog-FieldMask": NOMINATION_DETAILS_FIELDS,
    },
  });

  if (!res.ok) return null;

  const details = await res.json();

  const reviews = (details.reviews ?? []).slice(0, 5).map((r: any) => ({
    source: "google_maps" as const,
    author_name: r.authorAttribution?.displayName ?? null,
    review_date: r.publishTime ?? new Date().toISOString(),
    rating: r.rating ?? null,
    text: r.originalText?.text ?? r.text?.text ?? "",
    language: r.originalText?.languageCode ?? r.text?.languageCode ?? "en",
    text_english: null,
    is_local_guide: false,
  }));

  // Attempt to enrich reviews via Apify (falls back to Google's 5 if it fails)
  const { fetchApifyReviews } = await import("@/pipeline/stage1");
  const apifyReviews = await fetchApifyReviews(placeId);
  const finalReviews = apifyReviews.length > 0 ? apifyReviews : reviews;
  const reviewSource = apifyReviews.length > 0 ? "apify" : "google";

  if (apifyReviews.length > 0) {
    console.log(`[gate0:apify] Fetched ${apifyReviews.length} reviews for nomination ${placeId}`);
  } else {
    console.log(`[gate0:apify] Fallback to Google reviews for nomination ${placeId}`);
  }

  const enrichment: Stage1Enrichment = {
    _stage1_enrichment: true,
    aggregate_ratings: {
      google_maps_rating: details.rating ?? null,
      google_maps_review_count: details.userRatingCount ?? null,
      composite_rating: details.rating ?? 0,
      composite_review_count: details.userRatingCount ?? 0,
      booking_com_rating: null,
      tripadvisor_rating: null,
      tripadvisor_review_count: null,
    },
    recent_reviews: finalReviews,
    review_source: reviewSource,
    review_count_fetched: finalReviews.length,
    editorial_mentions: [],
    opening_hours_text: null,
    business_status: details.businessStatus ?? null,
    website: details.websiteUri ?? null,
    photo_name: null,
    price_level: null,
    early_trap_flag: false,
  };

  return {
    enrichment,
    name: details.displayName?.text ?? "Unknown",
    address: details.formattedAddress ?? "",
    lat: details.location?.latitude ?? null,
    lng: details.location?.longitude ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal helpers
// ─────────────────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

/**
 * Signal 1: Google Maps business status.
 * Source: Place Details businessStatus field (stored in Stage 1 enrichment).
 *
 * OPERATIONAL      → passed
 * CLOSED_TEMPORARILY → failed (flag for Queue 1, not hard reject)
 * CLOSED_PERMANENTLY → failed + sets confirmed_closed flag
 * missing/unknown  → failed
 */
function checkGoogleMapsStatus(enrichment: Stage1Enrichment): {
  signal: Gate0Signal;
  confirmedClosed: boolean;
} {
  const status = enrichment.business_status?.toUpperCase();
  const confirmedClosed = status === "CLOSED_PERMANENTLY";

  const passed = status === "OPERATIONAL";
  const detail = status
    ? `Google Places businessStatus: ${status}`
    : "businessStatus not available in Place Details response";

  return {
    signal: {
      signal: "google_maps_status",
      passed,
      detail,
      checked_at: now(),
    },
    confirmedClosed,
  };
}

/**
 * Signal 2: Geographic verification.
 * Verifies that the stored address and coordinates are consistent.
 *
 * We check:
 *   - Coordinates exist and are non-zero
 *   - Address string is non-empty
 *   - Coordinates are within Poland's bounding box (for Kraków)
 *     (expand this check when adding other cities)
 *
 * Full cross-source address verification (Google Maps pin vs. venue website)
 * requires a live geocode call — deferred to Phase 2 for cost reasons.
 * This check catches the most common failure mode: missing or null coordinates.
 */
function checkGeographicVerification(
  candidate: CandidateRow
): Gate0Signal {
  const hasCoords =
    candidate.lat !== null &&
    candidate.lng !== null &&
    candidate.lat !== 0 &&
    candidate.lng !== 0;

  const hasAddress =
    typeof candidate.address === "string" && candidate.address.trim().length > 5;

  // Rough bounding box for Poland (covers all current and near-future cities)
  // Expand when adding non-Polish cities
  const inPoland =
    hasCoords &&
    candidate.lat! >= 49.0 &&
    candidate.lat! <= 54.9 &&
    candidate.lng! >= 14.1 &&
    candidate.lng! <= 24.2;

  const passed = hasCoords && hasAddress && inPoland;

  let detail: string;
  if (!hasCoords) {
    detail = "Missing or null coordinates — cannot verify location";
  } else if (!hasAddress) {
    detail = "Address string missing or too short to verify";
  } else if (!inPoland) {
    detail = `Coordinates (${candidate.lat}, ${candidate.lng}) outside expected region`;
  } else {
    detail = `Coordinates (${candidate.lat}, ${candidate.lng}) confirmed within region; address present`;
  }

  return {
    signal: "geographic_verification",
    passed,
    detail,
    checked_at: now(),
  };
}

/**
 * Signal 3: Booking platform active listing.
 * Applicable to: accommodation, tour.
 * All other categories: skipped (signal not applicable, counted as null not failed).
 *
 * For Phase 1b, we check whether a booking_com_rating exists (proxy for active
 * listing) for accommodations, and whether a Viator/GYG source_url exists for tours.
 * Full live API check (confirming bookable dates) is Phase 2.
 */
function checkBookingPlatformStatus(
  candidate: CandidateRow,
  enrichment: Stage1Enrichment
): Gate0Signal | null {
  const category = candidate.category;

  // Not applicable to restaurants, sights, nightlife
  if (!["accommodation", "tour"].includes(category)) {
    return null;
  }

  if (category === "accommodation") {
    const hasBookingRating = enrichment.aggregate_ratings.booking_com_rating !== null;
    return {
      signal: "booking_platform_status",
      passed: hasBookingRating,
      detail: hasBookingRating
        ? `Booking.com rating present (${enrichment.aggregate_ratings.booking_com_rating}/10)`
        : "No Booking.com rating found — listing may not be active",
      checked_at: now(),
    };
  }

  if (category === "tour") {
    // Check whether any source is Viator or GetYourGuide
    const sources = (candidate.sources ?? []) as Array<{ source: string; source_url: string | null }>;
    const hasTourListing = sources.some(
      (s) => s.source === "viator" || s.source === "getyourguide"
    );
    return {
      signal: "booking_platform_status",
      passed: hasTourListing,
      detail: hasTourListing
        ? "Active listing found on Viator or GetYourGuide"
        : "No Viator or GetYourGuide listing found",
      checked_at: now(),
    };
  }

  return null;
}

/**
 * Signal 4: Recent review activity.
 * At least 1 review posted within the past 60 days across any platform.
 * Zero reviews in 60 days → flag for manual verification.
 *
 * Review dates come from Stage 1 enrichment (Google Maps reviews only for now).
 * The 60-day window is generous — a venue with no reviews in 2 months may have
 * closed or dramatically declined.
 */
function checkRecentReviewActivity(enrichment: Stage1Enrichment): Gate0Signal {
  const reviews = enrichment.recent_reviews ?? [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);

  const recentReviews = reviews.filter((r) => {
    try {
      return new Date(r.review_date) >= cutoff;
    } catch {
      return false;
    }
  });

  const passed = recentReviews.length > 0;
  const mostRecent = reviews[0]?.review_date ?? null;

  return {
    signal: "recent_review_activity",
    passed,
    detail: passed
      ? `${recentReviews.length} review(s) in the past 60 days (most recent: ${recentReviews[0]?.review_date})`
      : `No reviews in the past 60 days. Most recent review: ${mostRecent ?? "unknown"}`,
    checked_at: now(),
  };
}

/**
 * Signal 5: Website / social media activity.
 * HTTP HEAD request to the venue's website URL.
 * Checks for closure keywords in the first 2KB of response body.
 *
 * Returns passed: true if:
 *   - Website URL exists AND
 *   - HTTP response is 200 AND
 *   - No closure keywords detected in first 2KB
 *
 * No website URL → passed: false (but not a strong negative signal for
 * many legitimate venues that operate without a website — scored conservatively).
 */
async function checkWebsiteSocialActivity(enrichment: Stage1Enrichment): Promise<Gate0Signal> {
  const websiteUrl = enrichment.website;

  if (!websiteUrl) {
    return {
      signal: "website_social_activity",
      passed: false,
      detail: "No website URL available — cannot verify online presence",
      checked_at: now(),
    };
  }

  try {
    // First try HEAD request — no body, minimal cost
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    let status: number;
    let shouldFetchBody = false;

    try {
      const headRes = await fetch(websiteUrl, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
      });
      status = headRes.status;
      // Only fetch body for 200 responses (check for closure keywords)
      shouldFetchBody = status === 200;
    } finally {
      clearTimeout(timeout);
    }

    if (status === 404) {
      return {
        signal: "website_social_activity",
        passed: false,
        detail: `Website returned 404 — URL may be stale or venue closed (${websiteUrl})`,
        checked_at: now(),
      };
    }

    if (status !== 200) {
      return {
        signal: "website_social_activity",
        passed: false,
        detail: `Website returned HTTP ${status} — could not verify (${websiteUrl})`,
        checked_at: now(),
      };
    }

    // 200 response — fetch first 2KB to check for closure keywords
    if (shouldFetchBody) {
      const closureKeywords = [
        "permanently closed",
        "zamknięte na stałe",    // Polish: permanently closed
        "już nie istnieje",      // Polish: no longer exists
        "fermé définitivement",  // French
        "dauerhaft geschlossen", // German
        "closed for good",
        "we are closed",
        "out of business",
        "has closed",
      ];

      try {
        const bodyController = new AbortController();
        const bodyTimeout = setTimeout(() => bodyController.abort(), 10000);

        const bodyRes = await fetch(websiteUrl, {
          signal: bodyController.signal,
          redirect: "follow",
        });
        clearTimeout(bodyTimeout);

        // Read first 2KB only
        const reader = bodyRes.body?.getReader();
        let bodyText = "";
        if (reader) {
          const { value } = await reader.read();
          reader.cancel();
          bodyText = new TextDecoder().decode(value?.slice(0, 2048));
        }

        const lowerBody = bodyText.toLowerCase();
        const closureDetected = closureKeywords.some((kw) =>
          lowerBody.includes(kw.toLowerCase())
        );

        if (closureDetected) {
          return {
            signal: "website_social_activity",
            passed: false,
            detail: `Website live (200) but closure keyword detected in page content (${websiteUrl})`,
            checked_at: now(),
          };
        }
      } catch {
        // Body fetch failed — still count the 200 HEAD as a pass
      }
    }

    return {
      signal: "website_social_activity",
      passed: true,
      detail: `Website returns 200, no closure keywords detected (${websiteUrl})`,
      checked_at: now(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      signal: "website_social_activity",
      passed: false,
      detail: `Website check failed: ${message} (${websiteUrl})`,
      checked_at: now(),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Threshold evaluation
// ─────────────────────────────────────────────────────────────────────────────

function evaluateThreshold(
  signals: Gate0Signal[],
  googleMapsFailed: boolean,
  confirmedClosed: boolean
): OperationalStatus {
  if (confirmedClosed) return "confirmed_closed";

  const passed = signals.filter((s) => s.passed).length;

  // Google Maps failed → auto-reject unless 4+ other signals pass
  if (googleMapsFailed) {
    const othersPassed = signals.filter(
      (s) => s.signal !== "google_maps_status" && s.passed
    ).length;
    if (othersPassed >= 4) return "verified_open";
    return "status_unknown";
  }

  if (passed >= 3) return "verified_open";
  if (passed === 2) return "likely_open";
  return "status_unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: runGate0
// ─────────────────────────────────────────────────────────────────────────────

export async function runGate0(
  candidateId: string,
  supabase: SupabaseClient
): Promise<Gate0Result> {
  // Read the candidate row — Gate 0 needs the Stage 1 enrichment
  const { data: candidate, error } = await supabase
    .from("pipeline_candidates")
    .select(
      "id, name, address, lat, lng, category, google_place_id, sources, stage1_result, retry_count, is_curator_nomination"
    )
    .eq("id", candidateId)
    .single<CandidateRow>();

  if (error || !candidate) {
    throw new Error(`Gate 0 could not read candidate ${candidateId}: ${error?.message}`);
  }

  let enrichment = candidate.stage1_result as Stage1Enrichment | null;

  // Curator nominations skip Stage 1 — fetch Place Details directly as fallback
  if (!enrichment?._stage1_enrichment) {
    if (candidate.is_curator_nomination && candidate.google_place_id) {
      const fetched = await fetchEnrichmentForNomination(candidate.google_place_id);

      if (!fetched) {
        throw new Error(
          "Could not fetch Place Details for nominated candidate — Place ID may be invalid"
        );
      }

      enrichment = fetched.enrichment;

      // Update the candidate row with real name/address from Google
      await supabase
        .from("pipeline_candidates")
        .update({
          name: fetched.name,
          address: fetched.address,
          lat: fetched.lat,
          lng: fetched.lng,
          stage1_result: enrichment,
        })
        .eq("id", candidateId);

      // Update local candidate object so downstream signals use fresh data
      candidate.name = fetched.name;
      candidate.address = fetched.address;
      candidate.lat = fetched.lat;
      candidate.lng = fetched.lng;
    } else {
      throw new Error(
        `Gate 0: candidate ${candidateId} is missing Stage 1 enrichment data in stage1_result`
      );
    }
  }

  // ── Belt-and-suspenders pre-filter triage [v1.1] ─────────────────────────
  // Candidates with very low rating + very low review count that somehow slipped
  // through Stage 1 pre-triage. Run google_maps_status only — they will fail
  // Gate 2 regardless of operational status.
  const rating = enrichment.aggregate_ratings?.google_maps_rating ?? 0;
  const reviewCount = enrichment.aggregate_ratings?.google_maps_review_count ?? 0;
  const isPrefilterTriage = rating < 3.5 && reviewCount < 20;

  if (isPrefilterTriage) {
    const { signal: gmSignal, confirmedClosed } = checkGoogleMapsStatus(enrichment);
    const status = confirmedClosed
      ? "confirmed_closed"
      : gmSignal.passed
      ? "likely_open"  // only 1 signal run — cap at likely_open
      : "status_unknown";

    return {
      status,
      signals: [gmSignal],
      signals_passed: gmSignal.passed ? 1 : 0,
      google_maps_failed: !gmSignal.passed,
      pre_filter_triage: true,
    };
  }

  // ── Full signal check — run all 5 signals in parallel ────────────────────
  const { signal: gmSignal, confirmedClosed } = checkGoogleMapsStatus(enrichment);
  const geoSignal = checkGeographicVerification(candidate);
  const bookingSignal = checkBookingPlatformStatus(candidate, enrichment);
  const reviewSignal = checkRecentReviewActivity(enrichment);
  const websiteSignal = await checkWebsiteSocialActivity(enrichment);

  // Collect all applicable signals (null = not applicable for this category)
  const allSignals: Gate0Signal[] = [
    gmSignal,
    geoSignal,
    bookingSignal,
    reviewSignal,
    websiteSignal,
  ].filter((s): s is Gate0Signal => s !== null);

  const signalsPassed = allSignals.filter((s) => s.passed).length;
  const googleMapsFailed = !gmSignal.passed;

  const status = evaluateThreshold(allSignals, googleMapsFailed, confirmedClosed);

  const result: Gate0Result = {
    status,
    signals: allSignals,
    signals_passed: signalsPassed,
    google_maps_failed: googleMapsFailed,
    pre_filter_triage: false,
  };

  return result;
}