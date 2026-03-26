/**
 * POST /api/itineraries/[id]/share
 *
 * Generates (or returns an existing) share token for an itinerary.
 * Returns { url: string } — the public share URL for the itinerary.
 *
 * MIGRATION REQUIRED — run this in the Supabase SQL editor before testing:
 *
 *   CREATE TABLE IF NOT EXISTS itinerary_shares (
 *     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     itinerary_id uuid NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
 *     token text NOT NULL UNIQUE,
 *     status text NOT NULL DEFAULT 'active',
 *     view_count integer NOT NULL DEFAULT 0,
 *     attributed_signups integer NOT NULL DEFAULT 0,
 *     first_viewed_at timestamptz,
 *     last_viewed_at timestamptz,
 *     revoked_at timestamptz,
 *     created_at timestamptz NOT NULL DEFAULT now()
 *   );
 *   CREATE INDEX IF NOT EXISTS itinerary_shares_token ON itinerary_shares(token);
 *   CREATE INDEX IF NOT EXISTS itinerary_shares_itinerary ON itinerary_shares(itinerary_id);
 */

import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log("[share] route called for id:", id);

  // Return existing active share if one exists
  const { data: existing } = await adminClient
    .from("itinerary_shares")
    .select("token")
    .eq("itinerary_id", id)
    .eq("status", "active")
    .maybeSingle();

  if (existing?.token) {
    return NextResponse.json({ url: `${BASE_URL}/s/${existing.token}` });
  }

  // Generate 8-character URL-safe token
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 8);

  const { error } = await adminClient
    .from("itinerary_shares")
    .insert({ itinerary_id: id, token, status: "active" });

  if (error) {
    console.error("[share] error:", error);
    return NextResponse.json(
      {
        error:
          "Failed to create share link. Ensure the itinerary_shares table exists — see migration comment in this file.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: `${BASE_URL}/s/${token}` });
}
