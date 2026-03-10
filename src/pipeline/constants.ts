/**
 * constants.ts — Display constants for the consumer-facing app.
 *
 * Shared by EntryCard, detail pages, and any future consumer UI.
 * Pipeline types (Category, PriceLevel, etc.) live in @/types/pipeline.ts.
 */

import type { Category } from "@/types/pipeline";

// ─────────────────────────────────────────────────────────────────────────────
// Category display config
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryDisplayConfig {
  label: string;
  colorGroup: "gold" | "apricot" | "verdigris" | "neutral";
}

export const CATEGORY_DISPLAY: Record<Category, CategoryDisplayConfig> = {
  restaurant:    { label: "Restaurant",  colorGroup: "gold" },
  cafe:          { label: "Café",        colorGroup: "gold" },
  accommodation: { label: "Stay",        colorGroup: "verdigris" },
  tour:          { label: "Experience",  colorGroup: "apricot" },
  sight:         { label: "Sights",      colorGroup: "apricot" },
  nightlife:     { label: "Night",       colorGroup: "apricot" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Colour groups — maps colorGroup keys to CSS variable values
// ─────────────────────────────────────────────────────────────────────────────

export const COLOR_GROUPS: Record<
  CategoryDisplayConfig["colorGroup"],
  { bg: string; text: string }
> = {
  gold:      { bg: "var(--color-gold)",      text: "var(--color-ink)" },
  apricot:   { bg: "var(--color-apricot)",   text: "var(--color-ink)" },
  verdigris: { bg: "var(--color-verdigris)", text: "var(--color-ink)" },
  neutral:   { bg: "var(--color-surface-3)", text: "var(--color-warm)" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Price level labels
// ─────────────────────────────────────────────────────────────────────────────

export type PriceLevel = 0 | 1 | 2 | 3 | 4;

export const PRICE_LEVEL_LABELS: Record<PriceLevel, string> = {
  0: "Free",
  1: "Budget",
  2: "Moderate",
  3: "Upscale",
  4: "Splurge",
};
