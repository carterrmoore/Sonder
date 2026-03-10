/**
 * gate1.ts — Tourist Trap Detection
 *
 * Gate 1 identifies tourist traps before quality scoring. Running Gate 1
 * before Gate 2 avoids spending Gate 2 tokens on candidates that will be
 * rejected regardless of quality.
 *
 * Only candidates with gate0.status === 'verified_open' or 'likely_open'
 * enter Gate 1. status_unknown and confirmed_closed are already rejected.
 *
 * Architecture:
 *   - Candidates are batched into groups of 12 (optimal for payload size vs. cost)
 *   - Each batch is a single Claude call with prompt caching on the system prompt
 *   - Gate 1 payload is compressed — only tourist-trap-relevant fields [v1.1]
 *   - Claude returns structured JSON; malformed responses retry with batch size 5
 *   - Each result is written to pipeline_candidates.gate1_result immediately
 *
 * Model: claude-sonnet-4-20250514
 * Prompt caching: system prompt cached across all batches in a run [v1.1]
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, TouristTrapCriterion } from "@/types/pipeline";
import {
  batchArray,
  generateBatchId,
  type CityContext,
} from "./utils";
import {
  gate1SystemPrompt,
  gate1UserMessage,
  buildCachedMessages,
  type Gate1CandidatePayload,
} from "./prompts";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const GATE1_BATCH_SIZE = 12;
const GATE1_RETRY_BATCH_SIZE = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Gate1CriterionAssessment {
  criterion: TouristTrapCriterion;
  triggered: boolean;
  evidence: string;
}

interface Gate1ClaudeResult {
  candidate_id: string;
  result: "pass" | "reject" | "borderline";
  criteria_triggered: number;
  criteria: Gate1CriterionAssessment[];
  claude_batch_id: string;
}

// What Gate 1 reads from the pipeline_candidates row
interface CandidateForGate1 {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  is_curator_nomination: boolean;
  stage1_result: {
    aggregate_ratings?: {
      google_maps_rating: number | null;
      google_maps_review_count: number | null;
    };
    recent_reviews?: Array<{
      text: string;
      language: string;
      rating: number | null;
      is_local_guide: boolean;
      review_date: string;
    }>;
    price_level?: number | null;
    early_trap_flag?: boolean;
  };
  sources: Array<{
    source: string;
    source_id: string;
    source_url: string | null;
    is_primary: boolean;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidate data reader
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads a single candidate's data from pipeline_candidates and assembles
 * the compressed Gate1CandidatePayload.
 *
 * Gate 1 payload is stripped to tourist-trap-relevant fields only [v1.1].
 * ~350-450 tokens per candidate vs ~800 for full Place Details.
 */
async function buildGate1Payload(
  candidateId: string,
  cityContext: CityContext,
  supabase: SupabaseClient
): Promise<{ payload: Gate1CandidatePayload; isCuratorNomination: boolean } | null> {
  const { data, error } = await supabase
    .from("pipeline_candidates")
    .select("id, name, address, lat, lng, is_curator_nomination, stage1_result, sources")
    .eq("id", candidateId)
    .single<CandidateForGate1>();

  if (error || !data) {
    console.warn(`[gate1] Could not read candidate ${candidateId}: ${error?.message}`);
    return null;
  }

  const enrichment = data.stage1_result;

  // Derive neighbourhood from address (Kraków-specific heuristics)
  // A full neighbourhood lookup against the neighbourhoods table is Phase 2.
  // For now, extract the district name from the formatted address string.
  const neighborhood = extractNeighborhood(data.address);

  // Compute distance to nearest landmark
  const distanceToLandmark = computeDistanceToNearestLandmark(
    data.lat,
    data.lng,
    cityContext.top_tourist_landmarks
  );

  // Check for local platform presence (Foursquare source = local platform signal)
  const localPlatformPresent = data.sources.some(
    (s) => s.source === "foursquare" || s.source === "local_platform"
  );

  const reviews = (enrichment.recent_reviews ?? []).slice(0, 5).map((r) => ({
    text: r.text.slice(0, 300), // Truncate long reviews to save tokens
    language: r.language,
    rating: r.rating ?? 0,
    is_local_guide: r.is_local_guide,
  }));

  return {
    payload: {
      candidate_id: candidateId,
      name: data.name,
      formatted_address: data.address,
      neighborhood,
      distance_to_nearest_landmark_m: distanceToLandmark,
      rating: enrichment.aggregate_ratings?.google_maps_rating ?? 0,
      review_count: enrichment.aggregate_ratings?.google_maps_review_count ?? 0,
      price_level: enrichment.price_level ?? null,
      recent_reviews: reviews,
      photo_count: 0, // Photo count not stored in Stage 1 enrichment — proxy omitted
      local_platform_present: localPlatformPresent,
      tripadvisor_rank: null, // TripAdvisor rank not available until Stage 3
      early_trap_flag: enrichment.early_trap_flag ?? false,
    },
    isCuratorNomination: data.is_curator_nomination,
  };
}

