import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, itineraryId, citySlug, cityDisplayName, cityId } = (body ?? {}) as {
    email?: unknown;
    itineraryId?: unknown;
    citySlug?: unknown;
    cityDisplayName?: unknown;
    cityId?: unknown;
  };

  if (typeof email !== "string" || typeof itineraryId !== "string") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const emailNormalised = email.trim().toLowerCase();

  if (!EMAIL_RE.test(emailNormalised)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // Return existing token if record already exists for this email + itinerary
  const { data: existing } = await adminClient
    .from("email_captures")
    .select("magic_link_token")
    .eq("email_normalised", emailNormalised)
    .eq("itinerary_id", itineraryId)
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { magic_link_token: existing.magic_link_token },
      { status: 200 }
    );
  }

  // Generate tokens
  const magic_link_token    = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  const unsubscribe_token   = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const magic_link_expires_at = new Date(
    Date.now() + 90 * 24 * 60 * 60 * 1000
  ).toISOString();

  const insertData = {
    email:                email.trim(),
    email_normalised:     emailNormalised,
    itinerary_id:         itineraryId,
    city_slug:            typeof citySlug === "string" ? citySlug : "krakow",
    city_display_name:    typeof cityDisplayName === "string" ? cityDisplayName : "Kraków",
    city_id:              typeof cityId === "string" ? cityId : null,
    status:               "active",
    magic_link_token,
    unsubscribe_token,
    magic_link_expires_at,
  };

  const { error } = await adminClient.from("email_captures").insert(insertData);

  console.error("[email-capture] full error:", JSON.stringify(error, null, 2));
  console.error("[email-capture] attempted insert:", JSON.stringify(insertData, null, 2));

  if (error) {
    return NextResponse.json({ error: "Failed to save record" }, { status: 500 });
  }

  return NextResponse.json({ magic_link_token }, { status: 200 });
}
