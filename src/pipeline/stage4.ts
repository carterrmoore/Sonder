/**
 * stage4.ts — Editorial Generation
 *
 * Stage 4 runs on all candidates that passed Gates 0-2 and Stage 3.
 * It generates editorial content via Claude and assembles the final data
 * fields needed by the orchestrator to build RawPipelineData.
 *
 * Tiered editorial generation by Gate 2 score [v1.1]:
 *   72+    → Full editorial (insider_tip, what_to_order, why_it_made_the_cut,
 *             suggested_tags, closure_pattern, article_topic_suggestions)
 *   65-71  → Minimal editorial (why_it_made_the_cut only)
 *
 * Rule-based seasonal scores [v1.1]:
 *   ~60-70% of candidates have seasonal scores computed by rules with no Claude call.
 *   Ambiguous candidates (rooftops, seasonal closures, weekend-only) go to Claude.
 *
 * Batching: 10 candidates per Claude call (slightly smaller than gates because
 * full editorial output is token-heavy — more output tokens per candidate).
 *
 * Unlike Gates 1 and 2, Stage 4 does NOT use a module-level accumulator.
 * By the time Stage 4 runs, the orchestrator processes candidates that have
 * already been through three gates — the survivor pool is small enough that
 * we batch them explicitly in runStage4 rather than using a promise accumulator.
 *
 * Model: claude-sonnet-4-20250514
 * Prompt caching: system prompt cached across all Stage 4 calls [v1.1]
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Category,
  SeasonalScores,
  EditorialContent,
  ClosurePattern,
  AggregateRatings,
  RawReview,
  EditorialMention,
  EntryTag,
  BookingTier,
} from "@/types/pipeline";
import {
  computeSeasonalScores,
  getCurrentSeason,
  generateBatchId,
  batchArray,
  type CityContext,
  type CandidateForSeasonalRules,
} from "./utils";
import {
  stage4FullSystemPrompt,
  stage4FullUserMessage,
  stage4MinimalSystemPrompt,
  stage4MinimalUserMessage,
  buildCachedMessages,
  type Stage4FullPayload,
  type Stage4MinimalPayload,
} from "./prompts";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const STAGE4_BATCH_SIZE = 10;
const FULL_EDITORIAL_THRESHOLD = 72;
const MINIMAL_EDITORIAL_MIN = 65;

// ─────────────────────────────────────────────────────────────────────────────
// Return type
// ─────────────────────────────────────────────────────────────────────────────

export interface Stage4Output {
  stage4Result: {
    editorial: EditorialContent | null;
    seasonal_scores: SeasonalScores | null;
    suggested_tags: EntryTag[];
    closure_pattern: ClosurePattern | null;
    article_topic_suggestions: string[];
    editorial_tier: "full" | "minimal";
    aggregate_ratings: AggregateRatings;
    recent_reviews: RawReview[];
    editorial_mentions: EditorialMention[];
    opening_hours_text: string | null;
    is_new_entry: boolean;
  };
  editorialTier: "full" | "minimal";
  seasonalScoresRuleComputed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidate data shape read from pipeline_candidates
// ─────────────────────────────────────────────────────────────────────────────

interface CandidateForStage4 {
  id: string;
  name: string;
  address: string;
  category: string;
  created_at: string;
  sources: Array<{
    source: string;
    source_id: string;
    source_url: string | null;
    is_primary: boolean;
  }>;
  stage1_result: {
    aggregate_ratings?: AggregateRatings;
    recent_reviews?: RawReview[];
    editorial_mentions?: EditorialMention[];
    opening_hours_text?: string | null;
    business_status?: string | null;
    website?: string | null;
    price_level?: number | null;
    early_trap_flag?: boolean;
  };
  gate2_result: {
    total_score: number;
    passed: boolean;
    soul_exception_flagged: boolean;
    booking_tier: BookingTier;
    components: Array<{
      criterion: string;
      score: number;
      max_score: number;
      rationale: string;
    }>;
    claude_batch_id: string;
  };
  stage3_result: {
    website_url: string | null;
    website_status: string | null;
    local_platform_present: boolean;
    booking_platform_active: boolean | null;
    booking_platform_url: string | null;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// New entry detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the venue opened fewer than 18 months ago.
 * Drives the "New" tag and prevents "Essential" classification
 * until after the first re-evaluation cycle.
 *
 * Detection method: scan reviews for opening signals.
 * "just opened", "new restaurant", "recently opened" in the most recent reviews.
 * If the candidate row itself was created recently, use that as a weak signal too.
 */
