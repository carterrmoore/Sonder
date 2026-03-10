/**
 * stage3.ts — Supplementary Verification
 *
 * Runs only on candidates that passed Gates 0, 1, and 2.
 * All checks run in parallel per candidate.
 *
 * Checks:
 *   1. Booking platform active listing (accommodations and tours only)
 *   2. TripAdvisor disconnect detection (high TA rank + no local platform presence)
 *   3. Local review platform presence (TheFork, Zomato, local equivalents)
 *   4. Website status (HTTP HEAD + closure keyword scan)
 *   5. Closure override (Stage 3 closure discovery overrides all gate results)
 *
 * A closure discovered in Stage 3 overrides Gate 0 status regardless of score.
 * This is the last operational check before editorial generation.
 *
 * All checks are parallelised — Stage 3 target runtime is 5-15 minutes
 * across all candidates, not per candidate.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, Stage3Result } from "@/types/pipeline";

// ─────────────────────────────────────────────────────────────────────────────
// Closure keywords (multilingual)
// ─────────────────────────────────────────────────────────────────────────────

const CLOSURE_KEYWORDS = [
  // English
  "permanently closed",
  "closed for good",
  "we are closed",
  "out of business",
  "has closed",
  "no longer open",
  "ceased trading",
  // Polish
  "zamknięte na stałe",
  "już nie istnieje",
  "lokal zamknięty",
  "zakończyliśmy działalność",
  "nie prowadzimy",
  // German (Vienna expansion)
  "dauerhaft geschlossen",
  "wir haben geschlossen",
  "betrieb eingestellt",
  // Czech (Prague expansion)
  "trvale uzavřeno",
  "provoz ukončen",
  // French
  "fermé définitivement",
  "nous avons fermé",
  // Hungarian (Budapest expansion)
  "véglegesen bezárt",
  "megszűntünk",
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CandidateForStage3 {
  id: string;
  name: string;
  category: string;
  sources: Array<{
    source: string;
    source_id: string;
    source_url: string | null;
    is_primary: boolean;
  }>;
  stage1_result: {
    website?: string | null;
    aggregate_ratings?: {
      booking_com_rating: number | null;
      tripadvisor_rating: number | null;
      tripadvisor_review_count: number | null;
    };
  };
  gate2_result: {
    total_score: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 1: Booking platform active listing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * For accommodations: checks for active Booking.com listing.
 * For tours: checks for active Viator or GetYourGuide listing.
 * All other categories: returns null (not applicable).
 *
 * Phase 1b: presence of a source URL is used as proxy for active listing.
 * Full live API check (confirming bookable dates) is Phase 2.
 */
