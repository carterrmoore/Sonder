/**
 * gate2.ts — Quality Scoring
 *
 * Gate 2 assigns a quality score 0-100 to each candidate that passed Gate 1.
 * Only candidates with gate1.result === 'pass' or 'borderline' enter Gate 2.
 *
 * Scoring criteria and weights are category-specific (defined in prompts.ts).
 * Pass threshold: 65+. Soul exception: 55-64 with transformative review language.
 *
 * Architecture mirrors Gate 1 exactly:
 *   - Module-level batch accumulator, flushed at GATE2_BATCH_SIZE (12)
 *   - Prompt caching on system prompt block [v1.1]
 *   - Malformed JSON response retries with batch size 5
 *   - resetGate2Accumulator() + flushGate2Batch() called by orchestrator
 *
 * Gate 2 receives the full candidate payload (not compressed like Gate 1)
 * because quality scoring requires review content, editorial mentions,
 * and local platform signals that Gate 1 did not need.
 *
 * Model: claude-sonnet-4-20250514
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category } from "@/types/pipeline";
import {
  batchArray,
  generateBatchId,
  type CityContext,
} from "./utils";
import {
  gate2SystemPrompt,
  gate2UserMessage,
  buildCachedMessages,
  type Gate2CandidatePayload,
} from "./prompts";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const GATE2_BATCH_SIZE = 12;
const GATE2_RETRY_BATCH_SIZE = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Gate2ScoreComponent {
  criterion: string;
  score: number;
  max_score: number;
  rationale: string;
}

export interface Gate2ClaudeResult {
  candidate_id: string;
  tourist_trap_confirmed: boolean;
  tourist_trap_reason: string | null;
  total_score: number;
  passed: boolean;
  soul_exception_flagged: boolean;
  soul_exception_justification: string | null;
  booking_tier: 1 | 2 | 3 | 4;
  components: Gate2ScoreComponent[];
  claude_batch_id: string;
}

// Shape read from pipeline_candidates for Gate 2 payload construction
interface CandidateForGate2 {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  sources: Array<{
    source: string;
    source_id: string;
    source_url: string | null;
    is_primary: boolean;
  }>;
  stage1_result: {
    aggregate_ratings?: {
      google_maps_rating: number | null;
      google_maps_review_count: number | null;
      tripadvisor_rating: number | null;
      tripadvisor_review_count: number | null;
    };
    recent_reviews?: Array<{
      text: string;
      language: string;
      rating: number | null;
      is_local_guide: boolean;
      review_date: string;
      author_name: string | null;
    }>;
    review_source?: "apify" | "google";
    price_level?: number | null;
    early_trap_flag?: boolean;
  };
  gate1_result: {
    result: "pass" | "reject" | "borderline";
    criteria_triggered: number;
    criteria: Array<{
      criterion: string;
      triggered: boolean;
      evidence: string;
    }>;
    claude_batch_id: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the Gate 2 candidate payload from the pipeline_candidates row.
 * Gate 2 gets the full review set and editorial mentions — quality scoring
 * requires this depth. Unlike Gate 1, no compression is applied.
 */
async function buildGate2Payload(
  candidateId: string,
  supabase: SupabaseClient
): Promise<Gate2CandidatePayload | null> {
  const { data, error } = await supabase
    .from("pipeline_candidates")
    .select("id, name, address, lat, lng, sources, stage1_result, gate1_result")
    .eq("id", candidateId)
    .single<CandidateForGate2>();

  if (error || !data) {
    console.warn(`[gate2] Could not read candidate ${candidateId}: ${error?.message}`);
    return null;
  }

  const gate1 = data.gate1_result;
  const enrichment = data.stage1_result;

  const ratings = enrichment.aggregate_ratings ?? {
    google_maps_rating: null,
    google_maps_review_count: null,
    tripadvisor_rating: null,
    tripadvisor_review_count: null,
  };

  const maxChars = enrichment.review_source === "apify" ? 2000 : 500;
  const reviews = (enrichment.recent_reviews ?? []).map((r) => ({
    text: r.text.slice(0, maxChars),
    language: r.language,
    rating: r.rating ?? 0,
    is_local_guide: r.is_local_guide,
    review_date: r.review_date,
  }));

  // Local platform presence: Foursquare source or explicit local_platform source
  const localPlatformPresent = data.sources.some(
    (s) => s.source === "foursquare" || s.source === "local_platform"
  );
  const localPlatformName = data.sources.find(
    (s) => s.source === "foursquare"
  )
    ? "Foursquare"
    : null;

  // TripAdvisor rank: not yet available (Stage 3 checks this)
  // Gate 2 receives null here; Stage 3 checks for disconnect after Gate 2 passes
  const tripadvisorRank = null;

  return {
    candidate_id: candidateId,
    name: data.name,
    formatted_address: data.address,
    neighborhood: extractNeighborhood(data.address),
    rating: ratings.google_maps_rating ?? 0,
    review_count: ratings.google_maps_review_count ?? 0,
    price_level: enrichment.price_level ?? null,
    recent_reviews: reviews,
    editorial_mentions: [], // Editorial mentions populated in Stage 3 — empty at Gate 2
    local_platform_present: localPlatformPresent,
    local_platform_name: localPlatformName,
    tripadvisor_rank: tripadvisorRank,
    gate1_borderline: gate1.result === "borderline",
    gate1_criteria_triggered: gate1.criteria_triggered,
  };
}

