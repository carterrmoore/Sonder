/**
 * preferences.ts
 *
 * Shared TypeScript contract for the preference layer → itinerary builder data shape.
 *
 * USAGE
 * Both the preference layer (Phase 2) and the itinerary builder (Phase 2) import from
 * this file. It is the single source of truth for the shape of the `preferences` jsonb
 * column on the `preference_sessions` table. Any change to this file requires a
 * coordinated update to both consumers.
 *
 * LOCATION
 * /types/preferences.ts  (monorepo root — imported by both web and pipeline packages)
 *
 * VERSIONING
 * Increment PREFERENCES_VERSION whenever the shape changes in a breaking way.
 * Every preference_sessions record written to the database should store this version
 * in the preferences jsonb payload to identify sessions that may need re-evaluation
 * if the data shape changes.
 *
 * References:
 *   prd-preference-layer.md (Data Model section — source of truth for these types)
 *   prd-itinerary-builder-v2.md (consumer of TripPreferences)
 *   schema.sql (preference_sessions table, itineraries.preference_session_id FK)
 *   project-guide-v3.md (Phase 1a — shared type files must be exported before any UI)
 */

export const PREFERENCES_VERSION = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Primitive / shared types
// ─────────────────────────────────────────────────────────────────────────────

/** ISO 8601 date string (date only), e.g. "2026-06-15" */
export type ISODateString = string;

/** ISO 8601 datetime string, e.g. "2026-06-15T14:00:00+02:00" */
export type ISODateTimeString = string;

export type TravelStyle =
  | "slow_cultural"
  | "active_adventurous"
  | "food_wine"
  | "classic_highlights";

export type BudgetTier =
  | "lean"
  | "comfortable"
  | "treat_ourselves"
  | "no_limits"
  | "show_everything"; // "show_everything" = no budget filter applied

export type TripBucket =
  | "quick"        // 1–2 days
  | "long_weekend" // 3–4 days
  | "full_week"    // 5–7 days
  | "extended";    // 8+ days

export type Season = "spring" | "summer" | "autumn" | "winter";

export type TimeOfDay = "morning" | "afternoon" | "evening";

export type DateMode = "specific" | "months" | "seasons";

export type TripLengthMode = "specific" | "bucket";

export type LimitedDayReason = "trip_rounding" | "transit";

export type GroupType =
  | "solo"
  | "couple"
  | "adults"           // any group of adults needing separate accommodation
  | "family"
  | "multi_generational";

export type MultiGenSize = "small" | "medium" | "large";

// ─────────────────────────────────────────────────────────────────────────────
// Limited day
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A partial day — from trip length rounding or transit between cities.
 * The itinerary builder receives this as typed data, not a raw day count.
 *
 * Examples:
 *   - A 4.5-day trip → 5 days, day 5 is a LimitedDay with 4–5 available hours
 *   - A transit day in a multi-city trip → LimitedDay with available_hours
 *     calculated from arrival time and reason = "transit"
 */
export interface LimitedDay {
  /** 1-indexed within this city's days */
  day_number: number;

  /** Hours available for activities on this day */
  available_hours: number;

  /**
   * Which time-of-day windows are available.
   * A transit arrival at 14:00 → ["afternoon", "evening"].
   * A morning departure → ["morning"].
   */
  time_of_day: TimeOfDay[];

  /** Why this is a limited day */
  reason: LimitedDayReason;

  /** ISO datetime; set only when reason = "transit" */
  transit_arrival_time: ISODateTimeString | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-city preferences
// ─────────────────────────────────────────────────────────────────────────────

/**
 * City-specific preferences collected in Questions 1, 2, and 4.
 * One entry per city in a single-city trip; one entry per city in a multi-city trip.
 *
 * Multi-city note: visitor_experience and trip length are per-city because a
 * returning visitor to one city should not have first-timer preferences applied
 * just because they're a first-timer in another city.
 */
export interface CityPreference {
  /** Matches cities.id in the database */
  city_id: string;

  /** 1-indexed; used for multi-city ordering in the itinerary builder */
  sequence_order: number;

  // ── Q1: Dates for this city ──────────────────────────────────────────────

