/**
 * language-config.ts
 *
 * Types for language-aware dynamic search query generation.
 * Imported by stage1-search-queries.ts (buildSearchQueries) and stage1.ts
 * (which fetches and assembles CityContext from Supabase before discovery runs).
 *
 * CityContext extends the base CityContext from utils.ts so that the same object
 * satisfies earlyTouristTrapSignals (base fields) and buildSearchQueries
 * (language fields).
 */

import type { Category } from "@/types/pipeline";
import type { CityContext as BaseCityContext } from "@/pipeline/utils";

export type LocalTermsMap = Partial<Record<Category, string[]>>;

export interface CityContext extends BaseCityContext {
  city_name_en: string;
  city_name_local: string;
  local_terms: LocalTermsMap;
  local_term_overrides: LocalTermsMap;
}

export async function fetchCityContext(
  cityId: string,
  supabase: import("@supabase/supabase-js").SupabaseClient
): Promise<CityContext> {
  const { data, error } = await supabase
    .from("cities")
    .select(`
      id,
      display_name,
      city_name_local,
      country,
      city_context,
      local_term_overrides,
      language_configs (
        local_terms
      )
    `)
    .eq("id", cityId)
    .single();

  if (error || !data) {
    throw new Error(
      `[fetchCityContext] City not found: ${cityId}. ${error?.message ?? ""}`
    );
  }

  const langConfig = (data as any).language_configs as
    | { local_terms: LocalTermsMap }
    | null;

  return {
    // Base CityContext fields (utils.ts)
    id:                    data.id,
    name:                  data.display_name,
    country:               (data as any).country ?? "",
    top_tourist_landmarks: (data as any).city_context?.top_tourist_landmarks ?? [],
    // Extended language fields
    city_name_en:          data.display_name,
    city_name_local:       (data as any).city_name_local ?? data.display_name,
    local_terms:           langConfig?.local_terms ?? {},
    local_term_overrides:  (data as any).local_term_overrides ?? {},
  };
}
