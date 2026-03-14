/**
 * index.ts — Pipeline orchestrator
 *
 * Entry points:
 *   runPipeline(cityId, category)  — full pipeline run for one city + category
 *   processCandidate(candidateId)  — processes one candidate through all gates
 *
 * Execution flow:
 *   Stage 1 (candidate discovery) → written to pipeline_candidates
 *   For each candidate: processCandidate()
 *     Stage 2a: Gate 0 — operational verification
 *     Stage 2b: Gate 1 — tourist trap detection (Claude)
 *     Stage 2c: Gate 2 — quality scoring (Claude)
 *     Stage 3:  supplementary verification
 *     Stage 4:  editorial generation (Claude)
 *   Promote passing candidates → entries table
 *   Return PipelineRunSummary
 *
 * Phase 4 migration note:
 *   processCandidate() signature is job-queue-compatible. Migration = register
 *   as a handler instead of calling directly. No rewrite required.
 */

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  PIPELINE_VERSION,
  type Category,
  type RawPipelineData,
} from "@/types/pipeline";

import { withRetry, sleep, type CityContext } from "./utils";

// Stage imports — each is a stub returning the correct shape until implemented
import { runStage1 } from "./stage1";
import { runGate0 } from "./gate0";
import { runGate1 } from "./gate1";
import { runGate2 } from "./gate2";
import { runStage3 } from "./stage3";
import { runStage4 } from "./stage4";
import { resetGate1Accumulator, flushGate1Batch } from "./gate1";
import { resetGate2Accumulator, flushGate2Batch } from "./gate2";
import { generateArticlesForCity } from "./generate-articles";

// ─────────────────────────────────────────────────────────────────────────────
// Supabase service role client (pipeline writes bypass RLS)
// ─────────────────────────────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineRunSummary {
  run_id: string;
  city_id: string;
  category: Category;
  pipeline_version: number;
  started_at: string;
  completed_at: string;
  runtime_seconds: number;
  // Stage 1
  candidates_discovered: number;
  candidates_deduplicated: number;
  // Pre-triage tracking [v1.1]
  candidates_pretriage_rejected: number;
  candidates_early_trap_rejected: number;
  candidates_entering_gate0: number;
  viator_enrichment_lookups: number;
  // Gate results
  gate0_verified_open: number;
  gate0_likely_open: number;
  gate0_rejected: number;
  gate0_pre_filter_triage: number;
  gate1_passed: number;
  gate1_borderline: number;
  gate1_rejected: number;
  gate1_entered: number;
  gate2_entered: number;
  gate2_passed: number;
  gate2_soul_exceptions: number;
  gate2_rejected: number;
  // Stage 3
  stage3_closure_discovered: number;
  stage3_tripadvisor_disconnect: number;
  // Final
  entries_promoted: number;
  entries_queued_q1: number;
  entries_queued_q2: number;
  entries_queued_q3: number;
  // Editorial tier tracking [v1.1]
  editorial_full: number;
  editorial_minimal: number;
  seasonal_scores_rule_computed: number;
  seasonal_scores_claude_computed: number;
  // Failures
  candidates_failed: number;
  candidates_pending_retry: number;
  // Cost estimates
  estimated_api_cost_usd: number;
  estimated_claude_cost_usd: number;
  estimated_savings_usd: number;
}

export interface PipelineRunAllSummary {
  city_id: string;
  pipeline_version: number;
  started_at: string;
  completed_at: string;
  runtime_seconds: number;
  categories: PipelineRunSummary[];
  totals: Omit<RunStats, never>;
}

const ALL_CATEGORIES: Category[] = [
  "restaurant",
  "cafe",
  "nightlife",
  "sight",
  "accommodation",
  "tour",
];

/**
 * Estimate API costs from run stats.
 * Per-candidate cost estimates (Claude Sonnet 4):
 *   Gate 1: ~2k input + ~500 output tokens ≈ $0.012 per candidate
 *   Gate 2: ~3k input + ~800 output tokens ≈ $0.020 per candidate
 *   Stage 4 full: ~4k input + ~2k output tokens ≈ $0.036 per candidate
 *   Stage 4 minimal: ~3k input + ~1k output tokens ≈ $0.021 per candidate
 * Google Maps API: ~$0.032 per Text Search + $0.017 per Place Details
 * Apify: ~$0.05 per review scrape run
 * "Savings" = cost of running Gate 2 + Stage 4 on candidates rejected before those stages.
 */
function calculateEstimatedCosts(stats: RunStats): {
  total: number;
  claude: number;
  savings: number;
} {
  const GATE1_COST = 0.012;
  const GATE2_COST = 0.020;
  const STAGE4_FULL_COST = 0.036;
  const STAGE4_MINIMAL_COST = 0.021;
  const GMAPS_TEXT_SEARCH_COST = 0.032;
  const GMAPS_PLACE_DETAILS_COST = 0.017;
  const APIFY_COST = 0.05;
  const VIATOR_ENRICHMENT_LOOKUP_COST = 0.005; // $0.005 per Text Search call for coordinate enrichment

  const gate1Candidates = stats.gate1_entered ??
    (stats.gate1_passed + stats.gate1_borderline + stats.gate1_rejected);
  const gate2Candidates = stats.gate2_entered ??
    (stats.gate2_passed + stats.gate2_soul_exceptions + stats.gate2_rejected);
  const apifyCandidates = gate2Candidates; // Apify runs post-Gate 1 for candidates entering Gate 2
  const viatorEnrichmentCost = (stats.viator_enrichment_lookups ?? 0) * VIATOR_ENRICHMENT_LOOKUP_COST;

  const claudeCost =
    gate1Candidates * GATE1_COST +
    gate2Candidates * GATE2_COST +
    stats.editorial_full * STAGE4_FULL_COST +
    stats.editorial_minimal * STAGE4_MINIMAL_COST;

  const apiCost =
    claudeCost +
    stats.candidates_entering_gate0 * GMAPS_PLACE_DETAILS_COST +
    stats.candidates_discovered * GMAPS_TEXT_SEARCH_COST * 0.1 + // amortized across ~10 results per query
    apifyCandidates * APIFY_COST +
    viatorEnrichmentCost;

  // Savings: candidates rejected at Gate 0 or Gate 1 that didn't consume Gate 2 + Stage 4 tokens
  const rejectedBeforeGate2 = stats.gate0_rejected + stats.gate1_rejected;
  const savings = rejectedBeforeGate2 * (GATE2_COST + STAGE4_FULL_COST);

  return {
    total: Math.round(apiCost * 1000) / 1000,
    claude: Math.round(claudeCost * 1000) / 1000,
    savings: Math.round(savings * 1000) / 1000,
  };
}

