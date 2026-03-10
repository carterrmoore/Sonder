/**
 * maps.ts — Client-safe Google Maps Places API (New) helpers.
 *
 * Used by components that need to resolve photos for entries that lack a
 * pipeline-curated photo URL (raw_pipeline_data.photos.selected_url).
 */

const GMAPS_BASE = "https://places.googleapis.com/v1";
const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/**
 * Fetches photo resource names for a given Google Place ID.
 * Returns an array of up to `maxCount` photo name strings, e.g.
 *   "places/ChIJ…/photos/AXCi2y…"
 */
export async function fetchPlacePhotos(
  placeId: string,
  maxCount: number = 1
): Promise<string[]> {
  const res = await fetch(
    `${GMAPS_BASE}/places/${placeId}?fields=photos&key=${GMAPS_KEY}`
  );
  if (!res.ok) return [];
  const data: { photos?: Array<{ name: string }> } = await res.json();
  return (data.photos ?? []).slice(0, maxCount).map((p) => p.name);
}

/**
 * Builds a photo media URL from a photo resource name.
 * @param photoName  e.g. "places/ChIJ…/photos/AXCi2y…"
 * @param maxWidth   pixel width, e.g. 800
 */
export function buildPhotoUrl(photoName: string, maxWidth: number): string {
  return `${GMAPS_BASE}/${photoName}/media?maxWidthPx=${maxWidth}&key=${GMAPS_KEY}`;
}
