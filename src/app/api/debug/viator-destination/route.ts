// src/app/api/debug/viator-destination/route.ts
// TEMPORARY DIAGNOSTIC — delete after smoke test passes.
//
// Calls resolveViatorDestinationId("Kraków") and returns the result.
// Note: the function returns only the destination ID string; the full
// taxonomy match object is internal to stage1-viator.ts and not exposed.

import { NextRequest, NextResponse } from "next/server";
import { resolveViatorDestinationId } from "@/pipeline/stage1-viator";

export async function GET(req: NextRequest) {
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

  try {
    const destinationId = await resolveViatorDestinationId("Kraków");
    return NextResponse.json({ destination_id: destinationId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