/** Internal accumulator — mutated as the run progresses, returned at the end. */
type RunStats = Omit<
  PipelineRunSummary,
  "run_id" | "city_id" | "category" | "pipeline_version" | "started_at" | "completed_at" | "runtime_seconds"
>;

function initialStats(): RunStats {
  return {
    candidates_discovered: 0,
    candidates_deduplicated: 0,
    candidates_pretriage_rejected: 0,
    candidates_early_trap_rejected: 0,
    candidates_entering_gate0: 0,
    viator_enrichment_lookups: 0,
    gate0_verified_open: 0,
    gate0_likely_open: 0,
    gate0_rejected: 0,
    gate0_pre_filter_triage: 0,
    gate1_passed: 0,
    gate1_borderline: 0,
    gate1_rejected: 0,
    gate1_entered: 0,
    gate2_entered: 0,
    gate2_passed: 0,
    gate2_soul_exceptions: 0,
    gate2_rejected: 0,
    stage3_closure_discovered: 0,
    stage3_tripadvisor_disconnect: 0,
    entries_promoted: 0,
    entries_queued_q1: 0,
    entries_queued_q2: 0,
    entries_queued_q3: 0,
    editorial_full: 0,
    editorial_minimal: 0,
    seasonal_scores_rule_computed: 0,
    seasonal_scores_claude_computed: 0,
    candidates_failed: 0,
    candidates_pending_retry: 0,
    estimated_api_cost_usd: 0,
    estimated_claude_cost_usd: 0,
    estimated_savings_usd: 0,
  };
}

