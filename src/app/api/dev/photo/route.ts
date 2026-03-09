// app/api/dev/photo/route.ts
// Development-only API route — DELETE before launch.
// Proxies a Google Place Photo request server-side so the client
// key referrer restriction works (requests appear from the server, not browser).
//
// Usage: /api/dev/photo?placeId=ChIJ...
// Returns: Image bytes with correct Content-Type

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get("placeId");

  if (!placeId) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY; // Server key — no referrer restriction
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not set" }, { status: 500 });
  }

  try {
    // Step 1: Fetch place details to get photo resource names
    const detailsRes = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?fields=photos&key=${apiKey}`,
      {
        headers: { "X-Goog-FieldMask": "photos" },
      }
    );

    if (!detailsRes.ok) {
      return NextResponse.json(
        { error: "Place Details failed", status: detailsRes.status },
        { status: 502 }
      );
    }

    const details = await detailsRes.json();
    const photos: Array<{ name: string }> = details.photos ?? [];

    if (photos.length === 0) {
      return NextResponse.json({ error: "No photos found" }, { status: 404 });
    }

    // Step 2: Fetch the first photo's media
    const photoName = photos[0].name;
    const photoRes = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${apiKey}`
    );

    if (!photoRes.ok) {
      return NextResponse.json({ error: "Photo fetch failed" }, { status: 502 });
    }

    const imageBuffer = await photoRes.arrayBuffer();
    const contentType = photoRes.headers.get("content-type") ?? "image/jpeg";

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600", // Dev only — do not cache in production per Google ToS
      },
    });
  } catch (err) {
    console.error("Photo proxy error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}