function detectIsNewEntry(
  reviews: RawReview[],
  candidateCreatedAt: string
): boolean {
  const newEntryPatterns = [
    /just\s+opened/i,
    /newly\s+opened/i,
    /recently\s+opened/i,
    /new\s+restaurant/i,
    /new\s+place/i,
    /nowe\s+miejsce/i,       // Polish: new place
    /właśnie\s+otwart/i,     // Polish: just opened
    /niedawno\s+otwart/i,    // Polish: recently opened
    /neu\s+eröffnet/i,       // German: newly opened
    /vient\s+d'ouvrir/i,     // French: just opened
    /opened\s+in\s+202[3-9]/i,
    /opened\s+in\s+2025/i,
  ];

  const recentReviews = reviews.slice(0, 5);
  for (const review of recentReviews) {
    if (newEntryPatterns.some((p) => p.test(review.text))) {
      return true;
    }
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seasonal score rule application
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies rule-based seasonal scoring from utils.ts.
 * Returns { scores, ruleComputed } where ruleComputed is true if rules handled it.
 *
 * The candidate shape needs to match CandidateForSeasonalRules.
 * We derive the required fields from the candidate row and its reviews.
 */
function applySeasonalRules(
  candidate: CandidateForStage4,
  reviews: RawReview[]
): { scores: SeasonalScores | null; ruleComputed: boolean } {
  // Detect outdoor/indoor from review text and opening hours
  const reviewText = reviews.map((r) => r.text).join(" ").toLowerCase();

  const outdoorSignals = [
    "outdoor", "terrace", "garden", "rooftop", "patio",
    "ogródek", "taras",           // Polish: garden/terrace
    "letni ogród",                 // Polish: summer garden
  ];

  const indoorSignals = [
    "indoor", "inside", "cozy interior", "warm interior",
    "no outdoor", "no terrace", "wnętrze",  // Polish: interior
  ];

  const outdoor_confirmed = outdoorSignals.some((s) => reviewText.includes(s));
  const indoor_confirmed =
    !outdoor_confirmed || indoorSignals.some((s) => reviewText.includes(s));

  // Detect seasonal closure from opening hours text
  const openingHours = candidate.stage1_result?.opening_hours_text ?? "";
  const seasonalClosureNote = detectSeasonalClosure(openingHours, reviewText);

  // Detect weekend-only operation
  const isWeekendOnly = detectWeekendOnly(openingHours);

  const candidateForRules: CandidateForSeasonalRules = {
    category: candidate.category as Category,
    tags: [],  // Tags not yet assigned at this stage
    name: candidate.name,
    outdoor_confirmed,
    indoor_confirmed,
    seasonal_closure_note: seasonalClosureNote,
    is_weekend_only: isWeekendOnly,
  };

  const scores = computeSeasonalScores(candidateForRules);
  return {
    scores,
    ruleComputed: scores !== null,
  };
}

function detectSeasonalClosure(
  openingHoursText: string,
  reviewText: string
): string | null {
  const patterns = [
    /closed\s+(?:in\s+)?(?:january|february|march|november|december)/i,
    /seasonal\s+closure/i,
    /open\s+(?:only\s+)?(?:in\s+)?(?:summer|spring|autumn|winter)/i,
    /closed\s+(?:for\s+)?winter/i,
    /closed\s+(?:for\s+)?summer/i,
    /zamknięte\s+w\s+(?:zimie|lecie)/i,  // Polish
  ];

  const combined = `${openingHoursText} ${reviewText}`;
  for (const p of patterns) {
    const match = combined.match(p);
    if (match) return match[0];
  }
  return null;
}

function detectWeekendOnly(openingHoursText: string): boolean {
  if (!openingHoursText) return false;
  const lower = openingHoursText.toLowerCase();
  return (
    (lower.includes("saturday") || lower.includes("sunday")) &&
    (lower.includes("monday: closed") &&
      lower.includes("tuesday: closed") &&
      lower.includes("wednesday: closed"))
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Claude API caller
// ─────────────────────────────────────────────────────────────────────────────

async function callStage4Claude(
  systemPrompt: string,
  userMessage: string,
  batchId: string,
  maxTokens: number
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const { system, messages } = buildCachedMessages(systemPrompt, userMessage);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  return (
    data.content
      ?.filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("") ?? ""
  );
}

function parseStage4Response<T>(rawText: string, batchId: string): T[] {
  const clean = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch (err) {
    console.error(
      `[stage4] JSON parse failed for batch ${batchId}. Raw (first 500 chars):`,
      rawText.slice(0, 500)
    );
    throw new Error(`Stage 4 Claude response was not valid JSON: ${err}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Stage 4 Claude response was not an array. Got: ${typeof parsed}`);
  }

  return parsed as T[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Full editorial processor (72+ score)
// ─────────────────────────────────────────────────────────────────────────────

interface FullEditorialClaudeResult {
  candidate_id: string;
  insider_tip: string;
  what_to_order: string | null;
  what_to_order_source_excerpts: string[];
  why_it_made_the_cut: string;
  suggested_tags: string[];
  seasonal_scores: {
    spring: number;
    summer: number;
    autumn: number;
    winter: number;
  } | null;
  closure_pattern: {
    closed_days: number[];
    reduced_hours_days: number[];
    reduced_hours_note: string | null;
    weekend_only: boolean;
    weekday_only: boolean;
    seasonal_closure_note: string | null;
  };
  article_topic_suggestions: string[];
}

async function processFullEditorialBatch(
  candidates: Array<{
    candidate: CandidateForStage4;
    payload: Stage4FullPayload;
    ruleSeasonalScores: SeasonalScores | null;
  }>,
  cityContext: CityContext
): Promise<Map<string, FullEditorialClaudeResult>> {
  const batchId = generateBatchId("stage4-full");
  const currentSeason = getCurrentSeason();

  const systemPrompt = stage4FullSystemPrompt(
    cityContext.name,
    cityContext.country,
    currentSeason
  );
  const userMessage = stage4FullUserMessage(candidates.map((c) => c.payload));

  let rawText: string;
  try {
    rawText = await callStage4Claude(
      systemPrompt,
      userMessage,
      batchId,
      8192  // Full editorial is output-heavy — generous token budget
    );
  } catch (err) {
    // Retry with batch size 3 on failure
    console.warn(
      `[stage4] Full editorial batch ${batchId} failed. Retrying individually.`,
      err instanceof Error ? err.message : err
    );

    const results = new Map<string, FullEditorialClaudeResult>();
    for (const { candidate, payload } of candidates) {
      const retryBatchId = generateBatchId("stage4-full-retry");
      try {
        const retryText = await callStage4Claude(
          systemPrompt,
          stage4FullUserMessage([payload]),
          retryBatchId,
          2048
        );
        const parsed = parseStage4Response<FullEditorialClaudeResult>(retryText, retryBatchId);
        if (parsed[0]) results.set(candidate.id, parsed[0]);
      } catch (retryErr) {
        console.error(
          `[stage4] Full editorial retry failed for ${candidate.id}:`,
          retryErr instanceof Error ? retryErr.message : retryErr
        );
      }
    }
    return results;
  }

  const parsed = parseStage4Response<FullEditorialClaudeResult>(rawText, batchId);
  const results = new Map<string, FullEditorialClaudeResult>();
  for (const item of parsed) {
    if (typeof item.candidate_id === "string") {
      results.set(item.candidate_id, item);
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal editorial processor (65-71 score)
// ─────────────────────────────────────────────────────────────────────────────

interface MinimalEditorialClaudeResult {
  candidate_id: string;
  why_it_made_the_cut: string;
}

async function processMinimalEditorialBatch(
  candidates: Array<{
    candidate: CandidateForStage4;
    payload: Stage4MinimalPayload;
  }>,
  cityContext: CityContext
): Promise<Map<string, MinimalEditorialClaudeResult>> {
  const batchId = generateBatchId("stage4-minimal");

  const systemPrompt = stage4MinimalSystemPrompt(cityContext.name, cityContext.country);
  const userMessage = stage4MinimalUserMessage(candidates.map((c) => c.payload));

  let rawText: string;
  try {
    rawText = await callStage4Claude(
      systemPrompt,
      userMessage,
      batchId,
      2048  // Minimal editorial is just one sentence per candidate
    );
  } catch (err) {
    console.warn(
      `[stage4] Minimal editorial batch ${batchId} failed. Retrying individually.`,
      err instanceof Error ? err.message : err
    );

    const results = new Map<string, MinimalEditorialClaudeResult>();
    for (const { candidate, payload } of candidates) {
      const retryBatchId = generateBatchId("stage4-minimal-retry");
      try {
        const retryText = await callStage4Claude(
          systemPrompt,
          stage4MinimalUserMessage([payload]),
          retryBatchId,
          512
        );
        const parsed = parseStage4Response<MinimalEditorialClaudeResult>(retryText, retryBatchId);
        if (parsed[0]) results.set(candidate.id, parsed[0]);
      } catch (retryErr) {
        console.error(
          `[stage4] Minimal editorial retry failed for ${candidate.id}:`,
          retryErr instanceof Error ? retryErr.message : retryErr
        );
      }
    }
    return results;
  }

  const parsed = parseStage4Response<MinimalEditorialClaudeResult>(rawText, batchId);
  const results = new Map<string, MinimalEditorialClaudeResult>();
  for (const item of parsed) {
    if (typeof item.candidate_id === "string") {
      results.set(item.candidate_id, item);
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Valid tag guard
// ─────────────────────────────────────────────────────────────────────────────

const VALID_TAGS = new Set([
  "authentic", "new", "skip_it", "soul_exception",
  "essential", "deeper_cut", "hidden_gem", "local_niche",
  "boutique", "great_value", "unique_stay",
]);

function filterValidTags(tags: unknown[]): EntryTag[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter(
    (t): t is EntryTag => typeof t === "string" && VALID_TAGS.has(t)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Seasonal score validator
// ─────────────────────────────────────────────────────────────────────────────

function validateSeasonalScore(val: unknown): 1 | 2 | 3 | 4 | 5 {
  const n = Number(val);
  if ([1, 2, 3, 4, 5].includes(n)) return n as 1 | 2 | 3 | 4 | 5;
  return 3; // Default to neutral if Claude returns something unexpected
}

function parseSeasonalScores(
  raw: FullEditorialClaudeResult["seasonal_scores"]
): SeasonalScores | null {
  if (!raw) return null;
  return {
    spring: validateSeasonalScore(raw.spring),
    summer: validateSeasonalScore(raw.summer),
    autumn: validateSeasonalScore(raw.autumn),
    winter: validateSeasonalScore(raw.winter),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Default closure pattern
// ─────────────────────────────────────────────────────────────────────────────

function buildClosurePattern(
  raw: FullEditorialClaudeResult["closure_pattern"] | null
): ClosurePattern {
  if (!raw) {
    return {
      closed_days: [],
      reduced_hours_days: [],
      reduced_hours_note: null,
      weekend_only: false,
      weekday_only: false,
      seasonal_closure_note: null,
    };
  }
  return {
    closed_days: Array.isArray(raw.closed_days)
      ? raw.closed_days.filter((d) => typeof d === "number" && d >= 0 && d <= 6)
      : [],
    reduced_hours_days: Array.isArray(raw.reduced_hours_days)
      ? raw.reduced_hours_days.filter((d) => typeof d === "number" && d >= 0 && d <= 6)
      : [],
    reduced_hours_note: typeof raw.reduced_hours_note === "string"
      ? raw.reduced_hours_note
      : null,
    weekend_only: raw.weekend_only === true,
    weekday_only: raw.weekday_only === true,
    seasonal_closure_note: typeof raw.seasonal_closure_note === "string"
      ? raw.seasonal_closure_note
      : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: runStage4
// ─────────────────────────────────────────────────────────────────────────────

export async function runStage4(
  candidateId: string,
  cityContext: CityContext,
  category: Category,
  gate2Result: {
    total_score: number;
    passed: boolean;
    soul_exception_flagged: boolean;
    booking_tier: BookingTier;
    components: Array<{
      criterion: string;
      score: number;
      max_score: number;
      rationale: string;
    }>;
  },
  supabase: SupabaseClient
): Promise<Stage4Output> {
  // Read candidate row
  const { data: candidate, error } = await supabase
    .from("pipeline_candidates")
    .select(
      "id, name, address, category, created_at, sources, stage1_result, gate2_result, stage3_result"
    )
    .eq("id", candidateId)
    .single<CandidateForStage4>();

  if (error || !candidate) {
    throw new Error(`Stage 4 could not read candidate ${candidateId}: ${error?.message}`);
  }

  const enrichment = candidate.stage1_result;
  const reviews: RawReview[] = (enrichment.recent_reviews ?? []) as RawReview[];
  const editorialMentions: EditorialMention[] = (enrichment.editorial_mentions ?? []) as EditorialMention[];
  const aggregateRatings: AggregateRatings = (enrichment.aggregate_ratings ?? {
    google_maps_rating: null,
    google_maps_review_count: null,
    booking_com_rating: null,
    tripadvisor_rating: null,
    tripadvisor_review_count: null,
    composite_rating: 0,
    composite_review_count: 0,
  }) as AggregateRatings;

  const openingHoursText = enrichment.opening_hours_text ?? null;
  const websiteUrl = candidate.stage3_result?.website_url ?? enrichment.website ?? null;
  const isNewEntry = detectIsNewEntry(reviews, candidate.created_at);

  // ── Determine editorial tier ──────────────────────────────────────────────
  const score = gate2Result.total_score;
  const editorialTier: "full" | "minimal" =
    score >= FULL_EDITORIAL_THRESHOLD ? "full" : "minimal";

  // ── Rule-based seasonal scores [v1.1] ─────────────────────────────────────
  const { scores: ruleSeasonalScores, ruleComputed: seasonalScoresRuleComputed } =
    applySeasonalRules(candidate, reviews);

  // ── Build Claude payload and call ─────────────────────────────────────────
  let editorial: EditorialContent | null = null;
  let claudeSeasonalScores: SeasonalScores | null = null;
  let suggestedTags: EntryTag[] = [];
  let closurePattern: ClosurePattern | null = null;
  let articleTopicSuggestions: string[] = [];

  if (editorialTier === "full") {
    const payload: Stage4FullPayload = {
      candidate_id: candidateId,
      name: candidate.name,
      category: category,
      neighborhood: extractNeighborhood(candidate.address),
      gate2_score: score,
      recent_reviews: reviews.slice(0, 10).map((r) => ({
        text: r.text.slice(0, 600),
        language: r.language,
        rating: r.rating ?? 0,
        is_local_guide: r.is_local_guide,
        review_date: r.review_date,
      })),
      editorial_mentions: editorialMentions.map((m) => ({
        source_name: m.source_name,
        source_tier: m.source_tier,
        excerpt: m.excerpt,
      })),
      opening_hours_text: openingHoursText,
      website: websiteUrl,
      seasonal_scoring_required: !seasonalScoresRuleComputed,
    };

    // Single-candidate call — batching for Stage 4 is handled externally
    // if running the full pipeline. For processCandidate calls, 1 candidate
    // per Stage 4 call is acceptable since the survivor pool is small.
    const fullResults = await processFullEditorialBatch(
      [{ candidate, payload, ruleSeasonalScores }],
      cityContext
    );

    const result = fullResults.get(candidateId);
    if (result) {
      editorial = {
        insider_tip: result.insider_tip ?? "",
        what_to_order: result.what_to_order ?? null,
        what_to_order_source_excerpts: Array.isArray(result.what_to_order_source_excerpts)
          ? result.what_to_order_source_excerpts
          : [],
        why_it_made_the_cut: result.why_it_made_the_cut ?? "",
        article_topic_suggestions: Array.isArray(result.article_topic_suggestions)
          ? result.article_topic_suggestions
          : [],
      };
      suggestedTags = filterValidTags(result.suggested_tags ?? []);
      closurePattern = buildClosurePattern(result.closure_pattern ?? null);
      articleTopicSuggestions = Array.isArray(result.article_topic_suggestions)
        ? result.article_topic_suggestions
        : [];

      // Use Claude's seasonal scores only if rules didn't cover this candidate
      if (!seasonalScoresRuleComputed && result.seasonal_scores) {
        claudeSeasonalScores = parseSeasonalScores(result.seasonal_scores);
      }
    }
  } else {
    // Minimal editorial — why_it_made_the_cut only
    const payload: Stage4MinimalPayload = {
      candidate_id: candidateId,
      name: candidate.name,
      category: category,
      neighborhood: extractNeighborhood(candidate.address),
      gate2_score: score,
      gate2_components: gate2Result.components,
      recent_reviews: reviews.slice(0, 5).map((r) => ({
        text: r.text.slice(0, 400),
        language: r.language,
        rating: r.rating ?? 0,
      })),
      editorial_mentions: editorialMentions.map((m) => ({
        source_name: m.source_name,
        source_tier: m.source_tier,
        excerpt: m.excerpt,
      })),
    };

    const minimalResults = await processMinimalEditorialBatch(
      [{ candidate, payload }],
      cityContext
    );

    const result = minimalResults.get(candidateId);
    if (result) {
      editorial = {
        insider_tip: "",  // Not generated for minimal tier
        what_to_order: null,
        what_to_order_source_excerpts: [],
        why_it_made_the_cut: result.why_it_made_the_cut ?? "",
        article_topic_suggestions: [],
      };
    }

    // Minimal tier: always apply rule-based seasonal scores where available
    // No Claude seasonal scoring for minimal — deferred until post-recheck
  }

  // ── Auto-tag soul exceptions ──────────────────────────────────────────────
  if (gate2Result.soul_exception_flagged && !suggestedTags.includes("soul_exception")) {
    suggestedTags = [...suggestedTags, "soul_exception"];
  }

  // ── Auto-tag new entries ──────────────────────────────────────────────────
  if (isNewEntry && !suggestedTags.includes("new")) {
    suggestedTags = [...suggestedTags, "new"];
  }

  // ── Final seasonal scores — rule-computed takes priority ─────────────────
  const finalSeasonalScores: SeasonalScores | null =
    ruleSeasonalScores ?? claudeSeasonalScores ?? null;

  return {
    stage4Result: {
      editorial,
      seasonal_scores: finalSeasonalScores,
      suggested_tags: suggestedTags,
      closure_pattern: closurePattern,
      article_topic_suggestions: articleTopicSuggestions,
      editorial_tier: editorialTier,
      aggregate_ratings: aggregateRatings,
      recent_reviews: reviews,
      editorial_mentions: editorialMentions,
      opening_hours_text: openingHoursText,
      is_new_entry: isNewEntry,
    },
    editorialTier,
    seasonalScoresRuleComputed,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Neighbourhood extractor (duplicated from gate1/gate2 — Phase 2 refactor)
// ─────────────────────────────────────────────────────────────────────────────

function extractNeighborhood(address: string): string {
  if (!address) return "Unknown";

  const krakow_districts = [
    "Stare Miasto", "Kazimierz", "Podgórze", "Nowa Huta",
    "Krowodrza", "Zwierzyniec", "Prądnik Biały", "Prądnik Czerwony",
    "Łagiewniki", "Borek Fałęcki", "Dębniki", "Bronowice",
    "Old Town", "Śródmieście",
  ];

  for (const district of krakow_districts) {
    if (address.toLowerCase().includes(district.toLowerCase())) {
      return district;
    }
  }

  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 2) return parts[1];
  return "Kraków";
}