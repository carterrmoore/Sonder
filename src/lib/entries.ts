/**
 * entries.ts — Supabase query helpers for the consumer-facing app.
 * Server-side only. Do NOT add "use client".
 */

import { createClient as createAnonClient } from "@supabase/supabase-js";
import type { Category } from "@/types/pipeline";

function getAnonClient() {
  return createAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────

/** Subset of the full entry — only what the card needs. */
export interface EntryCardData {
  id: string;
  slug: string | null;
  name: string;
  category: Category;
  neighbourhood: string | null;
  editorial_hook: string | null;
  raw_pipeline_data: Record<string, unknown> | null;
  price_level: number | null;
  tags: string[] | null;
  google_place_id: string | null;
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
  google_place_id: string | null;
  viator_product_code: string | null;
  gyg_listing_url: string | null;
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
 * Fetch approved entries for a city.
 * review_status filter scopes to the curated set; RLS enforces city-level access.
 */
export async function getApprovedEntries(
  cityId: string
): Promise<EntryCardData[]> {
  const supabase = getAnonClient();

  const { data } = await supabase
    .from("entries")
    .select(`
      id,
      slug,
      name,
      category,
      editorial_hook,
      price_level,
      tags,
      raw_pipeline_data,
      google_place_id,
      neighbourhood:neighbourhood_id ( display_name )
    `)
    .eq("city_id", cityId)
    .eq("review_status", "approved")
    .order("name");

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug ?? null,
    name: row.name,
    category: row.category as Category,
    neighbourhood: extractNeighbourhood(row.neighbourhood),
    editorial_hook: (row.editorial_hook as string) ?? null,
    raw_pipeline_data: (row.raw_pipeline_data as Record<string, unknown>) ?? null,
    price_level: row.price_level ?? null,
    tags: row.tags ?? null,
    google_place_id: (row.google_place_id as string) ?? null,
  }));
}


function rowToEntryFull(data: Record<string, unknown>): EntryFull {
  return {
    id: data.id as string,
    slug: data.slug as string,
    name: data.name as string,
    category: data.category as Category,
    address: (data.address as string) ?? null,
    neighbourhood: extractNeighbourhood(data.neighbourhoods),
    editorial_hook: data.editorial_hook as string,
    editorial_rationale: (data.editorial_rationale as string) ?? null,
    editorial_writeup: (data.editorial_writeup as string) ?? null,
    photos: (data.photos as string[]) ?? null,
    price_level: (data.price_level as number) ?? null,
    tags: (data.tags as string[]) ?? null,
    maps_url: (data.maps_url as string) ?? null,
    insider_tip: (data.insider_tip as string) ?? null,
    what_to_order: (data.what_to_order as string) ?? null,
    why_it_made_the_cut: (data.why_it_made_the_cut as string) ?? null,
    google_place_id: (data.google_place_id as string) ?? null,
    viator_product_code: (data.viator_product_code as string) ?? null,
    gyg_listing_url: (data.gyg_listing_url as string) ?? null,
  };
}

/**
 * Fetch a single full entry by slug (or id as fallback) for the detail page.
 * Returns null if not found. No status filter during dev.
 */
export async function getEntryBySlug(
  slugOrId: string
): Promise<EntryFull | null> {
  const supabase = getAnonClient();

  // Try slug first — no status filter for dev
  const { data: bySlug } = await supabase
    .from("entries")
    .select("*")
    .eq("slug", slugOrId)
    .maybeSingle();

  if (bySlug) return rowToEntryFull(bySlug);

  // Fall back to id
  const { data: byId } = await supabase
    .from("entries")
    .select("*")
    .eq("id", slugOrId)
    .maybeSingle();

  return byId ? rowToEntryFull(byId) : null;
}

/**
 * Fetch all approved slug/id pairs for a city — used by generateStaticParams.
 * Uses a direct anon client (no cookies) because this runs at build time.
 * Falls back to id when slug is null (seed entries).
 */
export async function getApprovedSlugs(
  cityId: string
): Promise<string[]> {
  const supabase = getAnonClient();

  const { data } = await supabase
    .from("entries")
    .select("slug, id")
    .eq("city_id", cityId);

  return (data ?? []).map((row) => (row.slug ?? row.id) as string);
}
