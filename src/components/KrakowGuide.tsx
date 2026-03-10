"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import EntryCard from "@/components/EntryCard";
import CityLayout from "@/components/layout/CityLayout";
import CitySidebar from "@/components/layout/CitySidebar";
import type { EntryCardData } from "@/lib/entries";
import type { Category } from "@/types/pipeline";
import type { TripPreferences } from "@/types/preferences";
import { applyPreferences } from "@/lib/preference-filter";
import { tokens } from "@/lib/tokens";

interface KrakowGuideProps {
  entries: EntryCardData[];
}

export default function KrakowGuide({ entries }: KrakowGuideProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");
  const [preferences, setPreferences] = useState<TripPreferences | null>(null);
  const [hasItinerary, setHasItinerary] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("sonder_preferences_krakow");
      if (stored) setPreferences(JSON.parse(stored) as TripPreferences);
    } catch {}
    try {
      const raw = localStorage.getItem("sonder_itinerary_krakow");
      if (raw) {
        const parsed = JSON.parse(raw);
        const hasSlots = parsed?.days?.some(
          (d: { slots: unknown[] }) => d.slots.length > 0
        );
        setHasItinerary(!!hasSlots);
      }
    } catch {}
  }, []);

  const scoredEntries = useMemo(
    () => applyPreferences(entries, preferences),
    [entries, preferences]
  );

  const categories: Array<Category | "all"> = [
    "all",
    ...Array.from(new Set(entries.map((e) => e.category))),
  ];

  const filtered =
    selectedCategory === "all"
      ? scoredEntries
      : scoredEntries.filter((se) => se.entry.category === selectedCategory);

  const sortedEntries = [...filtered].sort(
    (a, b) =>
      ((b.entry as any).quality_score ?? 0) -
      ((a.entry as any).quality_score ?? 0)
  );

  return (
    <CityLayout
      sidebar={
        <CitySidebar
          cityName="Kraków"
          tagline="No tourist traps. No paid placements. Chosen by people who live here."
          categories={categories}
          activeCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          preferenceActive={!!preferences}
          hasItinerary={hasItinerary}
          onPlanTrip={() => router.push("/krakow/plan")}
          onViewItinerary={() => router.push("/krakow/itinerary")}
        />
      }
    >
      {sortedEntries.length === 0 ? (
        <p
          style={{
            fontFamily: tokens.fontBody,
            fontSize: tokens.textBodyMd,
            lineHeight: "var(--leading-body-md)",
            color: tokens.ink,
            opacity: 0.5,
          }}
        >
          Nothing here yet. More coming soon.
        </p>
      ) : (
        <div
          className="entry-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "32px 24px",
            alignItems: "stretch",
          }}
        >
          {sortedEntries.map((se, index) => (
            <EntryCard
              key={se.entry.id}
              entry={se.entry}
              featured={index === 0}
              rank={index < 5 ? index + 1 : undefined}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ height: "var(--spacing-px-96)" }} />
      <p
        style={{
          fontFamily: tokens.fontBody,
          fontSize: tokens.textCaption,
          lineHeight: "var(--leading-caption)",
          color: tokens.ink,
          opacity: 0.4,
          textAlign: "center",
          margin: 0,
        }}
      >
        Sonder · Kraków · Updated March 2026
      </p>
      <div style={{ height: "var(--spacing-px-64)" }} />
    </CityLayout>
  );
}
