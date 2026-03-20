/**
 * POST /api/pipeline/prefetch-booking
 *
 * Scrapes all Booking.com accommodation data for a city and saves it as a
 * local cache file at src/pipeline/data/booking-cache-{city_slug}.json.
 *
 * Run once per city before the accommodation pipeline — never during it.
 *
 * Request body: { city_id: string, city_slug: string, city_name: string }
 * Returns: { success: true, city_slug, results_count, file_path }
 */

import { NextRequest, NextResponse } from "next/server";
import { prefetchBookingComCity } from "@/pipeline/stage1";

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const secret = process.env.PIPELINE_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "PIPELINE_SECRET not configured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: { city_id?: string; city_slug?: string; city_name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { city_id, city_slug, city_name } = body;

  if (!city_id || typeof city_id !== "string") {
    return NextResponse.json(
      { error: "city_id is required and must be a string" },
      { status: 400 }
    );
  }
  if (!city_slug || typeof city_slug !== "string") {
    return NextResponse.json(
      { error: "city_slug is required and must be a string" },
      { status: 400 }
    );
  }
  if (!city_name || typeof city_name !== "string") {
    return NextResponse.json(
      { error: "city_name is required and must be a string" },
      { status: 400 }
    );
  }

  // ── Run prefetch ─────────────────────────────────────────────────────────
  console.log(
    `[/api/pipeline/prefetch-booking] Triggered: city=${city_id}, slug=${city_slug}`
  );

  try {
    const { resultsCount, filePath } = await prefetchBookingComCity(
      city_slug,
      city_name
    );
    return NextResponse.json(
      { success: true, city_slug, results_count: resultsCount, file_path: filePath },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[/api/pipeline/prefetch-booking] Failed:`, message);
    return NextResponse.json(
      { error: "Prefetch failed", detail: message },
      { status: 500 }
    );
  }
}