  /** How the user specified their dates for this city */
  date_mode: DateMode;

  /** ISO date; set only when date_mode = "specific" */
  arrival_date: ISODateString | null;

  /** ISO date; set only when date_mode = "specific" */
  departure_date: ISODateString | null;

  /**
   * Month numbers (1–12); set only when date_mode = "months".
   * Multiple months allowed (non-adjacent is treated same as adjacent).
   */
  selected_months: number[];

  /** Set only when date_mode = "seasons" */
  selected_seasons: Season[];

  // ── Q2: Trip length for this city ───────────────────────────────────────

  trip_length_mode: TripLengthMode;

  /** Exact days; set only when trip_length_mode = "specific" */
  trip_length_days: number | null;

  /** Bucket approximation; set only when trip_length_mode = "bucket" */
  trip_length_bucket: TripBucket | null;

  /**
   * Set when the itinerary builder confirms the exact day count from
   * specific dates or from the user confirming a bucket count.
   * This is the value the itinerary builder uses for day-by-day planning.
   */
  confirmed_days: number | null;

  /**
   * Limited day records for this city.
   * Empty array if no limited days apply.
   * Populated by the preference layer before handing off to the itinerary builder.
   */
  limited_days: LimitedDay[];

  // ── Q4: Visitor experience ───────────────────────────────────────────────

  /** Whether the user has visited this specific city before */
  visitor_experience: "first_time" | "returning";
}

// ─────────────────────────────────────────────────────────────────────────────
// Root preferences object
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete output of the onboarding questionnaire.
 * Stored in preference_sessions.preferences (jsonb).
 * Consumed by the preference layer filter logic and the itinerary builder.
 *
 * Multi-city vs single-city:
 *   - trip_type = "single" → cities[] has exactly one entry
 *   - trip_type = "multi"  → cities[] has 2+ entries, ordered by sequence_order
 *
 * Global preferences (Q3, Q5, Q6) apply identically across all cities in the trip.
 * Per-city preferences (Q1, Q2, Q4) are inside each CityPreference object.
 */
export interface TripPreferences {
  /** Matches preference_sessions.id in the database */
  id: string;

  /** null for anonymous sessions */
  user_id: string | null;

  /** Used for anonymous session persistence (30-day localStorage expiry) */
  session_token: string | null;

  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;

  /** Preferences schema version — must match PREFERENCES_VERSION */
  preferences_version: number;

  // ── Q1: Destination ──────────────────────────────────────────────────────

  trip_type: "single" | "multi";

  /**
   * One CityPreference per destination.
   * Single-city: always length 1.
   * Multi-city: length 2+, ordered by sequence_order.
   */
  cities: CityPreference[];

  // ── Q3: Who's traveling ─────────────────────────────────────────────────
  // Global — group composition does not change between cities in a trip.

  group_type: GroupType;

  /** Total number of adults; null for solo and couple */
  group_adults: number | null;

  /**
   * Number of rooms required; "not_sure" is a valid state for multi-generational
   * groups. null for group types that don't require room count.
   */
  group_rooms: number | "not_sure" | null;

  /**
   * Actual ages of children in the group.
   * Empty array when group_type is not "family".
   * The preference layer derives the appropriate age-tier filters from these values.
   */
  group_children_ages: number[];

  /** Set only when group_type = "multi_generational" */
  multi_gen_size: MultiGenSize | null;

  // ── Q5: Travel style ────────────────────────────────────────────────────
  // Global — travel style does not change between cities in a single trip.

  /**
   * 0–2 items. Empty array = no preference (full unfiltered, score-ordered list).
   * Applied as a soft filter (deprioritise, never hide).
   */
  travel_styles: TravelStyle[];

  // ── Q6: Budget ──────────────────────────────────────────────────────────
  // Global with per-city baseline adjustment via cities.price_baseline.

  /**
   * 1+ items. ["show_everything"] = no budget filter applied.
   * Hard exclusion for out-of-range tiers unless "show_everything" is selected.
   * Applied per-city using the city's price_baseline multiplier.
   */
  budget_tiers: BudgetTier[];
}