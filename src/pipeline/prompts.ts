/**
 * prompts.ts — All Claude prompt templates for the Sonder generation pipeline.
 *
 * Three gates use Claude:
 *   Gate 1  — Tourist trap detection (pass/fail binary)
 *   Gate 2  — Quality scoring (0-100)
 *   Stage 4 — Editorial generation (full and minimal tiers)
 *
 * Architecture notes:
 *   - Every system prompt is returned as a separate string so the caller can apply
 *     cache_control: { type: "ephemeral" } on the system message block. [v1.1]
 *   - User message (candidate batch) is always separate from the system prompt.
 *   - Gate 1 uses compressed Gate1CandidatePayload (~350-450 tokens/candidate). [v1.1]
 *   - Stage 4 has two tiers: full (72+) and minimal (65-71). [v1.1]
 */

import type { Category, Season } from "@/types/pipeline";

// ---------------------------------------------------------------------------
// Input payload types
// ---------------------------------------------------------------------------

/** Compressed payload sent to Gate 1. Tourist-trap-relevant fields only. [v1.1] */
export interface Gate1CandidatePayload {
  candidate_id: string;
  name: string;
  formatted_address: string;
  neighborhood: string;
  distance_to_nearest_landmark_m: number;
  rating: number;
  review_count: number;
  price_level: number | null;
  recent_reviews: Array<{
    text: string;
    language: string;
    rating: number;
    is_local_guide: boolean;
  }>;
  photo_count: number;
  local_platform_present: boolean;
  tripadvisor_rank: number | null;
  early_trap_flag: boolean;
}

/** Full candidate payload sent to Gate 2. */
export interface Gate2CandidatePayload {
  candidate_id: string;
  name: string;
  formatted_address: string;
  neighborhood: string;
  rating: number;
  review_count: number;
  price_level: number | null;
  recent_reviews: Array<{
    text: string;
    language: string;
    rating: number;
    is_local_guide: boolean;
    review_date: string;
  }>;
  editorial_mentions: Array<{
    source_name: string;
    source_tier: 1 | 2 | 3 | 4;
    excerpt: string | null;
  }>;
  local_platform_present: boolean;
  local_platform_name: string | null;
  tripadvisor_rank: number | null;
  gate1_borderline: boolean;
  gate1_criteria_triggered: number;
}

/** Payload sent to Stage 4 full editorial (72+ score). */
export interface Stage4FullPayload {
  candidate_id: string;
  name: string;
  category: Category;
  neighborhood: string;
  gate2_score: number;
  recent_reviews: Array<{
    text: string;
    language: string;
    rating: number;
    is_local_guide: boolean;
    review_date: string;
  }>;
  editorial_mentions: Array<{
    source_name: string;
    source_tier: 1 | 2 | 3 | 4;
    excerpt: string | null;
  }>;
  opening_hours_text: string | null;
  website: string | null;
  /** If false, seasonal_scores were computed by rules — omit from output. */
  seasonal_scoring_required: boolean;
  tags_from_gate2?: string[];
}

