/**
 * pipeline.ts
 *
 * Shared TypeScript contract for the generation pipeline → curator interface data shape.
 *
 * USAGE
 * Both the generation pipeline and the curator workflow interface import from this file.
 * It is the single source of truth for the shape of the `raw_pipeline_data` jsonb column
 * on the `entries` table. Any change to this file requires a coordinated update to both
 * consumers and a pipeline_version increment.
 *
 * LOCATION
 * /types/pipeline.ts  (monorepo root — imported by both pipeline and curator packages)
 *
 * VERSIONING
 * Increment PIPELINE_VERSION whenever the shape changes in a breaking way.
 * Every record written to the database stores this version; use it to identify
 * entries that need re-evaluation when the scoring logic changes.
 *
 * References: curation-filter-algorithm-v6, prd-curator-workflow-platform,
 * project-guide-v3 (Phase 0 schema decisions)
 */

export const PIPELINE_VERSION = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Primitive / shared types
// ─────────────────────────────────────────────────────────────────────────────

/** ISO 8601 datetime string */
export type ISODateTimeString = string;

/** ISO 8601 date string (date only) */
export type ISODateString = string;

export type Category =
  | "restaurant"
  | "cafe"
  | "accommodation"
  | "tour"
  | "sight"
  | "nightlife";

export type Season = "spring" | "summer" | "autumn" | "winter";

/** 1–5 seasonal appropriateness score. 1 = not recommended / not operational. */
export type SeasonalScore = 1 | 2 | 3 | 4 | 5;

export type OperationalStatus =
  | "verified_open"        // Passed 3+ Gate 0 signals
  | "likely_open"          // Passed exactly 2 signals — flagged for curator Queue 1
  | "status_unknown"       // Passed 0–1 signals — rejected from pipeline
  | "confirmed_closed";    // Permanently removed

export type Gate1Verdict = "pass" | "reject" | "borderline";

/** Booking tier as classified during Gate 2 */
export type BookingTier = 1 | 2 | 3 | 4;

export type TouristTrapCriterion =
  | "location_dependency"
  | "price_inflation"
  | "review_bifurcation"
  | "local_absence"
  | "menu_red_flags"
  | "homogenized_experience"
  | "manufactured_authenticity"
  | "platform_local_disconnect";

/** Category-agnostic entry tags */
export type EntryTag =
  | "authentic"
  | "new"           // Open fewer than 18 months
  | "skip_it"       // Anti-recommendation
  | "soul_exception"
  | "small_bite"    // Cafe that serves real food -- eligible for light lunch slot
  // Sights tags
  | "essential"
  | "deeper_cut"
  | "hidden_gem"
  | "local_niche"
  // Accommodation tags
  | "boutique"
  | "great_value"
  | "unique_stay"
  // Vibe / best-for tags (open set — stored as strings, validated at write time)
  | string;

// ─────────────────────────────────────────────────────────────────────────────
// Source data — what was collected in Stage 1
// ─────────────────────────────────────────────────────────────────────────────

export interface CandidateSource {
  /** Which data source surfaced this candidate */
  source: "google_maps" | "booking_com" | "viator" | "getyourguide" | "foursquare" | "curator_nomination";
  /** Raw place/listing ID from the source system */
  source_id: string;
  /** URL to the listing on the source platform */
  source_url: string | null;
  /** Whether this candidate was the primary source or a secondary match */
  is_primary: boolean;
}

export interface RawReview {
  source: "google_maps" | "tripadvisor" | "booking_com" | "viator" | "getyourguide" | "local_platform";
  author_name: string | null;
  /** ISO date of the review */
  review_date: ISODateString;
  rating: number | null; // Source-native scale — normalise before scoring
  text: string;
  /** Original language of the review text (ISO 639-1) */
  language: string;
  /** English translation, populated if language !== 'en' */
  text_english: string | null;
  /** True if the reviewer has Google Local Guide status */
  is_local_guide: boolean;
}