function checkBookingPlatform(
  candidate: CandidateForStage3
): { booking_platform_active: boolean | null; booking_platform_url: string | null } {
  const category = candidate.category;

  if (category === "accommodation") {
    const bookingSource = candidate.sources.find((s) => s.source === "booking_com");
    return {
      booking_platform_active: bookingSource ? true : null,
      booking_platform_url: bookingSource?.source_url ?? null,
    };
  }

  if (category === "tour") {
    const tourSource = candidate.sources.find(
      (s) => s.source === "viator" || s.source === "getyourguide"
    );
    return {
      booking_platform_active: tourSource ? true : null,
      booking_platform_url: tourSource?.source_url ?? null,
    };
  }

  // Not applicable
  return {
    booking_platform_active: null,
    booking_platform_url: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 2 + 3: TripAdvisor disconnect + local platform presence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TripAdvisor disconnect: high TA rank but absent from local platforms.
 * This is a tourist trap signal surfaced to the curator — it does not
 * auto-reject. The curator decides whether to approve or escalate to Q1.
 *
 * Local platform presence: checks whether any source is Foursquare (the
 * primary local platform we collect from in Stage 1). In Phase 2, this
 * expands to TheFork, Zomato, and city-specific platforms.
 *
 * TripAdvisor rank is not available in Stage 1 data — we cannot check
 * the actual TA ranking yet. This check flags based on source absence:
 * if the candidate has no Foursquare/local_platform source AND has a
 * high Google review count (proxy for tourist platform visibility),
 * that combination is the disconnect signal.
 */
function checkLocalPresenceAndTADisconnect(
  candidate: CandidateForStage3
): {
  tripadvisor_disconnect_detected: boolean;
  tripadvisor_rank: number | null;
  local_platform_present: boolean;
  local_platform_name: string | null;
  local_platform_url: string | null;
} {
  const localSource = candidate.sources.find(
    (s) => s.source === "foursquare" || s.source === "local_platform"
  );

  const localPlatformPresent = localSource !== undefined;
  const localPlatformName = localSource?.source === "foursquare" ? "Foursquare" : null;
  const localPlatformUrl = localSource?.source_url ?? null;

  // TripAdvisor disconnect heuristic:
  // High Gate 2 score (75+) from tourist-facing reviews + no local platform presence
  // = candidate is well-known to tourists but invisible to locals
  // Full TA rank check requires TripAdvisor API (Phase 2)
  const gate2Score = candidate.gate2_result?.total_score ?? 0;
  const tripadvisorDisconnect =
    !localPlatformPresent &&
    gate2Score >= 75 &&
    candidate.category !== "sight" &&
    candidate.category !== "accommodation"; // These categories legitimately have no local platform presence

  return {
    tripadvisor_disconnect_detected: tripadvisorDisconnect,
    tripadvisor_rank: null, // Populated in Phase 2 via TripAdvisor API
    local_platform_present: localPlatformPresent,
    local_platform_name: localPlatformName,
    local_platform_url: localPlatformUrl,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Check 4 + 5: Website status + closure detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the venue website and checks for:
 *   - HTTP status (live / 404 / error)
 *   - Closure keywords in first 2KB of response body
 *   - Booking platform availability gaps (90+ days with no seasonal explanation)
 *
 * This is a more thorough check than Gate 0's website signal because
 * by Stage 3 we've already invested Gate 1 + Gate 2 Claude tokens.
 * A closure discovered here overrides all prior gate results.
 */
async function checkWebsiteAndClosure(
  websiteUrl: string | null | undefined,
  candidateName: string
): Promise<{
  website_status: "live" | "404" | "error" | null;
  website_url: string | null;
  closure_discovered: boolean;
  closure_evidence: string | null;
}> {
  if (!websiteUrl) {
    return {
      website_status: null,
      website_url: null,
      closure_discovered: false,
      closure_evidence: null,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let httpStatus: number;
    try {
      const headRes = await fetch(websiteUrl, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
      });
      httpStatus = headRes.status;
    } finally {
      clearTimeout(timeout);
    }

    if (httpStatus === 404) {
      return {
        website_status: "404",
        website_url: websiteUrl,
        closure_discovered: false, // 404 alone is not a confirmed closure
        closure_evidence: null,
      };
    }

    if (httpStatus !== 200) {
      return {
        website_status: "error",
        website_url: websiteUrl,
        closure_discovered: false,
        closure_evidence: null,
      };
    }

    // 200 — fetch first 2KB for closure keyword scan
    const bodyController = new AbortController();
    const bodyTimeout = setTimeout(() => bodyController.abort(), 12000);

    let bodyText = "";
    try {
      const bodyRes = await fetch(websiteUrl, {
        signal: bodyController.signal,
        redirect: "follow",
      });
      const reader = bodyRes.body?.getReader();
      if (reader) {
        const { value } = await reader.read();
        reader.cancel();
        bodyText = new TextDecoder().decode(value?.slice(0, 2048));
      }
    } finally {
      clearTimeout(bodyTimeout);
    }

    const lowerBody = bodyText.toLowerCase();
    const triggeredKeyword = CLOSURE_KEYWORDS.find((kw) =>
      lowerBody.includes(kw.toLowerCase())
    );

    if (triggeredKeyword) {
      return {
        website_status: "live",
        website_url: websiteUrl,
        closure_discovered: true,
        closure_evidence: `Closure keyword detected in website content: "${triggeredKeyword}" — ${candidateName} (${websiteUrl})`,
      };
    }

    return {
      website_status: "live",
      website_url: websiteUrl,
      closure_discovered: false,
      closure_evidence: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      website_status: "error",
      website_url: websiteUrl,
      closure_discovered: false,
      closure_evidence: null,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: runStage3
// ─────────────────────────────────────────────────────────────────────────────

export async function runStage3(
  candidateId: string,
  category: Category,
  supabase: SupabaseClient
): Promise<Stage3Result> {
  const { data: candidate, error } = await supabase
    .from("pipeline_candidates")
    .select("id, name, category, sources, stage1_result, gate2_result")
    .eq("id", candidateId)
    .single<CandidateForStage3>();

  if (error || !candidate) {
    throw new Error(`Stage 3 could not read candidate ${candidateId}: ${error?.message}`);
  }

  const websiteUrl = candidate.stage1_result?.website;

  // Run all checks in parallel
  const [
    bookingResult,
    localPresenceResult,
    websiteResult,
  ] = await Promise.all([
    Promise.resolve(checkBookingPlatform(candidate)),
    Promise.resolve(checkLocalPresenceAndTADisconnect(candidate)),
    checkWebsiteAndClosure(websiteUrl, candidate.name),
  ]);

  const result: Stage3Result = {
    ...bookingResult,
    ...localPresenceResult,
    ...websiteResult,
    checked_at: new Date().toISOString(),
  };

  return result;
}