/**
 * Extracts a neighbourhood name from a formatted address string.
 * Kraków addresses typically follow: "Street Name, District, Kraków, Poland"
 * This is a best-effort heuristic — full neighbourhood verification is Phase 2.
 */
function extractNeighborhood(address: string): string {
  if (!address) return "Unknown";

  // Common Kraków districts that appear in Google Maps addresses
  const krakow_districts = [
    "Stare Miasto",
    "Kazimierz",
    "Podgórze",
    "Nowa Huta",
    "Krowodrza",
    "Zwierzyniec",
    "Prądnik Biały",
    "Prądnik Czerwony",
    "Łagiewniki",
    "Borek Fałęcki",
    "Dębniki",
    "Bronowice",
    "Old Town",
    "Śródmieście",
  ];

  for (const district of krakow_districts) {
    if (address.toLowerCase().includes(district.toLowerCase())) {
      return district;
    }
  }

  // Fallback: extract the second comma-separated segment (often the district)
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 2) return parts[1];

  return "Kraków";
}

/**
 * Returns the distance in metres to the nearest tourist landmark.
 * Returns 99999 if coordinates are missing (safe default — not close to any landmark).
 */
function computeDistanceToNearestLandmark(
  lat: number | null,
  lng: number | null,
  landmarks: Array<{ lat: number; lng: number; name: string }>
): number {
  if (lat === null || lng === null || landmarks.length === 0) return 99999;

  let minDistance = Infinity;
  for (const lm of landmarks) {
    const dLat = ((lat - lm.lat) * Math.PI) / 180;
    const dLng = ((lng - lm.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((lm.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const d = 2 * 6_371_000 * Math.asin(Math.sqrt(a));
    if (d < minDistance) minDistance = d;
  }

  return Math.round(minDistance);
}

// ─────────────────────────────────────────────────────────────────────────────
// Claude API caller
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls Claude with a batch of Gate 1 payloads.
 * Returns parsed Gate1ClaudeResult array or throws on unrecoverable failure.
 *
 * Prompt caching is applied to the system prompt block. [v1.1]
 * The system prompt is identical across all batches — Anthropic caches it,
 * reducing repeated system-prompt token costs by ~90%.
 */
async function callGate1Claude(
  payloads: Gate1CandidatePayload[],
  batchId: string,
  cityContext: CityContext,
  category: Category
): Promise<Gate1ClaudeResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const systemPrompt = gate1SystemPrompt(cityContext.name, cityContext.country, category);
  const userMessage = gate1UserMessage(payloads, batchId);
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
      max_tokens: 4096,
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

  return parseGate1Response(rawText, batchId, payloads.map((p) => p.candidate_id));
}

/**
 * Parses Claude's JSON response for Gate 1.
 * Strips markdown fences if present, then JSON.parse.
 * On parse failure, logs the raw response and throws so the caller can retry
 * with a smaller batch.
 */
function parseGate1Response(
  rawText: string,
  batchId: string,
  expectedIds: string[]
): Gate1ClaudeResult[] {
  // Strip markdown fences if Claude wrapped the response
  const clean = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch (err) {
    console.error(
      `[gate1] JSON parse failed for batch ${batchId}. Raw response (first 500 chars):`,
      rawText.slice(0, 500)
    );
    throw new Error(`Gate 1 Claude response was not valid JSON: ${err}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Gate 1 Claude response was not an array. Got: ${typeof parsed}`);
  }

  // Validate each result has the required fields
  const results: Gate1ClaudeResult[] = [];
  for (const item of parsed) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof item.candidate_id !== "string" ||
      !["pass", "reject", "borderline"].includes(item.result) ||
      typeof item.criteria_triggered !== "number" ||
      !Array.isArray(item.criteria)
    ) {
      console.warn(`[gate1] Malformed result item in batch ${batchId}:`, item);
      continue;
    }
    results.push({
      candidate_id: item.candidate_id,
      result: item.result,
      criteria_triggered: item.criteria_triggered,
      criteria: item.criteria,
      claude_batch_id: batchId,
    });
  }

  // Warn if any expected candidates are missing from the response
  const returnedIds = new Set(results.map((r) => r.candidate_id));
  for (const id of expectedIds) {
    if (!returnedIds.has(id)) {
      console.warn(`[gate1] Candidate ${id} missing from Claude response in batch ${batchId}`);
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch processor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processes one batch of candidates through Gate 1.
 * On Claude API failure or malformed JSON: retries once with batch size 5.
 * If retry also fails: marks each candidate in the batch as failed at gate1.
 *
 * Writes gate1_result to each candidate row immediately after the call.
 */
async function processGate1Batch(
  payloads: Gate1CandidatePayload[],
  cityContext: CityContext,
  category: Category,
  supabase: SupabaseClient
): Promise<Map<string, Gate1ClaudeResult>> {
  const batchId = generateBatchId("gate1");
  const results = new Map<string, Gate1ClaudeResult>();

  let claudeResults: Gate1ClaudeResult[];

  try {
    claudeResults = await callGate1Claude(payloads, batchId, cityContext, category);
  } catch (firstErr) {
    console.warn(
      `[gate1] Batch ${batchId} failed (${payloads.length} candidates). ` +
      `Retrying with batch size ${GATE1_RETRY_BATCH_SIZE}.`,
      firstErr instanceof Error ? firstErr.message : firstErr
    );

    // Retry with smaller batches
    claudeResults = [];
    const smallerBatches = batchArray(payloads, GATE1_RETRY_BATCH_SIZE);

    for (const smallBatch of smallerBatches) {
      const retryBatchId = generateBatchId("gate1-retry");
      try {
        const retryResults = await callGate1Claude(
          smallBatch,
          retryBatchId,
          cityContext,
          category
        );
        claudeResults.push(...retryResults);
      } catch (retryErr) {
        // Both attempts failed — mark each candidate in this small batch as failed
        console.error(
          `[gate1] Retry batch ${retryBatchId} also failed. ` +
          `Marking ${smallBatch.length} candidates as gate1 failures.`,
          retryErr instanceof Error ? retryErr.message : retryErr
        );

        for (const payload of smallBatch) {
          await supabase
            .from("pipeline_candidates")
            .update({
              processing_status: "failed",
              failure_stage: "gate1",
              failure_reason: `Claude API failed after retry: ${
                retryErr instanceof Error ? retryErr.message : String(retryErr)
              }`,
              retry_count: supabase.rpc("increment_retry_count", {
                candidate_id: payload.candidate_id,
              }),
            })
            .eq("id", payload.candidate_id);
        }
      }
    }
  }

  // Write results to DB and build return map
  for (const result of claudeResults) {
    await supabase
      .from("pipeline_candidates")
      .update({ gate1_result: result })
      .eq("id", result.candidate_id);

    results.set(result.candidate_id, result);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: runGate1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs Gate 1 tourist trap detection for a single candidate.
 *
 * Called by processCandidate() in the orchestrator — one candidate at a time.
 * Batching happens inside this function: we accumulate candidates into
 * a batch and flush when the batch is full or the run is complete.
 *
 * Note on batching architecture:
 *   The orchestrator calls processCandidate() sequentially, one candidate at
 *   a time. Gate 1 is most cost-efficient when batched (12 candidates per
 *   Claude call). To reconcile these, Gate 1 uses a module-level batch
 *   accumulator that flushes automatically at GATE1_BATCH_SIZE.
 *
 *   This means runGate1() may not call Claude immediately — it returns the
 *   result from a pending batch flush. The orchestrator does not need to know
 *   about this detail.
 *
 *   The accumulator is flushed at the end of each pipeline run by calling
 *   flushGate1Batch(). The orchestrator calls this after processing all
 *   candidates to ensure no candidates are left in a pending batch.
 */

// Module-level batch accumulator
// Cleared at the start of each pipeline run via resetGate1Accumulator()
let gate1Accumulator: {
  payloads: Gate1CandidatePayload[];
  curatorNominationIds: Set<string>;
  resolvers: Map<string, {
    resolve: (result: Gate1ClaudeResult) => void;
    reject: (err: Error) => void;
  }>;
  cityContext: CityContext | null;
  category: Category | null;
  supabase: SupabaseClient | null;
} = {
  payloads: [],
  curatorNominationIds: new Set(),
  resolvers: new Map(),
  cityContext: null,
  category: null,
  supabase: null,
};

export function resetGate1Accumulator(): void {
  gate1Accumulator = {
    payloads: [],
    curatorNominationIds: new Set(),
    resolvers: new Map(),
    cityContext: null,
    category: null,
    supabase: null,
  };
}

export async function flushGate1Batch(): Promise<void> {
  if (gate1Accumulator.payloads.length === 0) return;
  if (!gate1Accumulator.cityContext || !gate1Accumulator.category || !gate1Accumulator.supabase) {
    return;
  }

  const { payloads, curatorNominationIds, resolvers, cityContext, category, supabase } = gate1Accumulator;
  gate1Accumulator.payloads = [];
  gate1Accumulator.curatorNominationIds = new Set();
  gate1Accumulator.resolvers = new Map();

  const results = await processGate1Batch(payloads, cityContext, category, supabase);

  // Curator nomination threshold adjustment:
  // Standard candidates reject at 2+ criteria. Curator nominations reject at 3+.
  // A curator-nominated place with 2 triggered criteria → borderline (Q1 review)
  // instead of auto-reject, reflecting curator local knowledge.
  for (const [candidateId, result] of results) {
    if (
      curatorNominationIds.has(candidateId) &&
      result.result === "reject" &&
      result.criteria_triggered <= 2
    ) {
      result.result = "borderline";
    }
  }

  for (const [candidateId, resolver] of resolvers) {
    const result = results.get(candidateId);
    if (result) {
      resolver.resolve(result);
    } else {
      resolver.reject(
        new Error(`Gate 1 result missing for candidate ${candidateId} after batch flush`)
      );
    }
  }
}

export async function runGate1(
  candidateId: string,
  cityContext: CityContext,
  category: Category,
  supabase: SupabaseClient
): Promise<Gate1ClaudeResult> {
  // Build the compressed payload for this candidate
  const built = await buildGate1Payload(candidateId, cityContext, supabase);

  if (!built) {
    throw new Error(`Gate 1 could not build payload for candidate ${candidateId}`);
  }

  // Add to accumulator
  gate1Accumulator.payloads.push(built.payload);
  if (built.isCuratorNomination) {
    gate1Accumulator.curatorNominationIds.add(candidateId);
  }
  gate1Accumulator.cityContext = cityContext;
  gate1Accumulator.category = category;
  gate1Accumulator.supabase = supabase;

  // Return a promise that resolves when this candidate's batch is flushed.
  // The batch flushes immediately when full (GATE1_BATCH_SIZE) OR when there's
  // only 1 candidate — the sequential processCandidate loop would deadlock if
  // we waited for more candidates, since the loop awaits each runGate1() call
  // before proceeding to the next candidate.
  const shouldFlush =
    gate1Accumulator.payloads.length >= GATE1_BATCH_SIZE ||
    gate1Accumulator.payloads.length === 1;

  return new Promise((resolve, reject) => {
    gate1Accumulator.resolvers.set(candidateId, { resolve, reject });

    if (shouldFlush) {
      flushGate1Batch().catch((err) => {
        console.error("[gate1] Batch flush failed:", err);
        // Reject all pending resolvers in this batch
        for (const resolver of gate1Accumulator.resolvers.values()) {
          resolver.reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    }
  });
}