export interface EditorialMention {
  source_name: string; // e.g. "Lonely Planet", "Le Monde", "Gazeta Wyborcza"
  source_tier: 1 | 2 | 3 | 4; // Mirrors trust tier in algorithm
  url: string | null;
  excerpt: string | null;
  mention_date: ISODateString | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gate 0 — Operational Verification
// ─────────────────────────────────────────────────────────────────────────────

export interface Gate0Signal {
  signal:
    | "google_maps_status"
    | "geographic_verification"
    | "booking_platform_status"
    | "recent_review_activity"
    | "website_social_activity"
    | "phone_contact_verification"; // Phase 2
  passed: boolean;
  /** Human-readable explanation of how this signal was evaluated */
  detail: string;
  checked_at: ISODateTimeString;
}

export interface Gate0Result {
  status: OperationalStatus;
  signals: Gate0Signal[];
  /** Count of signals that passed (threshold: 3 of 6 = verified_open) */
  signals_passed: number;
  /**
   * True if Google Maps status signal failed (auto-reject trigger unless
   * overridden by 4+ other signals).
   */
  google_maps_failed: boolean;
  /**
   * If the entry was triaged as low-quality before full Gate 0
   * (very low rating + very low review count), this is true.
   * Minimal check was run; entry will likely fail Gate 2 regardless.
   */
  pre_filter_triage: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gate 1 — Tourist Trap Detection
// ─────────────────────────────────────────────────────────────────────────────

export interface Gate1CriterionAssessment {
  criterion: TouristTrapCriterion;
  triggered: boolean;
  /** The specific evidence that triggered (or did not trigger) this criterion */
  evidence: string;
}

export interface Gate1Result {
  result: Gate1Verdict;
  criteria: Gate1CriterionAssessment[];
  /** Number of criteria triggered (2+ = reject, 1 = borderline) */
  criteria_triggered: number;
  /**
   * Claude batch ID — allows tracing which batch this candidate was
   * evaluated in. Useful for debugging prompt-level issues.
   */
  claude_batch_id: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gate 2 — Quality Scoring
// ─────────────────────────────────────────────────────────────────────────────

export interface Gate2ScoreComponent {
  criterion:
    | "review_consensus"
    | "consistency"
    | "specificity_of_praise"
    | "editorial_signals"
    | "local_credibility"
    | "recency"
    | "uniqueness"
    // Category-specific overrides (same field names, different weights)
    | "food_quality_signals"           // restaurants
    | "atmosphere_and_experience"      // restaurants
    | "character_and_design"           // accommodations
    | "value_alignment"                // accommodations
    | "tour_quality"                   // tours
    | "guide_quality"                  // tours
    | "intrinsic_experience_quality"   // sights
    | "crowd_to_reward_ratio"          // sights
    | "curation_value_add"             // sights
    | "practical_visitability"         // sights
    | "venue_and_atmosphere"           // nightlife
    | "crowd_and_culture"              // nightlife
    | string;                          // future extensibility
  /** Points awarded for this criterion */
  score: number;
  /** Maximum points possible for this criterion in this category */
  max_score: number;
  /** Claude's reasoning for the score assigned */
  rationale: string;
}

export interface Gate2Result {
  /** Total quality score 0–100 */
  total_score: number;
  /** Score breakdown by criterion */
  components: Gate2ScoreComponent[];
  /** True if total_score >= 65 (pass threshold) */
  passed: boolean;
  /**
   * True if total_score is 55–64 AND Claude detected soul exception signals
   * (highly emotional language, "one of a kind", etc.)
   */
  soul_exception_flagged: boolean;
  /** Claude's drafted justification sentence if soul_exception_flagged */
  soul_exception_justification: string | null;
  claude_batch_id: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 3 — Supplementary Verification
// ─────────────────────────────────────────────────────────────────────────────

export interface Stage3Result {
  /** Active listing found on booking affiliate partner (Booking.com, Viator, GYG) */
  booking_platform_active: boolean | null;
  booking_platform_url: string | null;
  /**
   * Whether TripAdvisor rank is high but local-language platform presence is absent.
   * Positive = tourist trap signal, surfaced to curator.
   */
  tripadvisor_disconnect_detected: boolean;
  tripadvisor_rank: number | null;
  /** True if a local-language review platform (TheFork, Zomato local, etc.) has entries */
  local_platform_present: boolean;
  local_platform_name: string | null;
  local_platform_url: string | null;
  /** Result of fetching the venue's own website (null if no website) */
  website_status: "live" | "404" | "error" | null;
  website_url: string | null;
  /**
   * If a Stage 3 check discovers the venue is closed, this overrides
   * the Gate 0 status regardless of gate scores.
   */
  closure_discovered: boolean;
  closure_evidence: string | null;
  checked_at: ISODateTimeString;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 4 — Editorial Generation
// ─────────────────────────────────────────────────────────────────────────────

export interface EditorialContent {
  /**
   * One or two sentence insider tip. Practical, specific, not generic.
   * Flagged for human approval.
   */
  insider_tip: string;
  /**
   * The specific dish or drink to order. Only populated when a clear
   * consensus standout exists in reviews. Null otherwise.
   * Flagged for human approval.
   */
  what_to_order: string | null;
  /**
   * The specific review excerpts that generated the what_to_order suggestion.
   * Shown to curator so they can verify the source.
   */
  what_to_order_source_excerpts: string[];
  /**
   * One-sentence editorial justification for inclusion.
   * Flagged for human approval.
   */
  why_it_made_the_cut: string;
  /**
   * Article topic suggestions generated during this entry's editorial pass.
   * Aggregated across all entries at city generation completion.
   */
  article_topic_suggestions: string[];
}

export interface SeasonalScores {
  spring: SeasonalScore;
  summer: SeasonalScore;
  autumn: SeasonalScore;
  winter: SeasonalScore;
}

// ─────────────────────────────────────────────────────────────────────────────
// Closure pattern — feeds directly to itinerary builder
// ─────────────────────────────────────────────────────────────────────────────

export interface ClosurePattern {
  /** Days of week when the entry is fully closed (0 = Sunday, 6 = Saturday) */
  closed_days: number[];
  /** Days of week when the kitchen/service closes early */
  reduced_hours_days: number[];
  /** Human-readable note, e.g. "Kitchen closes 14:00 on Sundays" */
  reduced_hours_note: string | null;
  /** True if weekend-only or weekday-only operation */
  weekend_only: boolean;
  weekday_only: boolean;
  /** Any known seasonal full-closure periods */
  seasonal_closure_note: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidate aggregate data — sourced from Stage 1
// ─────────────────────────────────────────────────────────────────────────────

export interface AggregateRatings {
  google_maps_rating: number | null;
  google_maps_review_count: number | null;
  booking_com_rating: number | null;   // null if not applicable
  tripadvisor_rating: number | null;
  tripadvisor_review_count: number | null;
  /** Weighted composite across all platforms, 0–5 scale */
  composite_rating: number;
  composite_review_count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Root type
// ─────────────────────────────────────────────────────────────────────────────

export interface RawPipelineData {
  /** Must match PIPELINE_VERSION constant. Used to identify stale records after algorithm updates. */
  pipeline_version: number;

