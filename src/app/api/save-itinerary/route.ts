import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import type { AnchorBlock, EntryMetaHint, EntryId } from "@/types/handoff-types";

const KRAKOW_CITY_ID = "21b778e8-0b37-4adc-ae10-5a226929c59c";

interface SaveItineraryBody {
  userId:        string | null;
  citySlug:      string; // accepted for logging, not inserted
  tripLength:    number;
  days:          unknown[];
  anchorBlocks:  AnchorBlock[] | null;
  entryMeta:     Record<EntryId, EntryMetaHint> | null;
  tripNarrative: string | null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const b = body as Partial<SaveItineraryBody>;

  if (typeof b.tripLength !== "number" || !Array.isArray(b.days)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Resolve public user ID from auth ID
  let publicUserId: string | null = null;
  if (b.userId) {
    const { data: userRow } = await adminClient
      .from("users")
      .select("id")
      .eq("auth_id", b.userId)
      .single();
    publicUserId = userRow?.id ?? null;
  }

  if (b.userId && !publicUserId) {
    return NextResponse.json(
      { ok: false, error: "User profile not found. Please try again." },
      { status: 500 }
    );
  }

  const { data, error } = await adminClient
    .from("itineraries")
    .insert({
      user_id:         publicUserId,
      city_id:         KRAKOW_CITY_ID,
      status:          "finalised",
      total_days:      b.tripLength,
      days:            b.days,
      anchor_blocks:   b.anchorBlocks ?? [],
      entry_meta:      b.entryMeta ?? {},
      handoff_version: 2,
      trip_narrative:  b.tripNarrative ?? null,
      finalised_at:    new Date().toISOString(),
    })
    .select("id")
    .single();

  console.error("[save-itinerary] Supabase error:", JSON.stringify(error));
  console.log("[save-itinerary] Supabase data:", JSON.stringify(data));

  if (error) {
    return NextResponse.json({ error: "Failed to save itinerary" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, itineraryId: data.id });
}
