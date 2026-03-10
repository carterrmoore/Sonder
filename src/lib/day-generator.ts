/**
 * day-generator.ts — Pure function for auto-populating itinerary days.
 * No React, no side effects. Deterministic given the same inputs.
 */

import type { ScoredEntry } from "@/lib/preference-filter";
import type { ItineraryDay, ItinerarySlot, TimeBlock } from "@/types/itinerary";
import type { Category } from "@/types/pipeline";
import type { EntryCardData } from "@/lib/entries";

const TIMEBLOCK_CATEGORY_AFFINITY: Record<TimeBlock, Category[]> = {
  morning:   ["cafe", "sight", "tour"],
  afternoon: ["sight", "tour", "restaurant"],
  evening:   ["restaurant", "nightlife"],
};

const TIME_BLOCKS: TimeBlock[] = ["morning", "afternoon", "evening"];

function buildSlot(
  entry: EntryCardData,
  timeBlock: TimeBlock,
  citySlug: string
): ItinerarySlot {
  return {
    id: crypto.randomUUID(),
    entryId: entry.id,
    timeBlock,
    notes: null,
    entrySnapshot: {
      name: entry.name,
      category: entry.category,
      neighbourhood: entry.neighbourhood,
      editorial_hook: entry.editorial_hook,
      slug: entry.slug,
      citySlug,
    },
  };
}

export function generateDays(
  tripLength: number,
  arrival: string | null,
  scoredEntries: ScoredEntry[],
  citySlug: string
): ItineraryDay[] {
  // Exclude accommodation — don't put hotels in day plans
  const pool = scoredEntries.filter((se) => se.entry.category !== "accommodation");

  const placed = new Set<string>(); // entry IDs already assigned
  const days: ItineraryDay[] = [];

  for (let i = 0; i < tripLength; i++) {
    let date: string | null = null;
    if (arrival) {
      const d = new Date(arrival + "T00:00:00");
      d.setDate(d.getDate() + i);
      date = d.toISOString().slice(0, 10);
    }

    const slots: ItinerarySlot[] = [];
    const remaining = pool.filter((se) => !placed.has(se.entry.id));

    if (remaining.length > 0) {
      // Group remaining by neighbourhood
      const byNeighbourhood = new Map<string, ScoredEntry[]>();
      for (const se of remaining) {
        const n = se.entry.neighbourhood ?? "__none__";
        const bucket = byNeighbourhood.get(n) ?? [];
        bucket.push(se);
        byNeighbourhood.set(n, bucket);
      }

      // Pick neighbourhood with the most high-scored unplaced entries
      let topNeighbourhood = "__none__";
      let topCount = 0;
      for (const [n, bucket] of byNeighbourhood) {
        if (bucket.length > topCount) {
          topCount = bucket.length;
          topNeighbourhood = n;
        }
      }
      const topPool = byNeighbourhood.get(topNeighbourhood) ?? [];

      // Assign 1 entry per time block
      for (const block of TIME_BLOCKS) {
        const affinities = TIMEBLOCK_CATEGORY_AFFINITY[block];

        // 1. Affinity match from top neighbourhood
        let pick = topPool.find(
          (se) => !placed.has(se.entry.id) && affinities.includes(se.entry.category)
        );
        // 2. Any entry from top neighbourhood not yet placed
        if (!pick) pick = topPool.find((se) => !placed.has(se.entry.id));
        // 3. Affinity match from anywhere in the full pool
        if (!pick) {
          pick = remaining.find(
            (se) => !placed.has(se.entry.id) && affinities.includes(se.entry.category)
          );
        }
        // 4. Any remaining entry from the full pool, any category.
        //    `remaining` is all unplaced entries across every previous day;
        //    the !placed.has() guard also excludes slots placed earlier in this day.
        if (!pick) pick = remaining.find((se) => !placed.has(se.entry.id));
        // If still nothing: the pool is exhausted — slot legitimately stays empty.
        // This only happens when total entries < total slots.

        if (pick) {
          placed.add(pick.entry.id);
          slots.push(buildSlot(pick.entry, block, citySlug));
        }
      }
    }

    days.push({ dayNumber: i + 1, date, slots });
  }

  return days;
}