/**
 * Extracts neighbourhood from address string.
 * Duplicated from gate1.ts — shared utility in Phase 2 when we add
 * a full neighbourhood lookup against the neighbourhoods table.
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// Claude API caller
// ─────────────────────────────────────────────────────────────────────────────

async function callGate2Claude(
  payloads: Gate2CandidatePayload[],
  batchId: string,
  cityContext: CityContext,
  category: Category
): Promise<Gate2ClaudeResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const systemPrompt = gate2SystemPrompt(cityContext.name, cityContext.country, category);
  const userMessage = gate2UserMessage(payloads, batchId);
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
      model: CLAUDE_MODEL,
      max_tokens: 6144, // Gate 2 responses are longer — score components per candidate
      system,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  const rawText = data.content
    ?.filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("") ?? "";

  return parseGate2Response(rawText, batchId, payloads.map((p) => p.candidate_id));
}

// ─────────────────────────────────────────────────────────────────────────────
// Model dispatch — Claude Sonnet only
// ─────────────────────────────────────────────────────────────────────────────

async function callGate2Model(
  payloads: Gate2CandidatePayload[],
  batchId: string,
  cityContext: CityContext,
  category: Category
): Promise<Gate2ClaudeResult[]> {
  return callGate2Claude(payloads, batchId, cityContext, category);
}

function parseGate2Response(
  rawText: string,
  batchId: string,
  expectedIds: string[]
): Gate2ClaudeResult[] {
  const clean = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch (err) {
    console.error(
      `[gate2] JSON parse failed for batch ${batchId}. Raw response (first 500 chars):`,
      rawText.slice(0, 500)
    );
    throw new Error(`Gate 2 Claude response was not valid JSON: ${err}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Gate 2 Claude response was not an array. Got: ${typeof parsed}`);
  }

  const results: Gate2ClaudeResult[] = [];

  for (const item of parsed) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof item.candidate_id !== "string"
    ) {
      console.warn(`[gate2] Malformed result item in batch ${batchId}:`, item);
      continue;
    }

    const isTouristTrap = item.tourist_trap_confirmed === true;

    // Tourist trap confirmed — score is 0, no components needed
    if (isTouristTrap) {
      results.push({
        candidate_id: item.candidate_id,
        tourist_trap_confirmed: true,
        tourist_trap_reason: item.tourist_trap_reason ?? "Tourist trap confirmed by Gate 2 pre-check",
        total_score: 0,
        passed: false,
        soul_exception_flagged: false,
        soul_exception_justification: null,
        booking_tier: 2,
        components: [],
        claude_batch_id: batchId,
      });
      continue;
    }

    // Normal scoring — validate required fields
    if (
      typeof item.total_score !== "number" ||
      typeof item.passed !== "boolean" ||
      !Array.isArray(item.components)
    ) {
      console.warn(`[gate2] Malformed result item in batch ${batchId}:`, item);
      continue;
    }

    // Validate and clamp score to 0-100
    const totalScore = Math.max(0, Math.min(100, Math.round(item.total_score)));

    // Validate booking_tier
    const bookingTier: 1 | 2 | 3 | 4 =
      [1, 2, 3, 4].includes(item.booking_tier) ? item.booking_tier : 2;

    results.push({
      candidate_id: item.candidate_id,
      tourist_trap_confirmed: false,
      tourist_trap_reason: null,
      total_score: totalScore,
      passed: totalScore >= 65,  // Re-derive from score rather than trusting Claude's boolean
      soul_exception_flagged: item.soul_exception_flagged === true,
      soul_exception_justification: item.soul_exception_justification ?? null,
      booking_tier: bookingTier,
      components: item.components.map((c: Record<string, unknown>) => ({
        criterion: String(c.criterion ?? ""),
        score: Number(c.score ?? 0),
        max_score: Number(c.max_score ?? 0),
        rationale: String(c.rationale ?? ""),
      })),
      claude_batch_id: batchId,
    });
  }

  // Warn on missing candidates
  const returnedIds = new Set(results.map((r) => r.candidate_id));
  for (const id of expectedIds) {
    if (!returnedIds.has(id)) {
      console.warn(`[gate2] Candidate ${id} missing from Claude response in batch ${batchId}`);
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch processor
// ─────────────────────────────────────────────────────────────────────────────

async function processGate2Batch(
  payloads: Gate2CandidatePayload[],
  cityContext: CityContext,
  category: Category,
  supabase: SupabaseClient
): Promise<Map<string, Gate2ClaudeResult>> {
  const batchId = generateBatchId("gate2");
  const results = new Map<string, Gate2ClaudeResult>();

  let claudeResults: Gate2ClaudeResult[];

  try {
    claudeResults = await callGate2Model(payloads, batchId, cityContext, category);
  } catch (firstErr) {
    console.warn(
      `[gate2] Batch ${batchId} failed (${payloads.length} candidates). ` +
      `Retrying with batch size ${GATE2_RETRY_BATCH_SIZE}.`,
      firstErr instanceof Error ? firstErr.message : firstErr
    );

    claudeResults = [];
    const smallerBatches = batchArray(payloads, GATE2_RETRY_BATCH_SIZE);

    for (const smallBatch of smallerBatches) {
      const retryBatchId = generateBatchId("gate2-retry");
      try {
        const retryResults = await callGate2Model(
          smallBatch,
          retryBatchId,
          cityContext,
          category
        );
        claudeResults.push(...retryResults);
      } catch (retryErr) {
        console.error(
          `[gate2] Retry batch ${retryBatchId} also failed. ` +
          `Marking ${smallBatch.length} candidates as gate2 failures.`,
          retryErr instanceof Error ? retryErr.message : retryErr
        );

        for (const payload of smallBatch) {
          await supabase
            .from("pipeline_candidates")
            .update({
              processing_status: "failed",
              failure_stage: "gate2",
              failure_reason: `Gate 2 model failed after retry: ${
                retryErr instanceof Error ? retryErr.message : String(retryErr)
              }`,
            })
            .eq("id", payload.candidate_id);
        }
      }
    }
  }

  // Write results and build return map
  for (const result of claudeResults) {
    await supabase
      .from("pipeline_candidates")
      .update({ gate2_result: result })
      .eq("id", result.candidate_id);

    results.set(result.candidate_id, result);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level batch accumulator — mirrors Gate 1 pattern exactly
// ─────────────────────────────────────────────────────────────────────────────

let gate2Accumulator: {
  payloads: Gate2CandidatePayload[];
  resolvers: Map<string, {
    resolve: (result: Gate2ClaudeResult) => void;
    reject: (err: Error) => void;
  }>;
  cityContext: CityContext | null;
  category: Category | null;
  supabase: SupabaseClient | null;
} = {
  payloads: [],
  resolvers: new Map(),
  cityContext: null,
  category: null,
  supabase: null,
};

export function resetGate2Accumulator(): void {
  gate2Accumulator = {
    payloads: [],
    resolvers: new Map(),
    cityContext: null,
    category: null,
    supabase: null,
  };
}

export async function flushGate2Batch(): Promise<void> {
  if (gate2Accumulator.payloads.length === 0) return;
  if (!gate2Accumulator.cityContext || !gate2Accumulator.category || !gate2Accumulator.supabase) {
    return;
  }

  const { payloads, resolvers, cityContext, category, supabase } = gate2Accumulator;
  gate2Accumulator.payloads = [];
  gate2Accumulator.resolvers = new Map();

  const results = await processGate2Batch(payloads, cityContext, category, supabase);

  for (const [candidateId, resolver] of resolvers) {
    const result = results.get(candidateId);
    if (result) {
      resolver.resolve(result);
    } else {
      resolver.reject(
        new Error(`Gate 2 result missing for candidate ${candidateId} after batch flush`)
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: runGate2
// ─────────────────────────────────────────────────────────────────────────────

export async function runGate2(
  candidateId: string,
  cityContext: CityContext,
  category: Category,
  gate1Result: { result: "pass" | "reject" | "borderline"; criteria_triggered: number },
  supabase: SupabaseClient
): Promise<Gate2ClaudeResult> {
  // Guard: only pass and borderline from Gate 1 enter Gate 2
  // The orchestrator enforces this, but we double-check here
  if (gate1Result.result === "reject") {
    throw new Error(
      `Gate 2 called on candidate ${candidateId} that was rejected at Gate 1 — this is a bug`
    );
  }

  const payload = await buildGate2Payload(candidateId, supabase);

  if (!payload) {
    throw new Error(`Gate 2 could not build payload for candidate ${candidateId}`);
  }

  // Add to accumulator
  gate2Accumulator.payloads.push(payload);
  gate2Accumulator.cityContext = cityContext;
  gate2Accumulator.category = category;
  gate2Accumulator.supabase = supabase;

  // Flush immediately when full OR when there's only 1 candidate — the
  // sequential processCandidate loop would deadlock waiting for batch fill
  const shouldFlush =
    gate2Accumulator.payloads.length >= GATE2_BATCH_SIZE ||
    gate2Accumulator.payloads.length === 1;

  return new Promise((resolve, reject) => {
    gate2Accumulator.resolvers.set(candidateId, { resolve, reject });

    if (shouldFlush) {
      flushGate2Batch().catch((err) => {
        console.error("[gate2] Batch flush failed:", err);
        for (const resolver of gate2Accumulator.resolvers.values()) {
          resolver.reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    }
  });
}