import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email } = (body ?? {}) as { email?: unknown };

  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const emailNormalised = email.trim().toLowerCase();

  const { data: capture } = await adminClient
    .from("email_captures")
    .select("id")
    .eq("email_normalised", emailNormalised)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!capture) {
    return NextResponse.json({ sent: false }, { status: 200 });
  }

  const magic_link_token = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  const magic_link_expires_at = new Date(
    Date.now() + 90 * 24 * 60 * 60 * 1000
  ).toISOString();

  await adminClient
    .from("email_captures")
    .update({ magic_link_token, magic_link_expires_at })
    .eq("id", capture.id);

  console.log("[magic-link-refresh] new token generated for:", emailNormalised);

  return NextResponse.json({ sent: true }, { status: 200 });
}
