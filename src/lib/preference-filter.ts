/**
 * preference-filter.ts — Pure scoring/sorting logic for the preference layer.
 * No React, no side effects. Safe to import in any context.
 */

import type { EntryCardData } from "@/lib/entries";
import type { Interest, TripPreferences } from "@/types/preferences";
import type { Category } from "@/types/pipeline";

export interface ScoredEntry {
  entry: EntryCardData;
  score: number;   // 0–100, higher = more relevant
  reasons: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Maps
// ─────────────────────────────────────────────────────────────────────────────

const INTEREST_CATEGORY_MAP: Record<Interest, Category[]> = {
  food_drink:           ["restaurant", "cafe"],
  architecture_history: ["sight"],
  art_culture:          ["sight", "tour"],
  outdoor_active:       ["tour", "sight"],
  nightlife:            ["nightlife"],
  hidden_gems:          [],
};

const PRICE_MAP: Record<TripPreferences["accommodationStyle"], number[] | null> = {
  budget:    [0, 1],
  mid_range: [1, 2],
  upscale:   [3, 4],
  sorted:    null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function hasTags(entry: EntryCardData, ...tags: string[]): boolean {
  if (!entry.tags) return false;
  return tags.some((t) => entry.tags!.includes(t));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────────────────────

function scoreEntry(entry: EntryCardData, prefs: TripPreferences): { score: number; reasons: string[] } {
  let score = 50;
  const reasons: string[] = [];

  // 1. Interest matching (+15 per match, up to +30; hidden_gems tag gets +20)
  let interestBoost = 0;
  for (const interest of prefs.interests) {
    if (interest === "hidden_gems") {
      if (hasTags(entry, "hidden_gem")) {
        interestBoost += 20;
        reasons.push("Hidden gem");
      }
    } else {
      const matchingCategories = INTEREST_CATEGORY_MAP[interest];
      if (matchingCategories.includes(entry.category)) {
        interestBoost += 15;
        const label =
          interest === "food_drink" ? "Food & drink" :
          interest === "architecture_history" ? "Architecture & history" :
          interest === "art_culture" ? "Art & culture" :
          interest === "outdoor_active" ? "Outdoor & active" :
          "Nightlife";
        reasons.push(`Matches ${label} interest`);
      }
    }
  }
  score += clamp(interestBoost, 0, 30);

  // 2. Pace adjustment
  if (prefs.pace === "relaxed") {
    if (hasTags(entry, "slow_travel", "neighbourhood_gem")) {
      score += 10;
      reasons.push("Great for a relaxed pace");
    }
    if (hasTags(entry, "must_see", "popular")) {
      score -= 5;
    }
  } else if (prefs.pace === "packed") {
    if (hasTags(entry, "essential", "iconic")) {
      score += 10;
      reasons.push("Essential stop");
    }
  }

  // 3. Group size
  if (prefs.groupSize === "solo") {
    if (hasTags(entry, "solo_friendly")) {
      score += 10;
      reasons.push("Great for solo travellers");
    }
    if (hasTags(entry, "best_for_groups")) {
      score -= 5;
    }
  } else if (prefs.groupSize === "couple") {
    if (hasTags(entry, "romantic", "date_night")) {
      score += 10;
      reasons.push("Great for couples");
    }
  } else if (prefs.groupSize === "small_group" || prefs.groupSize === "larger_group") {
    if (hasTags(entry, "good_for_groups")) {
      score += 10;
      reasons.push("Good for groups");
    }
  }

  // 4. Accommodation style → price level alignment
  const preferredPriceLevels = PRICE_MAP[prefs.accommodationStyle];
  if (preferredPriceLevels !== null && entry.price_level !== null) {
    if (preferredPriceLevels.includes(entry.price_level)) {
      score += 10;
      reasons.push("Fits your budget");
    }
  }

  // 5. Trip style
  if (prefs.tripStyle === "wander") {
    if (hasTags(entry, "neighbourhood_gem", "off_the_beaten_path")) {
      score += 10;
      reasons.push("Off the beaten path");
    }
  } else if (prefs.tripStyle === "planned") {
    if (hasTags(entry, "essential", "book_ahead")) {
      score += 10;
      reasons.push("Worth booking ahead");
    }
  }

  return { score: clamp(score, 0, 100), reasons };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function applyPreferences(
  entries: EntryCardData[],
  preferences: TripPreferences | null
): ScoredEntry[] {
  if (preferences === null) {
    return entries.map((entry) => ({ entry, score: 50, reasons: [] }));
  }

  const scored = entries.map((entry, index) => {
    const { score, reasons } = scoreEntry(entry, preferences);
    return { entry, score, reasons, _originalIndex: index };
  });

  // Stable sort descending by score — entries with equal scores keep original order
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a._originalIndex - b._originalIndex;
  });

  return scored.map(({ entry, score, reasons }) => ({ entry, score, reasons }));
}