/** Payload sent to Stage 4 minimal editorial (65-71 score). */
export interface Stage4MinimalPayload {
  candidate_id: string;
  name: string;
  category: Category;
  neighborhood: string;
  gate2_score: number;
  gate2_components: Array<{
    criterion: string;
    score: number;
    max_score: number;
    rationale: string;
  }>;
  recent_reviews: Array<{
    text: string;
    language: string;
    rating: number;
  }>;
  editorial_mentions: Array<{
    source_name: string;
    source_tier: 1 | 2 | 3 | 4;
    excerpt: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Gate 2 category criteria blocks
// ---------------------------------------------------------------------------

export function gate2CriteriaBlock(category: Category): string {
  switch (category) {
    case "restaurant":
      return `- review_consensus (quality + frequency): max 20 pts
  Weight local-language reviews equally with English.
  50 Polish reviews averaging 4.8 beats 500 English averaging 3.9.
- consistency (low variance, past 12 months): max 15 pts
- specificity_of_praise (dish-level detail, not generic): max 20 pts
  "The rosol is made fresh every morning and sells out by noon" > "great food".
- editorial_signals (press mentions, awards, food guides): max 10 pts
- local_credibility (Polish-language platform presence, Local Guide reviews): max 20 pts
- recency (active presence in past 90 days): max 10 pts
- uniqueness (city-specific, not replicable elsewhere): max 5 pts`;

    case "accommodation":
      return `- character_and_design (distinct personality, not generic chain aesthetic): max 25 pts
- review_consensus (aggregate rating weighted by volume): max 20 pts
- value_alignment (price-to-experience ratio within its tier): max 20 pts
- consistency (reliability across guests): max 15 pts
- repeat_visitor_credibility (repeat guests, business traveller loyalty, travel community recommendations — hotels are tourist-facing by nature, so local resident absence is not a negative signal): max 5 pts
- recency (current operational status confirmed — ignore future-dated reviews, which are a data artifact, not an operational signal; score based on the most recent plausible reviews only): max 10 pts
- uniqueness (something a standard hotel cannot offer): max 5 pts`;

    case "tour":
      return `- tour_quality (route, content, pacing, storytelling): max 25 pts
- guide_quality (named guides praised specifically in reviews): max 30 pts
  Named, specific praise > generic "great guide".
- review_consensus (aggregate rating weighted by volume): max 20 pts
- local_credibility (run by locals, not international franchise operators): max 15 pts
- uniqueness (access or insight not available on standard tours): max 10 pts`;

    case "sight":
      return `- intrinsic_experience_quality (worth visiting on its own terms): max 25 pts
- crowd_to_reward_ratio (experience quality relative to crowds): max 20 pts
- curation_value_add (platform adds insight beyond what Google says): max 20 pts
  "Go Tuesday at 9am -- the light through the east window is extraordinary" = max.
- practical_visitability (hours, access, cost clarity): max 20 pts
- local_credibility (visited by locals, not only tourists): max 15 pts`;

    case "cafe":
      return `- character_and_design (atmosphere, interior, space personality): max 25 pts
  A cafe's space is core to its identity. Generic fitout scores low.
- review_consensus (aggregate rating weighted by volume): max 15 pts
- local_credibility (Polish-language platform presence, Local Guide reviews, neighbourhood regulars): max 25 pts
- specificity_of_praise (named coffee method, specific pastry, roaster provenance): max 15 pts
  "They roast their own beans and the V60 is exceptional" > "good coffee".
- value_alignment (price-to-quality ratio for the neighbourhood): max 10 pts
- recency (active presence in past 90 days): max 5 pts
- uniqueness (own roastery, signature method, pastry programme not found elsewhere): max 5 pts`;

    case "nightlife":
      return `- atmosphere_and_experience (venue character, music, physical space): max 25 pts
- local_credibility (patronised by locals, not tourist-facing): max 25 pts
- drink_and_music_quality (craft programme, live music, wine selection): max 15 pts
- safety_and_comfort (reviewers feel safe, staff professional): max 15 pts
- value_alignment (fair pricing for what is delivered): max 10 pts
- uniqueness (not replicable elsewhere in the city): max 10 pts`;
  }
}

// ---------------------------------------------------------------------------
// Gate 1 prompts
// ---------------------------------------------------------------------------

export function gate1SystemPrompt(
  cityName: string,
  country: string,
  category: Category
): string {
  return `You are a curation specialist evaluating candidates for a curated travel platform focused on ${cityName}, ${country}.

Your task: identify tourist traps before quality scoring. Assess each candidate against exactly 8 criteria. Return structured JSON only -- no preamble, no explanation outside the JSON.

CATEGORY BEING EVALUATED: ${category.toUpperCase()}

TOURIST TRAP CRITERIA:

1. location_dependency
Does this place's popularity depend primarily on its proximity to a major tourist site rather than its own quality?

2. price_inflation
Are prices significantly above local market rate without corresponding quality? 40%+ above comparable establishments without a quality reason.

3. review_bifurcation
Do reviews split sharply between high-rating tourists and low-rating locals? Bimodal distribution, negative reviews mentioning "tourist trap", "overpriced", "rude to tourists".

4. local_absence
Is there evidence that locals do not patronise this place? No local-language reviews, absent from local platforms, no Local Guide reviews.

5. menu_red_flags
[RESTAURANTS ONLY -- score false for other categories]
Generic tourist menus, picture menus, aggressive touts, "traditional" dishes locals do not eat.
[CAFES: score false for menu_red_flags -- cafes do not have menus in the traditional sense.]

6. homogenized_experience
Could this experience exist in any European tourist city without modification? No city-specific character, interchangeable with venues in Prague, Budapest, or Vienna.
[CAFES: only trigger if this is a chain cafe (e.g. international franchise). Independent specialty cafes with a similar aesthetic across cities are not homogenized.]

7. manufactured_authenticity
Is the "local" or "traditional" framing performed rather than genuine? Folk costumes, "Authentic" in the name, cultural cliches for tourist consumption.

8. platform_local_disconnect
High TripAdvisor or Google rank among tourists, absent from local-language platforms and food blogs?

THRESHOLD RULES:
- 0 criteria triggered: pass
- 1 criterion triggered: borderline (enters Gate 2, flagged for curator review)
- 2+ criteria triggered: reject

OVERRIDE RULE:
A place adjacent to a major landmark CAN pass if there is specific evidence it predates the tourism boom by 20+ years AND maintains genuine local clientele. Document in evidence.

NOTE: If early_trap_flag: true, apply heightened scrutiny.

RESPONSE FORMAT:
[
  {
    "candidate_id": "string",
    "result": "pass" | "reject" | "borderline",
    "criteria_triggered": number,
    "criteria": [
      {
        "criterion": "location_dependency" | "price_inflation" | "review_bifurcation" | "local_absence" | "menu_red_flags" | "homogenized_experience" | "manufactured_authenticity" | "platform_local_disconnect",
        "triggered": boolean,
        "evidence": "Specific evidence. 'Tourist trap vibes' is unacceptable. 'No Polish-language reviews; absent from Zomato Poland; 3 of 5 reviews cite Castle view as only reason they visited' is acceptable."
      }
    ],
    "claude_batch_id": "BATCH_ID_PLACEHOLDER"
  }
]

Return only the JSON array. No markdown. No explanation. No preamble.`;
}

export function gate1UserMessage(
  candidates: Gate1CandidatePayload[],
  batchId: string
): string {
  return `Evaluate the following ${candidates.length} candidate(s). Replace every "BATCH_ID_PLACEHOLDER" with "${batchId}".

CANDIDATES:
${JSON.stringify(candidates, null, 2)}`;
}

// ---------------------------------------------------------------------------
// Gate 2 prompts
// ---------------------------------------------------------------------------

export function gate2SystemPrompt(
  cityName: string,
  country: string,
  category: Category
): string {
  return `You are a quality scoring specialist for a curated travel platform focused on ${cityName}, ${country}.

Your task: score each candidate 0-100 against the criteria below. Return structured JSON only.

CATEGORY: ${category.toUpperCase()}

PRE-SCORING CHECK — TOURIST TRAP DETECTION
Before scoring, examine the full review set for tourist trap signals.
A candidate is a confirmed tourist trap if THREE OR MORE of these signals are present:
- Majority of reviews are in non-local language (not Polish for ${cityName})
- Reviews use coached or templated phrasing across multiple reviewers
- Reviewer profiles are homogeneous (all tourists, no local guides)
- Sudden review volume spike with no operational history
- Named as a booking aggregator or reseller, not an actual operator

If THREE OR MORE signals present:
  tourist_trap_confirmed: true
  total_score: 0
  passed: false
  Do not score criteria. Set tourist_trap_reason explaining which signals were detected.

If fewer than THREE signals:
  tourist_trap_confirmed: false
  tourist_trap_reason: null
  Proceed to scoring normally.

SCORING CRITERIA AND WEIGHTS:
${gate2CriteriaBlock(category)}

UNIVERSAL SCORING RULES:
1. Weight local-language reviews equally with English. 50 Polish reviews averaging 4.8 beats 500 English averaging 3.9.
2. Specificity beats volume. Ten reviews naming specific dishes > 100 reviews saying "great place".
3. Recency matters. Reviews ending 3 years ago score lower than 40 reviews in the past 90 days.
4. For gate1_borderline: true candidates, apply normal scoring.

SOUL EXCEPTION RULE:
If a candidate scores 55-64 AND you detect highly emotional, specific language across multiple independent reviewers ("one of a kind", "changed how I think about", "nothing like it anywhere") -- flag it:
  soul_exception_flagged: true
  soul_exception_justification: one sentence naming the signal and reviewer count.
The soul exception is rare. Generic positive sentiment does not qualify.

BOOKING TIER: Assign based on price_level from Google Maps data provided.
- price_level 1 (Inexpensive) → booking_tier 1
- price_level 2 (Moderate) → booking_tier 2
- price_level 3 (Expensive) → booking_tier 3
- price_level 4 (Very Expensive) → booking_tier 4
- price_level null or 0 → infer from review language:
  explicit "hostel", "dorm", "budget" → tier 1
  "luxury", "5-star", brand names like "Luxury Collection", "Marriott", "Hilton" → tier 4
  premium boutique language without budget signals → tier 3
  everything else → tier 2

PASS THRESHOLD: 65+ passes. 55-64 borderline (check soul exception). Below 55 rejects.

RESPONSE FORMAT:
[
  {
    "candidate_id": "string",
    "tourist_trap_confirmed": boolean,
    "tourist_trap_reason": "string or null",
    "total_score": number,
    "passed": boolean,
    "soul_exception_flagged": boolean,
    "soul_exception_justification": "string or null",
    "booking_tier": 1 | 2 | 3 | 4,
    "components": [
      {
        "criterion": "string",
        "score": number,
        "max_score": number,
        "rationale": "Specific reasoning. Name the reviews or signals."
      }
    ],
    "claude_batch_id": "BATCH_ID_PLACEHOLDER"
  }
]

Return only the JSON array. No markdown. No explanation. No preamble.`;
}

export function gate2UserMessage(
  candidates: Gate2CandidatePayload[],
  batchId: string
): string {
  return `Score the following ${candidates.length} candidate(s). Replace every "BATCH_ID_PLACEHOLDER" with "${batchId}".

CANDIDATES:
${JSON.stringify(candidates, null, 2)}`;
}

// ---------------------------------------------------------------------------
// Stage 4 prompts -- Full editorial (72+)
// ---------------------------------------------------------------------------

export function stage4FullSystemPrompt(
  cityName: string,
  country: string,
  currentSeason: Season
): string {
  return `You are writing editorial content for a curated travel platform focused on ${cityName}, ${country}.

Content is reviewed by a human curator before publication. Write for the curator to approve: specific, honest, insider-facing. Generic content will be rejected.

CURRENT SEASON: ${currentSeason.toUpperCase()}

PLATFORM VOICE:
CORRECT: "Get the rosol on cold days, the kitchen makes it every morning and runs out by 1pm"
WRONG: "A great place for traditional Polish food"

Do not fabricate details. Do not claim "best in the city" unless multiple independent reviewers say so explicitly.

CAFE ENTRIES:
- what_to_order should prioritize the signature coffee method or standout pastry
- insider_tip should focus on when to visit, what to order, how to navigate the space
- why_it_made_the_cut should reference the specific quality signal (roaster, pastry provenance, local reputation)

FIELD RULES:

insider_tip: 1-2 sentences. Must contain at least one specific, verifiable detail from the review data.

what_to_order: Only populate if 3+ independent reviews name the same specific item. Return null if no clear standout.

what_to_order_source_excerpts: Exact review fragments that generated what_to_order. 2-3 excerpts, 1 sentence each. Return [] if what_to_order is null.

why_it_made_the_cut: One sentence. The concrete quality signal that justified inclusion.
CORRECT: "Consistent local-language praise for the tasting menu across 40+ Polish reviews, plus a 2024 Michelin Bib Gourmand."
WRONG: "A good restaurant with quality food."
why_it_made_the_cut is user-facing copy. Never reference internal scores, gates, or criteria (e.g. no "scored 78/100", "Gate 2", "14/20", "soul exception", "borderline", "criterion", "flagged"). Write as editorial voice speaking to a traveler.
why_it_made_the_cut must read as a confident editorial statement, not a scoring justification. "A rare Kazimierz spot where the kitchen genuinely earns its reputation, locals return for the żurek, not the atmosphere" is correct. "Scored well on review consensus and local platform presence" is wrong and will be rejected.

suggested_tags: Choose only from: authentic, new, skip_it, soul_exception, small_bite, essential, deeper_cut, hidden_gem, local_niche, boutique, great_value, unique_stay
- small_bite: apply to cafe entries that serve substantive food beyond pastries (e.g. soups, sandwiches, eggs, salads). Signals the entry is eligible for a light lunch slot in itinerary building, not just breakfast/coffee.

seasonal_scores: ONLY include if seasonal_scoring_required: true. If false, omit entirely.
  5 = ideal. 3 = acceptable. 1 = not recommended / not operational.

closure_pattern: Extract from opening hours and review mentions.
  closed_days: day numbers (0=Sunday, 6=Saturday)
  reduced_hours_days, reduced_hours_note, weekend_only, weekday_only, seasonal_closure_note

article_topic_suggestions: 2-3 specific article topics this entry could anchor.
  "The best milk bars still operating in Krakow's Kazimierz" is correct.
  "Best restaurants in Krakow" is too generic.

- Never mention staff, employees, or individuals by name (e.g. "ask for Maria", "the owner Piotr"). Insider tips must be about the place, not the people. Exception: tour entries may mention a named guide if they are the sole operator and their name is the primary way to book.
- Never use em dashes, en dashes, or double hyphens (--) in any output. Use commas, colons, or rewrite the sentence instead.  

RESPONSE FORMAT:
[
  {
    "candidate_id": "string",
    "insider_tip": "string",
    "what_to_order": "string | null",
    "what_to_order_source_excerpts": ["string"],
    "why_it_made_the_cut": "string",
    "suggested_tags": ["string"],
    "seasonal_scores": { "spring": 1-5, "summer": 1-5, "autumn": 1-5, "winter": 1-5 } | null,
    "closure_pattern": {
      "closed_days": [number],
      "reduced_hours_days": [number],
      "reduced_hours_note": "string | null",
      "weekend_only": boolean,
      "weekday_only": boolean,
      "seasonal_closure_note": "string | null"
    },
    "article_topic_suggestions": ["string"]
  }
]

Return only the JSON array. No markdown. No explanation. No preamble.`;
}

export function stage4FullUserMessage(candidates: Stage4FullPayload[]): string {
  return `Generate full editorial content for the following ${candidates.length} candidate(s).

For candidates where seasonal_scoring_required is false, omit seasonal_scores entirely.

CANDIDATES:
${JSON.stringify(candidates, null, 2)}`;
}

// ---------------------------------------------------------------------------
// Stage 4 prompts -- Minimal editorial (65-71)
// ---------------------------------------------------------------------------

export function stage4MinimalSystemPrompt(cityName: string, country: string): string {
  return `You are writing a one-sentence curation justification for a travel platform focused on ${cityName}, ${country}.

A human curator uses this sentence to decide whether to approve or reject a candidate that narrowly passed the quality gate. Articulate the specific quality signal that got this candidate through. Not a sales pitch.

- Never use em dashes, en dashes, or double hyphens (--). Use commas or colons instead.

CORRECT: "Passed on the strength of consistent local-language praise across 40+ Polish reviews and a 2024 Michelin Bib Gourmand nomination."
CORRECT: "A neighbourhood bar with zero tourist platform presence but recurring mentions in Polish nightlife communities. Local credibility was the deciding factor."
WRONG: "A good restaurant with quality food and friendly service."

The sentence must name the specific signal(s) that tipped the score above 65. Use gate2_components to identify what scored highest.
why_it_made_the_cut is user-facing. Never reference scores, gates, or internal criteria. Write as editorial voice, not a scoring summary.

RESPONSE FORMAT:
[
  {
    "candidate_id": "string",
    "why_it_made_the_cut": "string"
  }
]

Return only the JSON array. No markdown. No explanation. No preamble.`;
}

export function stage4MinimalUserMessage(candidates: Stage4MinimalPayload[]): string {
  return `Write a why_it_made_the_cut justification for the following ${candidates.length} candidate(s).

Use gate2_components rationale to identify the specific signals that drove the score above 65.

CANDIDATES:
${JSON.stringify(candidates, null, 2)}`;
}

// ---------------------------------------------------------------------------
// Anthropic API message shape helper
// ---------------------------------------------------------------------------

/**
 * Constructs system + messages arrays with prompt caching on the system block. [v1.1]
 *
 * cache_control: { type: "ephemeral" } caches the system prompt tokens across
 * requests in the same pipeline run, reducing repeated system-prompt costs by ~90%.
 *
 * Usage:
 *   const { system, messages } = buildCachedMessages(systemPrompt, userMessage);
 *   await anthropic.messages.create({ model, max_tokens, system, messages });
 */
export function buildCachedMessages(
  systemPrompt: string,
  userMessage: string
): {
  system: Array<{ type: "text"; text: string; cache_control: { type: "ephemeral" } }>;
  messages: Array<{ role: "user"; content: string }>;
} {
  return {
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  };
}