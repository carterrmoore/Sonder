// app/dev/card/page.tsx
// Development scaffolding — DELETE before launch.
// Renders the first approved seed entries as cards to verify:
//   - Freight Display headline
//   - Söhne body text
//   - Correct category pill colour
//   - Editorial hook text
//   - Live Google Maps photo
//   - Photo fallback rendering (for photo_curator_rejected_all = true entries)

import { createClient } from "@supabase/supabase-js";

// ── Types (inline for this dev page) ──────────────────────────────────────

interface SeedEntry {
  id: string;
  name: string;
  category: string;
  address: string;
  google_place_id: string;
  editorial_hook: string;
  editorial_tier: "full" | "minimal";
  price_level: number | null;
  photo_curator_rejected_all: boolean;
  tags: string[];
  neighbourhood: { display_name: string }[] | null;
  insider_tip: string | null;
}

// ── Fetch data server-side ────────────────────────────────────────────────

async function getSeedEntries(): Promise<SeedEntry[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // All 10 seed entries have review_status = 'approved'; no other approved entries exist yet
  const { data, error } = await supabase
    .from("entries")
    .select(`
      id, name, category, address, google_place_id,
      editorial_hook, editorial_tier, price_level,
      photo_curator_rejected_all, tags, insider_tip,
      neighbourhood:neighbourhood_id ( display_name )
    `)
    .eq("review_status", "approved")
    .limit(10);

  if (error) {
    console.error("Seed fetch error:", error);
    return [];
  }

  return (data ?? []) as SeedEntry[];
}

// ── Category config ───────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  restaurant:    { label: "Restaurant", color: "#C49A3C" },
  cafe:          { label: "Café",       color: "#C49A3C" },
  accommodation: { label: "Stay",       color: "#E8E3DA" },
  tour:          { label: "Experience", color: "#F2A07B" },
  sight:         { label: "Sights",     color: "#F2A07B" },
  nightlife:     { label: "Night",      color: "#F2A07B" },
};

const PRICE_LABELS: Record<number, string> = {
  0: "Free",
  1: "Budget",
  2: "Moderate",
  3: "Upscale",
  4: "Splurge",
};

// ── Page ──────────────────────────────────────────────────────────────────

export default async function CardDevPage() {
  const entries = await getSeedEntries();

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-warm)",
        padding: "var(--spacing-px-48) var(--spacing-px-32)",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-heading-lg)",
          fontWeight: 600,
          color: "var(--color-ink)",
          marginBottom: "8px",
        }}
      >
        Card Rendering Test
      </h1>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-body-sm)",
          color: "var(--color-ink)",
          opacity: 0.5,
          marginBottom: "var(--spacing-px-40)",
        }}
      >
        {entries.length} seed entries loaded. Verifying: fonts, category pills, photos, editorial hook copy.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "var(--spacing-px-24)",
        }}
      >
        {entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
      </div>

      {entries.length === 0 && (
        <div
          style={{
            backgroundColor: "#FFF3CD",
            padding: "var(--spacing-px-24)",
            borderRadius: "var(--radius-card)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-md)",
            color: "var(--color-ink)",
          }}
        >
          No seed entries found. Run Task 6 (seed data SQL) first, then reload.
        </div>
      )}

      <p
        style={{
          marginTop: "var(--spacing-px-64)",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-caption)",
          color: "var(--color-ink)",
          opacity: 0.3,
        }}
      >
        Development page — delete before launch
      </p>
    </div>
  );
}

// ── Card component ────────────────────────────────────────────────────────

function EntryCard({ entry }: { entry: SeedEntry }) {
  const config = CATEGORY_CONFIG[entry.category] ?? { label: entry.category, color: "#E8E3DA" };
  const neighbourhoodName = Array.isArray(entry.neighbourhood)
    ? entry.neighbourhood[0]?.display_name
    : (entry.neighbourhood as any)?.display_name;

  return (
    <div
      style={{
        backgroundColor: "var(--color-card)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card-rest)",
        overflow: "hidden",
      }}
    >
      {/* Photo area */}
      <div
        style={{
          height: "200px",
          backgroundColor: entry.photo_curator_rejected_all ? config.color : "#E8E3DA",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {entry.photo_curator_rejected_all ? (
          // Fallback: editorial hook on category colour
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-heading-md)",
              fontWeight: 400,
              lineHeight: 1.3,
              color: "var(--color-ink)",
              textAlign: "center",
              padding: "var(--spacing-px-24)",
              maxWidth: "280px",
            }}
          >
            {entry.editorial_hook}
          </p>
        ) : (
          // Live photo proxied through /api/dev/photo to avoid key referrer issues
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/dev/photo?placeId=${entry.google_place_id}`}
            alt={entry.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}

        {/* Category pill */}
        <div
          style={{
            position: "absolute",
            top: "var(--spacing-px-12)",
            left: "var(--spacing-px-12)",
            backgroundColor: config.color,
            color: "var(--color-ink)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-overline)",
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "3px 8px",
            borderRadius: "var(--radius-button)",
          }}
        >
          {config.label}
        </div>

        {/* No-photo badge */}
        {entry.photo_curator_rejected_all && (
          <div
            style={{
              position: "absolute",
              top: "var(--spacing-px-12)",
              right: "var(--spacing-px-12)",
              backgroundColor: "rgba(26,26,24,0.6)",
              color: "#f5f0e8",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-caption)",
              padding: "2px 6px",
              borderRadius: "var(--radius-button)",
            }}
          >
            No photo
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: "var(--spacing-px-16)" }}>
        {/* Meta row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "var(--spacing-px-4)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-caption)",
              color: "var(--color-ink)",
              opacity: 0.5,
            }}
          >
            {neighbourhoodName ?? "Kraków"}
            {entry.price_level !== null && ` · ${PRICE_LABELS[entry.price_level]}`}
          </span>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-caption)",
              color: "var(--color-ink)",
              opacity: 0.35,
            }}
          >
            {entry.editorial_tier}
          </span>
        </div>

        {/* Name — Freight Display */}
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-heading-lg)",
            fontWeight: 400,
            lineHeight: "var(--leading-heading-lg)",
            color: "var(--color-ink)",
            margin: "0 0 var(--spacing-px-8) 0",
          }}
        >
          {entry.name}
        </h2>

        {/* Editorial hook — Söhne body-md */}
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-md)",
            fontWeight: 400,
            lineHeight: "var(--leading-body-md)",
            color: "var(--color-ink)",
            opacity: 0.8,
            margin: "0 0 var(--spacing-px-12) 0",
          }}
        >
          {entry.editorial_hook}
        </p>

        {/* Tags */}
        {entry.tags?.length > 0 && (
          <div style={{ display: "flex", gap: "var(--spacing-px-4)", flexWrap: "wrap" }}>
            {entry.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-caption)",
                  color: "var(--color-ink)",
                  opacity: 0.5,
                  backgroundColor: "rgba(26,26,24,0.06)",
                  padding: "2px 8px",
                  borderRadius: "100px",
                }}
              >
                {tag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}