/** Result shape returned by processCandidate — always resolves, never throws. */
export interface CandidateResult {
  candidateId: string;
  status: "passed" | "rejected" | "failed";
  /** The gate or stage where processing stopped (null if passed all stages). */
  stoppedAt: "gate0" | "gate1" | "gate2" | "stage3" | "stage4" | null;
  /** The assembled RawPipelineData if the candidate passed all gates. */
  pipelineData: RawPipelineData | null;
  /** True if this candidate was promoted to the entries table. */
  promoted: boolean;
  promotedEntryId: string | null;
  /** Editorial tier if Stage 4 ran: 'full' (72+) or 'minimal' (65-71). */
  editorialTier: "full" | "minimal" | null;
  /** True if seasonal scores were rule-computed (not Claude). */
  seasonalScoresRuleComputed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod schema for RawPipelineData runtime validation
// ─────────────────────────────────────────────────────────────────────────────
// Minimal schema — validates the top-level required fields.
// Add deeper field validation incrementally as stages are implemented.

const RawPipelineDataSchema = z.object({
  pipeline_version: z.number(),
  generated_at: z.string(),
  category: z.enum(["restaurant", "cafe", "accommodation", "tour", "sight", "nightlife"]),
  sources: z.array(z.object({
    source: z.string(),
    source_id: z.string(),
    source_url: z.string().nullable().optional(),
    is_primary: z.boolean(),
  })),
  aggregate_ratings: z.object({
    google_maps_rating: z.number().nullable(),
    google_maps_review_count: z.number().nullable(),
    booking_com_rating: z.number().nullable(),
    tripadvisor_rating: z.number().nullable(),
    tripadvisor_review_count: z.number().nullable(),
    composite_rating: z.number(),
    composite_review_count: z.number(),
  }),
  recent_reviews: z.array(z.object({
    source: z.string(),
    author_name: z.string().nullable(),
    review_date: z.string(),
    rating: z.number().nullable(),
    text: z.string(),
    language: z.string(),
    text_english: z.string().nullable(),
    is_local_guide: z.boolean(),
  })),
  editorial_mentions: z.array(z.object({
    source_name: z.string(),
    source_tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    url: z.string().nullable(),
    excerpt: z.string().nullable(),
    mention_date: z.string().nullable(),
  })),
  gate0: z.object({
    status: z.enum(["verified_open", "likely_open", "status_unknown", "confirmed_closed"]),
    signals: z.array(z.object({
      signal: z.string(),
      passed: z.boolean(),
      detail: z.string(),
      checked_at: z.string(),
    })),
    signals_passed: z.number(),
    google_maps_failed: z.boolean(),
    pre_filter_triage: z.boolean(),
  }),
  gate1: z.object({
    result: z.enum(["pass", "reject", "borderline"]),
    criteria: z.array(z.object({
      criterion: z.string(),
      triggered: z.boolean(),
      evidence: z.string(),
    })),
    criteria_triggered: z.number(),
    claude_batch_id: z.string(),
  }).nullable(),
  gate2: z.object({
    total_score: z.number(),
    components: z.array(z.object({
      criterion: z.string(),
      score: z.number(),
      max_score: z.number(),
      rationale: z.string(),
    })),
    passed: z.boolean(),
    soul_exception_flagged: z.boolean(),
    soul_exception_justification: z.string().nullable(),
    claude_batch_id: z.string(),
  }).nullable(),
  stage3: z.object({
    booking_platform_active: z.boolean().nullable(),
    booking_platform_url: z.string().nullable(),
    tripadvisor_disconnect_detected: z.boolean(),
    tripadvisor_rank: z.number().nullable(),
    local_platform_present: z.boolean(),
    local_platform_name: z.string().nullable(),
    local_platform_url: z.string().nullable(),
    website_status: z.enum(["live", "404", "error"]).nullable(),
    website_url: z.string().nullable(),
    closure_discovered: z.boolean(),
    closure_evidence: z.string().nullable(),
    checked_at: z.string(),
  }).nullable(),
  editorial: z.object({
    insider_tip: z.string(),
    what_to_order: z.string().nullable(),
    what_to_order_source_excerpts: z.array(z.string()),
    why_it_made_the_cut: z.string(),
    article_topic_suggestions: z.array(z.string()),
  }).nullable(),
  seasonal_scores: z.object({
    spring: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    summer: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    autumn: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    winter: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  }).nullable(),
  suggested_tags: z.array(z.string()),
  booking_tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable(),
  closure_pattern: z.object({
    closed_days: z.array(z.number()),
    reduced_hours_days: z.array(z.number()),
    reduced_hours_note: z.string().nullable(),
    weekend_only: z.boolean(),
    weekday_only: z.boolean(),
    seasonal_closure_note: z.string().nullable(),
  }).nullable(),
  is_new_entry: z.boolean(),
  is_curator_nomination: z.boolean(),
  nomination_note: z.string().nullable(),
  retry_count: z.number(),
  failure_stage: z.enum(["stage1", "gate0", "gate1", "gate2", "stage3", "stage4"]).nullable(),
  failure_reason: z.string().nullable(),
});

/**
 * Validates a completed pipeline data object before writing to the database.
 * Throws PipelineValidationError if the shape is invalid.
 * A pipeline that silently writes malformed data breaks the curator interface.
 */
function validatePipelineData(data: unknown): RawPipelineData {
  const result = RawPipelineDataSchema.safeParse(data);
  if (!result.success) {
    console.error("[validatePipelineData] Schema validation failed:", result.error.format());
    throw new Error(`Pipeline data failed schema validation: ${result.error.message}`);
  }
  return result.data as RawPipelineData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue assignment
// ─────────────────────────────────────────────────────────────────────────────

type ReviewQueue = "check_q1" | "check_q2" | "check_q3";

function assignReviewQueue(pipelineData: RawPipelineData): ReviewQueue {
  // Q1: anything that needs closer human scrutiny
  if (pipelineData.gate0.status === "likely_open") return "check_q1";
  if (pipelineData.gate1?.result === "borderline") return "check_q1";
  if (pipelineData.gate2?.soul_exception_flagged) return "check_q1";
  if (pipelineData.stage3?.tripadvisor_disconnect_detected) return "check_q1";

  // Q3: clean gates but thin review signal
  if (pipelineData.aggregate_ratings.composite_review_count < 30) return "check_q3";

  // Q2: clean gates, sufficient signal
  return "check_q2";
}

// ─────────────────────────────────────────────────────────────────────────────
// Recheck tier assignment
// ─────────────────────────────────────────────────────────────────────────────

function assignRecheckTier(
  category: Category,
  isNewEntry: boolean,
  gate0Status: string
): 1 | 2 | 3 {
  if (category === "restaurant" || category === "cafe" || category === "nightlife") return 1;
  if (isNewEntry) return 1;
  if (gate0Status === "likely_open") return 1;
  // accommodation, tour, sight all start at Tier 2
  // sights are promoted to Tier 3 after 3 clean recheck cycles (handled by recheck runner)
  return 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidate promotion — pipeline_candidates → entries
// ─────────────────────────────────────────────────────────────────────────────

async function promoteCandidate(
  candidateId: string,
  pipelineData: RawPipelineData,
  cityId: string,
  editorialTier: "full" | "minimal"
): Promise<string> {
  const supabase = getServiceClient();

  // Read the full candidate record so we have name, address, coords
  const { data: candidate, error: readError } = await supabase
    .from("pipeline_candidates")
    .select("id, name, address, lat, lng, google_place_id, category, city_id")
    .eq("id", candidateId)
    .single();

  if (readError || !candidate) {
    throw new Error(
      `Failed to read pipeline_candidates record for promotion: ${readError?.message}`
    );
  }

  const queue = assignReviewQueue(pipelineData);
  const recheckTier = assignRecheckTier(
    pipelineData.category,
    pipelineData.is_new_entry,
    pipelineData.gate0.status
  );

  // Validate before write — this is the critical check
  const validatedData = validatePipelineData(pipelineData);

  // Write to entries table
  const { data: entry, error: insertError } = await supabase
    .from("entries")
    .insert({
      city_id: cityId,
      category: validatedData.category,
      name: candidate.name,
      address: candidate.address,
      lat: candidate.lat,
      lng: candidate.lng,
      google_place_id: candidate.google_place_id,
      review_status: "pending_review",
      review_queue: queue,
      operational_status: validatedData.gate0.status,
      raw_pipeline_data: validatedData,
      pipeline_version: PIPELINE_VERSION,
      recheck_tier: recheckTier,
      quality_score: validatedData.gate2?.total_score ?? null,
      booking_tier: validatedData.booking_tier,
      suggested_tags: validatedData.suggested_tags,
      editorial_tier: editorialTier,
      // Restaurant-specific fields (null for other categories)
      meal_eligibility: null,       // assigned by curator from stage4 data
      restaurant_sub_type: null,    // assigned by curator from stage4 data
    })
    .select("id")
    .single();

  if (insertError || !entry) {
    throw new Error(`Failed to insert entry: ${insertError?.message}`);
  }

  // Write promoted_entry_id back to pipeline_candidates
  await supabase
    .from("pipeline_candidates")
    .update({ promoted_entry_id: entry.id })
    .eq("id", candidateId);

  console.log(
    `[promote] Candidate ${candidateId} promoted to entry ${entry.id} (queue: ${queue}, recheck: Tier ${recheckTier})`
  );

  return entry.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// processCandidate — runs one candidate through all gates
// Phase 4 migration-ready: compatible with job queue handler signature
// ─────────────────────────────────────────────────────────────────────────────

export async function processCandidate(
  candidateId: string,
  cityContext: CityContext,
  category: Category
): Promise<CandidateResult> {
  const supabase = getServiceClient();
  const log = (msg: string) => console.log(`[processCandidate:${candidateId}] ${msg}`);
  const logError = (msg: string, err?: unknown) =>
    console.error(`[processCandidate:${candidateId}] ${msg}`, err ?? "");

  // Mark as processing
  await supabase
    .from("pipeline_candidates")
    .update({ processing_status: "processing" })
    .eq("id", candidateId);

  // ── Stage 2a: Gate 0 — Operational Verification ───────────────────────────
  let gate0Result;
  try {
    log("Running Gate 0 (operational verification)");
    gate0Result = await runGate0(candidateId, supabase);

    // Write Gate 0 result immediately — even failed candidates get a record
    await supabase
      .from("pipeline_candidates")
      .update({ gate0_result: gate0Result })
      .eq("id", candidateId);

    // Hard stop: status_unknown or confirmed_closed — do not consume Claude tokens
    if (
      gate0Result.status === "status_unknown" ||
      gate0Result.status === "confirmed_closed"
    ) {
      log(`Gate 0 rejected (${gate0Result.status}) — stopping`);
      await supabase
        .from("pipeline_candidates")
        .update({
          processing_status: "rejected",
          failure_stage: "gate0",
          failure_reason: `Gate 0 rejected: status=${gate0Result.status}`,
        })
        .eq("id", candidateId);

      return {
        candidateId,
        status: "rejected",
        stoppedAt: "gate0",
        pipelineData: null,
        promoted: false,
        promotedEntryId: null,
        editorialTier: null,
        seasonalScoresRuleComputed: false,
      };
    }
  } catch (err) {
    logError("Gate 0 threw unexpectedly", err);
    return handleCandidateFailure(candidateId, "gate0", err, supabase);
  }

  // ── Stage 2b: Gate 1 — Tourist Trap Detection (Claude) ────────────────────
  log(`Gate 0 complete (${gate0Result.status}), transitioning to Gate 1`);
  let gate1Result;
  try {
    log("Running Gate 1 (tourist trap detection)");
    gate1Result = await runGate1(candidateId, cityContext, category, supabase);
    log("Gate 1 call returned, processing result");

    await supabase
      .from("pipeline_candidates")
      .update({ gate1_result: gate1Result })
      .eq("id", candidateId);

    if (gate1Result.result === "reject") {
      const triggeredNames = (gate1Result.criteria ?? [])
        .filter((c: { triggered: boolean }) => c.triggered)
        .map((c: { criterion: string }) => c.criterion)
        .join(", ");
      log(`Gate 1 rejected (${gate1Result.criteria_triggered} criteria triggered) — stopping`);
      await supabase
        .from("pipeline_candidates")
        .update({
          processing_status: "rejected",
          failure_stage: "gate1",
          failure_reason: `Gate 1 rejected: ${gate1Result.criteria_triggered} criteria triggered (${triggeredNames || "see gate1_result"})`,
        })
        .eq("id", candidateId);

      return {
        candidateId,
        status: "rejected",
        stoppedAt: "gate1",
        pipelineData: null,
        promoted: false,
        promotedEntryId: null,
        editorialTier: null,
        seasonalScoresRuleComputed: false,
      };
    }

    log(`Gate 1: ${gate1Result.result} (${gate1Result.criteria_triggered} criteria triggered)`);
  } catch (err) {
    logError("Gate 1 threw unexpectedly", err);
    return handleCandidateFailure(candidateId, "gate1", err, supabase);
  }

  // ── Post-Gate 1: Apify review enrichment ─────────────────────────────────
  // Only fetch expensive Apify reviews for candidates that survived Gate 1.
  // Non-blocking: Gate 2 always runs regardless of Apify success/failure.
  try {
    const { data: candidateRow } = await supabase
      .from("pipeline_candidates")
      .select("google_place_id, stage1_result")
      .eq("id", candidateId)
      .single();

    const googlePlaceId = candidateRow?.google_place_id;

    if (googlePlaceId) {
      const { fetchApifyReviews } = await import("@/pipeline/stage1");
      const apifyReviews = await fetchApifyReviews(googlePlaceId);

      if (apifyReviews.length > 0) {
        const updatedStage1 = {
          ...(candidateRow.stage1_result as Record<string, unknown>),
          recent_reviews: apifyReviews,
          review_source: "apify",
          review_count_fetched: apifyReviews.length,
        };

        await supabase
          .from("pipeline_candidates")
          .update({ stage1_result: updatedStage1 })
          .eq("id", candidateId);

        log(`Apify enrichment: ${apifyReviews.length} reviews`);
      } else {
        log("Apify enrichment: no reviews returned, keeping Google reviews");
      }
    }
  } catch (err) {
    console.warn(
      `[pipeline] Apify enrichment failed for ${candidateId} — proceeding to Gate 2 with existing reviews`,
      err
    );
  }

  // ── Stage 2c: Gate 2 — Quality Scoring (Claude) ───────────────────────────
  let gate2Result;
  try {
    log("Running Gate 2 (quality scoring)");
    gate2Result = await runGate2(candidateId, cityContext, category, gate1Result, supabase);

    await supabase
      .from("pipeline_candidates")
      .update({ gate2_result: gate2Result })
      .eq("id", candidateId);

    if (gate2Result.tourist_trap_confirmed) {
      log(`Gate 2 tourist trap confirmed: ${gate2Result.tourist_trap_reason} — stopping`);
      await supabase
        .from("pipeline_candidates")
        .update({
          processing_status: "rejected",
          failure_stage: "gate2",
          failure_reason: gate2Result.tourist_trap_reason,
        })
        .eq("id", candidateId);

      return {
        candidateId,
        status: "rejected",
        stoppedAt: "gate2",
        pipelineData: null,
        promoted: false,
        promotedEntryId: null,
        editorialTier: null,
        seasonalScoresRuleComputed: false,
      };
    }

    if (!gate2Result.passed && !gate2Result.soul_exception_flagged) {
      log(`Gate 2 rejected (score: ${gate2Result.total_score}) — stopping`);
      await supabase
        .from("pipeline_candidates")
        .update({
          processing_status: "rejected",
          failure_stage: "gate2",
          failure_reason: `Gate 2 rejected: score=${gate2Result.total_score} (threshold 65)`,
        })
        .eq("id", candidateId);

      return {
        candidateId,
        status: "rejected",
        stoppedAt: "gate2",
        pipelineData: null,
        promoted: false,
        promotedEntryId: null,
        editorialTier: null,
        seasonalScoresRuleComputed: false,
      };
    }

    log(
      `Gate 2: score ${gate2Result.total_score}${gate2Result.soul_exception_flagged ? " (soul exception)" : ""}`
    );
  } catch (err) {
    logError("Gate 2 threw unexpectedly", err);
    return handleCandidateFailure(candidateId, "gate2", err, supabase);
  }

  // ── Stage 3: Supplementary Verification ──────────────────────────────────
  let stage3Result;
  try {
    log("Running Stage 3 (supplementary verification)");
    stage3Result = await runStage3(candidateId, category, supabase);

    await supabase
      .from("pipeline_candidates")
      .update({ stage3_result: stage3Result })
      .eq("id", candidateId);

    // Closure discovered in Stage 3 overrides all gate results
    if (stage3Result.closure_discovered) {
      log(`Stage 3 closure discovered (${stage3Result.closure_evidence}) — stopping`);
      await supabase
        .from("pipeline_candidates")
        .update({
          processing_status: "rejected",
          failure_stage: "stage3",
          failure_reason: "Stage 3 rejected: closure discovered",
        })
        .eq("id", candidateId);

      return {
        candidateId,
        status: "rejected",
        stoppedAt: "stage3",
        pipelineData: null,
        promoted: false,
        promotedEntryId: null,
        editorialTier: null,
        seasonalScoresRuleComputed: false,
      };
    }
  } catch (err) {
    logError("Stage 3 threw unexpectedly", err);
    return handleCandidateFailure(candidateId, "stage3", err, supabase);
  }

  // ── Stage 4: Editorial Generation (Claude) ────────────────────────────────
  let stage4Result;
  let editorialTier: "full" | "minimal";
  let seasonalScoresRuleComputed: boolean;
  try {
    log(
      `Running Stage 4 (editorial generation, score: ${gate2Result.total_score})`
    );
    const result = await runStage4(
      candidateId,
      cityContext,
      category,
      gate2Result,
      supabase
    );
    stage4Result = result.stage4Result;
    editorialTier = result.editorialTier;
    seasonalScoresRuleComputed = result.seasonalScoresRuleComputed;

    await supabase
      .from("pipeline_candidates")
      .update({ stage4_result: stage4Result })
      .eq("id", candidateId);

    log(`Stage 4 complete (tier: ${editorialTier})`);
  } catch (err) {
    logError("Stage 4 threw unexpectedly", err);
    return handleCandidateFailure(candidateId, "stage4", err, supabase);
  }

  // ── All gates passed — assemble RawPipelineData ──────────────────────────
  // Read candidate record to get Stage 1 source data
  const { data: candidateRow } = await supabase
    .from("pipeline_candidates")
    .select("sources, gate0_result, gate1_result, gate2_result, stage3_result, stage4_result, is_curator_nomination, nomination_note, retry_count")
    .eq("id", candidateId)
    .single();

  if (!candidateRow) {
    logError("Could not read candidate record for final assembly");
    return handleCandidateFailure(
      candidateId,
      "stage4",
      new Error("Missing candidate record on final assembly"),
      supabase
    );
  }

  const pipelineData: RawPipelineData = {
    pipeline_version: PIPELINE_VERSION,
    generated_at: new Date().toISOString(),
    category,
    sources: candidateRow.sources ?? [],
    aggregate_ratings: stage4Result.aggregate_ratings,
    recent_reviews: stage4Result.recent_reviews,
    editorial_mentions: stage4Result.editorial_mentions,
    gate0: gate0Result,
    gate1: gate1Result,
    gate2: gate2Result,
    stage3: stage3Result,
    editorial: stage4Result.editorial,
    seasonal_scores: stage4Result.seasonal_scores,
    suggested_tags: stage4Result.suggested_tags,
    booking_tier: gate2Result.booking_tier ?? null,
    closure_pattern: stage4Result.closure_pattern,
    is_new_entry: stage4Result.is_new_entry,
    is_curator_nomination: candidateRow.is_curator_nomination ?? false,
    nomination_note: candidateRow.nomination_note ?? null,
    retry_count: candidateRow.retry_count ?? 0,
    failure_stage: null,
    failure_reason: null,
  };

  // Validate shape before any write
  let validatedData: RawPipelineData;
  try {
    validatedData = validatePipelineData(pipelineData);
  } catch (err) {
    logError("Schema validation failed on final assembly", err);
    return handleCandidateFailure(candidateId, "stage4", err, supabase);
  }

  // ── Promote to entries table ──────────────────────────────────────────────
  let promotedEntryId: string | null = null;
  try {
    promotedEntryId = await promoteCandidate(
      candidateId,
      validatedData,
      cityContext.id,
      editorialTier
    );

    await supabase
      .from("pipeline_candidates")
      .update({ processing_status: "passed" })
      .eq("id", candidateId);
  } catch (err) {
    logError("Promotion to entries table failed", err);
    return handleCandidateFailure(candidateId, "stage4", err, supabase);
  }

  log(`Passed all gates. Promoted to entry ${promotedEntryId}.`);

  return {
    candidateId,
    status: "passed",
    stoppedAt: null,
    pipelineData: validatedData,
    promoted: true,
    promotedEntryId,
    editorialTier,
    seasonalScoresRuleComputed,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Failure handler — always returns, never throws
// ─────────────────────────────────────────────────────────────────────────────

async function handleCandidateFailure(
  candidateId: string,
  stage: "gate0" | "gate1" | "gate2" | "stage3" | "stage4",
  err: unknown,
  supabase: ReturnType<typeof getServiceClient>
): Promise<CandidateResult> {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[failure] Candidate ${candidateId} failed at ${stage}: ${message}`);

  try {
    // Read current retry count
    const { data } = await supabase
      .from("pipeline_candidates")
      .select("retry_count")
      .eq("id", candidateId)
      .single();

    const retryCount = (data?.retry_count ?? 0) + 1;
    const isPermanentFailure = retryCount >= 3;

    await supabase
      .from("pipeline_candidates")
      .update({
        processing_status: "failed",
        failure_stage: stage,
        failure_reason: message,
        retry_count: retryCount,
      })
      .eq("id", candidateId);

    if (isPermanentFailure) {
      console.error(
        `[failure] Candidate ${candidateId} hit max retries (3). Permanent failure.`
      );
    } else {
      console.warn(
        `[failure] Candidate ${candidateId} retry ${retryCount}/3 — will be retried with backoff.`
      );
    }
  } catch (dbErr) {
    // If we can't even write the failure, log it and move on
    console.error(
      `[failure] Could not write failure record for candidate ${candidateId}:`,
      dbErr
    );
  }

  return {
    candidateId,
    status: "failed",
    stoppedAt: stage,
    pipelineData: null,
    promoted: false,
    promotedEntryId: null,
    editorialTier: null,
    seasonalScoresRuleComputed: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// runPipeline — main entry point
// ─────────────────────────────────────────────────────────────────────────────

// TEST MODE ONLY — never ship this to production.
// Caps the number of candidates entering Gate 0 for low-cost integration testing.
interface PipelineRunOptions {
  testMode?: boolean;
  maxCandidates?: number;
}

export async function runPipeline(
  cityId: string,
  category: Category,
  options: PipelineRunOptions = {}
): Promise<PipelineRunSummary> {
  console.log('[DEBUG] options received:', JSON.stringify(options));
  const { testMode = false, maxCandidates = 10 } = options;
  const supabase = getServiceClient();
  const startedAt = new Date();
  const runId = crypto.randomUUID();
  const stats = initialStats();

  console.log(`[runPipeline] Starting: city=${cityId}, category=${category}`);

  // ── Load city context ─────────────────────────────────────────────────────
const { data: city, error: cityError } = await supabase
  .from("cities")
  .select("id, display_name, country, city_context")  
  .eq("id", cityId)
  .single();

  if (cityError || !city) {
    throw new Error(`City not found: ${cityId} (${cityError?.message})`);
  }

  // city_context is a jsonb column containing top_tourist_landmarks and other
  // city-specific data needed by Stage 1 pre-triage and Gate 1
  const cityContext: CityContext = {
  id: city.id,
  name: city.display_name,    
  country: city.country,
  top_tourist_landmarks: city.city_context?.top_tourist_landmarks ?? [],
};

  // Reset any candidates stuck in 'processing' from an interrupted run
  await supabase
    .from("pipeline_candidates")
    .update({ processing_status: "queued" })
    .eq("city_id", cityId)
    .eq("category", category)
    .eq("processing_status", "processing");

  // ── Resume check: skip Stage 1 if candidates already exist ──────────────
  const { count: existingCount } = await supabase
    .from("pipeline_candidates")
    .select("*", { count: "exact", head: true })
    .eq("city_id", cityId)
    .eq("category", category)
    .neq("processing_status", "failed");

  let candidatesToProcess: string[];

  if (existingCount && existingCount > 0) {
    // ── Resume path: skip Stage 1, process queued candidates directly ─────
    console.log(
      `[runPipeline] Skipping Stage 1: ${existingCount} existing candidates found, resuming from queue`
    );

    const { data: queuedCandidates } = await supabase
      .from("pipeline_candidates")
      .select("id")
      .eq("city_id", cityId)
      .eq("category", category)
      .eq("processing_status", "queued");

    candidatesToProcess = (queuedCandidates ?? []).map((r) => r.id);
    console.log(
      `[resume] ${candidatesToProcess.length} queued candidates to process`
    );

    // Populate Stage 1 stats from existing DB records so cost estimation works on resume runs
    const { count: resumeDiscovered } = await supabase
      .from("pipeline_candidates")
      .select("*", { count: "exact", head: true })
      .eq("city_id", cityId)
      .eq("category", category)
      .neq("processing_status", "failed");

    const { count: resumeEnteredGate0 } = await supabase
      .from("pipeline_candidates")
      .select("*", { count: "exact", head: true })
      .eq("city_id", cityId)
      .eq("category", category)
      .not("gate0_result", "is", null);

    stats.candidates_discovered = resumeDiscovered ?? 0;
    stats.candidates_entering_gate0 = resumeEnteredGate0 ?? 0;
  } else {
    // ── Fresh run: execute Stage 1 candidate discovery ─────────────────────
    console.log(`[runPipeline] Stage 1: candidate discovery`);

    try {
      const stage1Result = await runStage1(cityId, category, supabase, { testMode, maxCandidates });
      candidatesToProcess = stage1Result.candidateIds;
      stats.candidates_discovered = stage1Result.discovered;
      stats.candidates_deduplicated = stage1Result.deduplicated;
      stats.candidates_pretriage_rejected = stage1Result.pretriageRejected;
      stats.candidates_early_trap_rejected = stage1Result.earlyTrapRejected;
      stats.candidates_entering_gate0 = stage1Result.enteringGate0;
      stats.viator_enrichment_lookups = stage1Result.viatorEnrichmentLookups ?? 0;

      console.log(
        `[runPipeline] Stage 1 complete: ${stage1Result.discovered} discovered, ` +
        `${stage1Result.enteringGate0} entering Gate 0 ` +
        `(${stage1Result.pretriageRejected} pre-triage rejected, ` +
        `${stage1Result.earlyTrapRejected} early trap rejected)`
      );
    } catch (err) {
      // Stage-level failure: if Stage 1 fails entirely, do not proceed with partial data
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[runPipeline] Stage 1 failed: ${message}`);
      throw new Error(`Stage 1 failed — pipeline aborted: ${message}`);
    }
  }

  // TEST MODE ONLY — cap candidates before they enter Gate 0
  if (testMode) {
    const original = candidatesToProcess.length;
    candidatesToProcess = candidatesToProcess.slice(0, maxCandidates);
    console.log(`[TEST MODE] Capped candidates: ${original} → ${candidatesToProcess.length}`);
  }

  resetGate1Accumulator();
  resetGate2Accumulator();
  // ── Process each candidate independently ─────────────────────────────────
  // Candidates with retry_count > 0 are re-queued with exponential backoff.
  // Failures on one candidate never halt others.
  console.log(
    `[runPipeline] Processing ${candidatesToProcess.length} candidates through gates`
  );

  const pendingRetry: Array<{ candidateId: string; attempt: number }> = [];

  for (const candidateId of candidatesToProcess) {
    const result = await processCandidate(candidateId, cityContext, category);
    accumulateStats(stats, result);

    if (result.status === "failed") {
      pendingRetry.push({ candidateId, attempt: 1 });
    }
  }
await flushGate1Batch();
await flushGate2Batch();

  // ── Retry pass — exponential backoff ─────────────────────────────────────
  // Candidates that failed their first attempt are retried up to 2 more times.
  // Backoff: 2 min after attempt 1, 4 min after attempt 2, 8 min = max (handled in handleCandidateFailure).
  const RETRY_DELAYS = [2 * 60 * 1000, 4 * 60 * 1000];

  for (let retryRound = 0; retryRound < 2; retryRound++) {
    const retrying = pendingRetry.filter((r) => r.attempt === retryRound + 1);
    if (retrying.length === 0) break;

    const delayMs = RETRY_DELAYS[retryRound];
    console.log(
      `[runPipeline] Retry round ${retryRound + 1}: ${retrying.length} candidates, ` +
      `waiting ${delayMs / 1000}s`
    );
    await sleep(delayMs);

    for (const { candidateId } of retrying) {
      const result = await processCandidate(candidateId, cityContext, category);
      // Update stats: remove the previous 'failed' count if this succeeded
      if (result.status !== "failed") {
        stats.candidates_failed = Math.max(0, stats.candidates_failed - 1);
        accumulateStats(stats, result);
      } else if (retryRound < 1) {
        // Still failing — queue for one more round
        pendingRetry.push({ candidateId, attempt: retryRound + 2 });
      }
    }
  }

  // Final count of candidates that exhausted all retries
  stats.candidates_pending_retry = 0; // all retries now complete

  // ── Build and return run summary ─────────────────────────────────────────
  const completedAt = new Date();
  const runtimeSeconds = Math.round(
    (completedAt.getTime() - startedAt.getTime()) / 1000
  );

  // Estimate costs from stats
  const costs = calculateEstimatedCosts(stats);
  stats.estimated_api_cost_usd = costs.total;
  stats.estimated_claude_cost_usd = costs.claude;
  stats.estimated_savings_usd = costs.savings;

  const summary: PipelineRunSummary = {
    run_id: runId,
    city_id: cityId,
    category,
    pipeline_version: PIPELINE_VERSION,
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    runtime_seconds: runtimeSeconds,
    ...stats,
  };

  console.log(
    `[runPipeline] Complete in ${runtimeSeconds}s. ` +
    `${stats.entries_promoted} entries promoted ` +
    `(Q1: ${stats.entries_queued_q1}, Q2: ${stats.entries_queued_q2}, Q3: ${stats.entries_queued_q3}). ` +
    `${stats.candidates_failed} permanent failures.`
  );

  // Persist run summary — non-blocking, failure never throws
  supabase
    .from("pipeline_runs")
    .insert({
      id:                              runId,
      city_id:                         cityId,
      category:                        category,
      pipeline_version:                summary.pipeline_version,
      started_at:                      summary.started_at,
      completed_at:                    summary.completed_at,
      runtime_seconds:                 summary.runtime_seconds,
      candidates_discovered:           summary.candidates_discovered,
      candidates_deduplicated:         summary.candidates_deduplicated,
      candidates_pretriage_rejected:   summary.candidates_pretriage_rejected,
      candidates_early_trap_rejected:  summary.candidates_early_trap_rejected,
      candidates_entering_gate0:       summary.candidates_entering_gate0,
      viator_enrichment_lookups:       summary.viator_enrichment_lookups,
      gate0_verified_open:             summary.gate0_verified_open,
      gate0_likely_open:               summary.gate0_likely_open,
      gate0_rejected:                  summary.gate0_rejected,
      gate0_pre_filter_triage:         summary.gate0_pre_filter_triage,
      gate1_entered:                   summary.gate1_entered,
      gate1_passed:                    summary.gate1_passed,
      gate1_borderline:                summary.gate1_borderline,
      gate1_rejected:                  summary.gate1_rejected,
      gate2_entered:                   summary.gate2_entered,
      gate2_passed:                    summary.gate2_passed,
      gate2_soul_exceptions:           summary.gate2_soul_exceptions,
      gate2_rejected:                  summary.gate2_rejected,
      stage3_closure_discovered:       summary.stage3_closure_discovered,
      stage3_tripadvisor_disconnect:   summary.stage3_tripadvisor_disconnect,
      entries_promoted:                summary.entries_promoted,
      entries_queued_q1:               summary.entries_queued_q1,
      entries_queued_q2:               summary.entries_queued_q2,
      entries_queued_q3:               summary.entries_queued_q3,
      editorial_full:                  summary.editorial_full,
      editorial_minimal:               summary.editorial_minimal,
      seasonal_scores_rule_computed:   summary.seasonal_scores_rule_computed,
      seasonal_scores_claude_computed: summary.seasonal_scores_claude_computed,
      candidates_failed:               summary.candidates_failed,
      candidates_pending_retry:        summary.candidates_pending_retry,
      estimated_api_cost_usd:          summary.estimated_api_cost_usd,
      estimated_claude_cost_usd:       summary.estimated_claude_cost_usd,
      estimated_savings_usd:           summary.estimated_savings_usd,
    })
    .then(({ error }) => {
      if (error) {
        console.error("[pipeline] Failed to persist run summary:", error.message);
      } else {
        console.log(`[pipeline] Run summary persisted — id: ${runId}`);
      }
    });

  // Non-blocking article generation -- failure never affects
  // pipeline completion status
  generateArticlesForCity(cityId).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[article-gen] auto-trigger failed:', message);
  });

  return summary;
}

// ─────────────────────────────────────────────────────────────────────────────
// Run all categories sequentially
// ─────────────────────────────────────────────────────────────────────────────

export async function runPipelineAll(
  cityId: string
): Promise<PipelineRunAllSummary> {
  const startedAt = new Date();
  const categorySummaries: PipelineRunSummary[] = [];

  console.log(`[runPipelineAll] Starting all ${ALL_CATEGORIES.length} categories for city=${cityId}`);

  for (const category of ALL_CATEGORIES) {
    console.log(`[runPipelineAll] ── Starting category: ${category} ──`);
    const summary = await runPipeline(cityId, category);
    categorySummaries.push(summary);
    console.log(
      `[runPipelineAll] ── ${category} complete: ${summary.entries_promoted} promoted, ` +
      `${summary.candidates_failed} failed (${summary.runtime_seconds}s) ──`
    );
  }

  // Aggregate totals across all categories
  const totals = initialStats();
  for (const s of categorySummaries) {
    for (const key of Object.keys(totals) as (keyof RunStats)[]) {
      (totals[key] as number) += s[key] as number;
    }
  }

  const completedAt = new Date();
  const runtimeSeconds = Math.round(
    (completedAt.getTime() - startedAt.getTime()) / 1000
  );

  console.log(
    `[runPipelineAll] All categories complete in ${runtimeSeconds}s. ` +
    `${totals.entries_promoted} total entries promoted, ` +
    `${totals.candidates_failed} total failures.`
  );

  return {
    city_id: cityId,
    pipeline_version: PIPELINE_VERSION,
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    runtime_seconds: runtimeSeconds,
    categories: categorySummaries,
    totals,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats accumulator — called after each candidate result
// ─────────────────────────────────────────────────────────────────────────────

function accumulateStats(stats: RunStats, result: CandidateResult): void {
  // Track gate entry counts for accurate cost estimation — derived from stoppedAt,
  // which is set for all statuses (passed, rejected, and failed).
  const enteredGate1 = result.stoppedAt !== "gate0";
  const enteredGate2 = enteredGate1 && result.stoppedAt !== "gate1";
  if (enteredGate1) stats.gate1_entered++;
  if (enteredGate2) stats.gate2_entered++;

  if (result.status === "failed") {
    stats.candidates_failed++;
    return;
  }

  if (result.status === "rejected") {
    switch (result.stoppedAt) {
      case "gate0":
        // Gate 0 rejection detail is in the pipelineData which is null on rejection.
        // The orchestrator reads gate stats from the DB after the run for accuracy.
        // We increment a general counter here.
        stats.gate0_rejected++;
        break;
      case "gate1":
        stats.gate1_rejected++;
        break;
      case "gate2":
        stats.gate2_rejected++;
        break;
      case "stage3":
        stats.stage3_closure_discovered++;
        break;
    }
    return;
  }

  // status === "passed"
  if (result.pipelineData) {
    const d = result.pipelineData;

    // Gate 0
    if (d.gate0.status === "verified_open") stats.gate0_verified_open++;
    if (d.gate0.status === "likely_open") stats.gate0_likely_open++;
    if (d.gate0.pre_filter_triage) stats.gate0_pre_filter_triage++;

    // Gate 1
    if (d.gate1?.result === "pass") stats.gate1_passed++;
    if (d.gate1?.result === "borderline") stats.gate1_borderline++;

    // Gate 2
    stats.gate2_passed++;
    if (d.gate2?.soul_exception_flagged) stats.gate2_soul_exceptions++;

    // Stage 3
    if (d.stage3?.tripadvisor_disconnect_detected) stats.stage3_tripadvisor_disconnect++;

    // Editorial tier
    if (result.editorialTier === "full") stats.editorial_full++;
    if (result.editorialTier === "minimal") stats.editorial_minimal++;

    // Seasonal scores
    if (result.seasonalScoresRuleComputed) {
      stats.seasonal_scores_rule_computed++;
    } else {
      stats.seasonal_scores_claude_computed++;
    }

    // Queue
    const queue = assignReviewQueue(d);
    if (queue === "check_q1") stats.entries_queued_q1++;
    else if (queue === "check_q2") stats.entries_queued_q2++;
    else if (queue === "check_q3") stats.entries_queued_q3++;

    stats.entries_promoted++;
  }
}