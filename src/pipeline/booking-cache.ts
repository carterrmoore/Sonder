import * as fs from "fs";
import * as path from "path";
import type { BookingComData } from "@/types/pipeline";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cacheMap = new Map<string, any[]>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadCache(citySlug: string): any[] {
  const dataDir = path.join(process.cwd(), "src", "pipeline", "data");

  // 1. Try single file (written by prefetchBookingComCity for future cities)
  const singlePath = path.join(dataDir, `booking-cache-${citySlug}.json`);
  if (fs.existsSync(singlePath)) {
    try {
      const raw = fs.readFileSync(singlePath, "utf-8");
      console.log(`[booking-cache] Loaded cache for ${citySlug}: ${singlePath}`);
      return JSON.parse(raw);
    } catch (err) {
      console.warn(
        `[booking-cache] Failed to parse ${singlePath}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // 2. Try legacy split files (e.g. booking-cache-krakow-1.json + -2.json)
  const part1 = path.join(dataDir, `booking-cache-${citySlug}-1.json`);
  const part2 = path.join(dataDir, `booking-cache-${citySlug}-2.json`);
  const merged: unknown[] = [];
  let foundAny = false;

  for (const filePath of [part1, part2]) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        merged.push(...parsed);
        foundAny = true;
      }
    } catch (err) {
      console.warn(
        `[booking-cache] Failed to parse ${filePath}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (foundAny) {
    console.log(
      `[booking-cache] Loaded split cache for ${citySlug}: ${merged.length} entries`
    );
    return merged;
  }

  console.warn(
    `[booking-cache] No cache found for ${citySlug} (tried single file and split files)`
  );
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToBookingComData(result: any): BookingComData {
  const roomDimensionRe = /^\d+ feet²$/;
  const roomFacilities = Array.from(
    new Set<string>(
      (result.rooms ?? [])
        .flatMap((r: { facilities?: string[] }) => r.facilities ?? [])
        .filter((f: string) => !roomDimensionRe.test(f))
    )
  );

  const checkIn: string | null = (() => {
    const raw: string | null = result.checkIn ?? null;
    if (!raw) return null;
    return raw.split("\n")[0].trim() || null;
  })();

  const hasFreeCanc: boolean =
    result.rooms?.some(
      (r: { options?: Array<{ freeCancellation?: boolean }> }) =>
        r.options?.some((o) => o.freeCancellation === true)
    ) ?? false;

  const cleanUrl = (() => {
    try {
      const p = new URL(result.url ?? "");
      return p.origin + p.pathname;
    } catch {
      return result.url ?? "";
    }
  })();

  return {
    hotel_id: result.hotelId,
    booking_url: cleanUrl,
    rating: result.rating,
    rating_label: result.ratingLabel,
    review_count: result.reviews,
    category_scores: (result.categoryReviews ?? []).map(
      (c: { title: string; score: number }) => ({ title: c.title, score: c.score })
    ),
    stars: result.stars ?? null,
    breakfast: result.breakfast ?? null,
    facility_groups: (result.facilities ?? []).map(
      (group: {
        name: string;
        overview?: string | null;
        facilities?: Array<{
          name: string;
          id?: number;
          additionalInfo?: { requiresAdditionalCharge?: boolean; isOffSite?: boolean };
        }>;
      }) => ({
        name: group.name,
        overview: group.overview ?? null,
        facilities: (group.facilities ?? []).map((f) => ({
          name: f.name,
          requiresAdditionalCharge: f.additionalInfo?.requiresAdditionalCharge ?? false,
          isOffSite: f.additionalInfo?.isOffSite ?? false,
          id: f.id,
        })),
      })
    ),
    room_facilities: roomFacilities,
    check_in: checkIn,
    check_out: result.checkOut ?? null,
    has_free_cancellation: hasFreeCanc,
    scraped_at: result.timeOfScrapeISO ?? new Date().toISOString(),
    apify_run_id: null,
  };
}

const CITY_SUFFIXES = [
  "krakow", "krakow city center", "krakow old town", "cracow",
  "vienna", "budapest", "prague", "warsaw",
];

const STOP_WORDS = new Set([
  "hotel", "hostel", "apartments", "aparthotel", "boutique", "rooms",
  "guest", "house", "inn", "lodge", "residence", "krakow", "cracow",
  "city", "center", "centre", "old", "town", "design", "luxury",
]);

function normalize(name: string): string {
  let n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  for (const suffix of CITY_SUFFIXES) {
    if (n.endsWith(" " + suffix)) {
      n = n.slice(0, -(suffix.length + 1)).trim();
    }
  }
  return n;
}

function significantTokens(normalized: string): string[] {
  return normalized.split(" ").filter((t) => t.length > 0 && !STOP_WORDS.has(t));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findMatch(items: any[], propertyName: string): { item: any; stage: number } | null {
  const normEntry = normalize(propertyName);

  // Stage 1 — exact normalized match
  for (const item of items) {
    if (!item.name || !item.url) continue;
    if (normalize(item.name as string) === normEntry) {
      return { item, stage: 1 };
    }
  }

  // Stage 2 — normalized substring
  for (const item of items) {
    if (!item.name || !item.url) continue;
    const normCache = normalize(item.name as string);
    if (normEntry.includes(normCache) || normCache.includes(normEntry)) {
      return { item, stage: 2 };
    }
  }

  // Stage 3 — token overlap (>= 0.6 Jaccard on significant tokens)
  const entryTokens = significantTokens(normEntry);
  if (entryTokens.length >= 2) {
    for (const item of items) {
      if (!item.name || !item.url) continue;
      const cacheTokens = significantTokens(normalize(item.name as string));
      if (cacheTokens.length < 2) continue;
      const entrySet = new Set(entryTokens);
      const shared = cacheTokens.filter((t) => entrySet.has(t)).length;
      const ratio = shared / Math.max(entryTokens.length, cacheTokens.length);
      if (ratio >= 0.6) {
        return { item, stage: 3 };
      }
    }
  }

  return null;
}

export function lookupBookingComCache(
  propertyName: string,
  citySlug: string
): BookingComData | null {
  try {
    if (!cacheMap.has(citySlug)) {
      cacheMap.set(citySlug, loadCache(citySlug));
    }
    const items = cacheMap.get(citySlug)!;

    const result = findMatch(items, propertyName);
    if (!result) return null;

    console.log(
      `[booking-cache] Stage ${result.stage} match: "${propertyName}" → "${result.item.name as string}"`
    );
    return mapToBookingComData(result.item);
  } catch (err) {
    console.warn(
      `[booking-cache] lookupBookingComCache failed for "${propertyName}":`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
