/**
 * entries.ts — Supabase query helpers for the consumer-facing app.
 * Server-side only. Do NOT add "use client".
 */

import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types/pipeline";

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────

/** Subset of the full entry — only what the card needs. */
export interface EntryCardData {
  id: string;
  slug: string;
  name: string;
  category: Category;
  neighbourhood: string | null;
  editorial_hook: string;
  photos: string[] | null;
  price_level: number | null;
  tags: string[] | null;
}

/** Full entry for the detail page. */
export interface EntryFull {
  id: string;
  slug: string;
  name: string;
  category: Category;
  address: string | null;
  neighbourhood: string | null;
  editorial_hook: string;
  editorial_rationale: string | null;
  editorial_writeup: string | null;
  photos: string[] | null;
  price_level: number | null;
  tags: string[] | null;
  maps_url: string | null;
  insider_tip: string | null;
  what_to_order: string | null;
  why_it_made_the_cut: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Supabase FK joins may return an object or array — normalise to string | null. */
function extractNeighbourhood(raw: unknown): string | null {
  if (Array.isArray(raw)) return raw[0]?.display_name ?? null;
  if (raw && typeof raw === "object" && "display_name" in raw)
    return (raw as { display_name: string }).display_name;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Query helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all approved entries for a city, ordered by gate2_score DESC.
 * Optionally filter by category.
 */
export async function getApprovedEntries(
  cityId: string,
  category?: Category
): Promise<EntryCardData[]> {
  const supabase = await createClient();

  let query = supabase
    .from("entries")
    .select(
      `
      id,
      slug,
      name,
      category,
      editorial_hook,
      photos,
      price_level,
      tags,
      neighbourhoods ( display_name )
    `
    )
    .eq("city_id", cityId)
    .eq("review_status", "approved")
    .order("gate2_score", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getApprovedEntries error:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category as Category,
    neighbourhood: extractNeighbourhood(row.neighbourhoods),
    editorial_hook: row.editorial_hook,
    photos: row.photos,
    price_level: row.price_level,
    tags: row.tags,
  }));
}

/**
 * Fetch a single full entry by slug for the detail page.
 * Returns null if not found or not approved.
 */
export async function getEntryBySlug(
  slug: string
): Promise<EntryFull | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("entries")
    .select(
      `
      id,
      slug,
      name,
      category,
      address,
      editorial_hook,
      editorial_rationale,
      editorial_writeup,
      photos,
      price_level,
      tags,
      maps_url,
      insider_tip,
      what_to_order,
      why_it_made_the_cut,
      neighbourhoods ( display_name )
    `
    )
    .eq("slug", slug)
    .eq("review_status", "approved")
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    category: data.category as Category,
    address: data.address,
    neighbourhood: extractNeighbourhood(data.neighbourhoods),
    editorial_hook: data.editorial_hook,
    editorial_rationale: data.editorial_rationale,
    editorial_writeup: data.editorial_writeup,
    photos: data.photos,
    price_level: data.price_level,
    tags: data.tags,
    maps_url: data.maps_url,
    insider_tip: data.insider_tip,
    what_to_order: data.what_to_order,
    why_it_made_the_cut: data.why_it_made_the_cut,
  };
}

/**
 * Fetch all approved slugs for a city — used by generateStaticParams.
 */
export async function getApprovedSlugs(
  cityId: string
): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("entries")
    .select("slug")
    .eq("city_id", cityId)
    .eq("review_status", "approved");

  if (error) {
    console.error("getApprovedSlugs error:", error);
    return [];
  }

  return (data ?? []).map((row) => row.slug as string);
}
