// app/dev/components/page.tsx
// Development scaffolding — DELETE before launch.
// Renders EntryCard with mock data for all 6 categories.

import EntryCard from "@/components/EntryCard";
import type { EntryCardData } from "@/lib/entries";
import type { Category } from "@/types/pipeline";

const MOCK_ENTRIES: EntryCardData[] = [
  {
    id: "mock-restaurant-1",
    slug: "starka",
    name: "Starka",
    category: "restaurant" as Category,
    neighbourhood: "Kazimierz",
    editorial_hook:
      "A cellar restaurant where the vodka is house-infused and the pierogi are handmade by women who've been folding them for decades.",
    raw_pipeline_data: null,
    google_place_id: null,
    price_level: 2,
    tags: ["authentic", "essential"],
  },
  {
    id: "mock-cafe-1",
    slug: "karma-coffee",
    name: "Karma Coffee",
    category: "cafe" as Category,
    neighbourhood: "Podgórze",
    editorial_hook:
      "Third-wave coffee in a converted garage, where the baristas know every regular by name and the cold brew rivals Berlin's best.",
    raw_pipeline_data: null,
    google_place_id: null,
    price_level: 1,
    tags: ["hidden_gem", "small_bite"],
  },
  {
    id: "mock-accommodation-1",
    slug: "hotel-stary",
    name: "Hotel Stary",
    category: "accommodation" as Category,
    neighbourhood: "Stare Miasto",
    editorial_hook:
      "A fifteenth-century aristocratic residence turned boutique hotel, where the swimming pool sits under Renaissance vaults.",
    raw_pipeline_data: null,
    google_place_id: null,
    price_level: 4,
    tags: ["boutique", "unique_stay"],
  },
  {
    id: "mock-tour-1",
    slug: "krakow-food-walk",
    name: "Kraków Food Walk",
    category: "tour" as Category,
    neighbourhood: "Kazimierz",
    editorial_hook:
      "A local guide walks you through market halls and milk bars that tourists walk past, ending with a shot of Żubrówka at a bar with no sign.",
    raw_pipeline_data: null,
    google_place_id: null,
    price_level: 2,
    tags: ["authentic", "essential"],
  },
  {
    id: "mock-sight-1",
    slug: "nowa-huta",
    name: "Nowa Huta",
    category: "sight" as Category,
    neighbourhood: "Nowa Huta",
    editorial_hook:
      "A socialist-realist planned city within a city — the wide boulevards and workers' palaces tell a story no guidebook captures properly.",
    raw_pipeline_data: null,
    google_place_id: null,
    price_level: 0,
    tags: ["deeper_cut", "local_niche"],
  },
  {
    id: "mock-nightlife-1",
    slug: "alchemia",
    name: "Alchemia",
    category: "nightlife" as Category,
    neighbourhood: "Kazimierz",
    editorial_hook:
      "Candlelit tables, jazz on Wednesdays, and an upstairs room that hosts poetry readings — the bar that defined Kazimierz's revival.",
    raw_pipeline_data: null,
    google_place_id: null,
    price_level: 1,
    tags: ["authentic", "essential"],
  },
];

export default function ComponentsDevPage() {
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
        Component Library
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
        EntryCard — all 6 categories with mock data (no database required)
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "var(--spacing-px-24)",
        }}
      >
        {MOCK_ENTRIES.map((entry) => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
      </div>

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
