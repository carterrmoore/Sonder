/**
 * stage1-search-queries.ts
 *
 * Dynamic search query generation for Stage 1 candidate discovery.
 * Replaces the hardcoded SEARCH_QUERIES and DISCOVERY_TARGETS constants
 * previously in stage1.ts.
 */

import type { Category } from "@/types/pipeline";
import type { CityContext } from "@/types/language-config";

export const BASE_QUERIES: Record<Category, string[]> = {
  restaurant: [
    "best local restaurants {city}",
    "authentic cuisine {city}",
    "traditional food {city}",
    "local dining {city}",
    "neighbourhood restaurants {city}",
    "hidden gem restaurants {city}",
  ],
  cafe: [
    "best cafes {city}",
    "specialty coffee {city}",
    "coffee shops {city}",
    "bakery cafe {city}",
    "brunch cafe {city}",
  ],
  accommodation: [
    "boutique hotels {city}",
    "best hostels {city}",
    "guesthouses {city}",
    "apartments {city}",
    "bed and breakfast {city}",
  ],
  tour: [
    "guided walking tours {city}",
    "private guided tours {city}",
    "food tours {city}",
    "historical tours {city}",
    "Jewish heritage tours {city}",
    "communist tour {city}",
    "local tour guides {city}",
    "bike tours {city}",
    "day trip tours from {city}",
  ],
  sight: [
    "attractions {city}",
    "museums {city}",
    "historic sites {city}",
    "things to see {city}",
    "galleries {city}",
    "churches {city}",
  ],
  nightlife: [
    "bars {city}",
    "nightlife {city}",
    "cocktail bars {city}",
    "jazz bars {city}",
    "wine bars {city}",
    "live music {city}",
  ],
};

export const DISCOVERY_TARGETS: Record<Category, number> = {
  restaurant:    60,
  cafe:          30,
  accommodation: 30,
  tour:          25,
  sight:         30,
  nightlife:     35,
};

export function buildSearchQueries(
  category: Category,
  cityContext: CityContext
): string[] {
  const { city_name_en, city_name_local, local_terms, local_term_overrides } =
    cityContext;

  const englishQueries = (BASE_QUERIES[category] ?? []).map((q) =>
    q.replace("{city}", city_name_en)
  );

  const baseTerms: string[]     = local_terms[category]          ?? [];
  const overrideTerms: string[] = local_term_overrides[category] ?? [];
  const mergedTerms = Array.from(new Set([...baseTerms, ...overrideTerms]));
  const localQueries = mergedTerms.map((term) => `${term} ${city_name_local}`);

  return Array.from(new Set([...englishQueries, ...localQueries]));
}