  /** ISO datetime when this pipeline run completed for this candidate */
  generated_at: ISODateTimeString;

  /** The category this entry was evaluated as */
  category: Category;

  // ── Stage 1: Source data ──────────────────────────────────────────────────

  /** All data sources that contributed to this candidate */
  sources: CandidateSource[];

  /** Aggregate rating data pulled from all platforms in Stage 1 */
  aggregate_ratings: AggregateRatings;

  /**
   * The 5 most recent reviews across all platforms, in original language.
   * Used for inline display in the curator interface right panel.
   * Stored in reverse-chronological order.
   */
  recent_reviews: RawReview[];

  /** All editorial mentions found across trust tiers 1–4 */
  editorial_mentions: EditorialMention[];

  // ── Stage 2a: Gate 0 ─────────────────────────────────────────────────────

  gate0: Gate0Result;

  // ── Stage 2b: Gate 1 ─────────────────────────────────────────────────────

  /**
   * Null if the candidate was rejected at Gate 0 and never entered Gate 1,
   * or if pre_filter_triage = true and Gate 1 was skipped.
   */
  gate1: Gate1Result | null;

  // ── Stage 2c: Gate 2 ─────────────────────────────────────────────────────

  /**
   * Null if the candidate failed Gate 0 or Gate 1.
   */
  gate2: Gate2Result | null;

  // ── Stage 3: Supplementary Verification ──────────────────────────────────

  /**
   * Null if the candidate did not pass Gates 0–2 and Stage 3 was not run.
   */
  stage3: Stage3Result | null;

  // ── Stage 4: Editorial Generation ────────────────────────────────────────

  /**
   * Null if the candidate did not pass all prior stages.
   * Populated for all candidates that passed Gates 0–2.
   */
  editorial: EditorialContent | null;

  /** Seasonal appropriateness scores, generated in Stage 4 */
  seasonal_scores: SeasonalScores | null;

  // ── Curator-facing metadata ───────────────────────────────────────────────

  /**
   * Tags pre-populated by the pipeline for curator review.
   * Curator can adjust these in the check interface.
   */
  suggested_tags: EntryTag[];

  /** Booking tier classification, assigned during Gate 2 */
  booking_tier: BookingTier | null;

  /** Closure pattern, used by itinerary builder to avoid scheduling conflicts */
  closure_pattern: ClosurePattern | null;

  /**
   * True if the entry was opened fewer than 18 months ago.
   * Drives the "New" tag and prevents "Essential" classification
   * until after first re-evaluation cycle.
   */
  is_new_entry: boolean;

  // ── Pipeline run metadata ─────────────────────────────────────────────────

  /**
   * True if this record was created by a curator nomination
   * rather than automated candidate discovery.
   */
  is_curator_nomination: boolean;

  /**
   * If this is a curator nomination, the city and category the nominator
   * specified. Same gates apply — nominations are not manually approved.
   */
  nomination_note: string | null;

  /**
   * Retry count for this candidate. Max 3 retries with exponential backoff.
   * A candidate that hits 3 failures is logged and not retried further.
   */
  retry_count: number;

  /**
   * If the candidate failed pipeline processing, the stage and error message.
   */
  failure_stage: "stage1" | "gate0" | "gate1" | "gate2" | "stage3" | "stage4" | null;
  failure_reason: string | null;
}