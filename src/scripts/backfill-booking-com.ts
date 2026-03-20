/**
 * backfill-booking-com.ts
 *
 * One-time script: reads the Booking.com cache files and writes enrichment
 * data to all existing promoted accommodation entries in the database.
 *
 * Run from project root:
 *   npx tsx --tsconfig tsconfig.json src/scripts/backfill-booking-com.ts
 *
 * Requires Node 20.12+ for process.loadEnvFile (no dotenv dep needed).
 */

// Load .env.local before any other imports touch process.env
try {
  process.loadEnvFile(".env.local");
} catch {
  console.warn("[backfill] .env.local not found — expecting env vars already set");
}

import { createClient } from "@supabase/supabase-js";
import { lookupBookingComCache } from "@/pipeline/booking-cache";
import type { BookingComData } from "@/types/pipeline";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key);
}

async function main() {
  const supabase = getServiceClient();

  // ── Fetch all accommodation entries ──────────────────────────────────────
  const { data: entries, error } = await supabase
    .from("entries")
    .select("id, name, raw_pipeline_data, booking_com_hotel_id")
    .eq("category", "accommodation");

  if (error) {
    throw new Error(`Failed to fetch entries: ${error.message}`);
  }

  console.log(`[backfill] Found ${entries.length} accommodation entries`);

  let matched = 0;
  let unmatched = 0;

  for (const entry of entries) {
    const bookingData: BookingComData | null = lookupBookingComCache(
      entry.name,
      "krakow"
    );

    if (!bookingData) {
      console.log(`[backfill] No match for "${entry.name}"`);
      unmatched++;
      continue;
    }

    console.log(
      `[backfill] Matched "${entry.name}" → hotel_id=${bookingData.hotel_id}`
    );

    // Merge booking_com_data into existing raw_pipeline_data in JS, then write back
    const existingRaw =
      (entry.raw_pipeline_data as Record<string, unknown>) ?? {};
    const updatedRaw = { ...existingRaw, booking_com_data: bookingData };

    const { error: updateError } = await supabase
      .from("entries")
      .update({
        raw_pipeline_data: updatedRaw,
        booking_com_hotel_id: bookingData.hotel_id,
        booking_com_url: bookingData.booking_url,
        booking_com_rating: bookingData.rating,
        booking_com_review_count: bookingData.review_count,
        booking_com_category_scores: bookingData.category_scores,
      })
      .eq("id", entry.id);

    if (updateError) {
      console.error(
        `[backfill] Update failed for "${entry.name}" (id=${entry.id}): ${updateError.message}`
      );
    } else {
      matched++;
    }
  }

  console.log(
    `[backfill] Done — ${entries.length} total, ${matched} matched, ${unmatched} unmatched`
  );
}

main().catch((err) => {
  console.error("[backfill] Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
