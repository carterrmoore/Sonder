"use client";

import { useState } from "react";
import PreferenceQuestionnaire from "@/components/PreferenceQuestionnaire";
import ItineraryBuilder from "@/components/ItineraryBuilder";
import type { TripPreferences } from "@/types/preferences";
import type { EntryCardData } from "@/lib/entries";
import type { ItineraryDay } from "@/types/itinerary";

interface PlanFlowProps {
  entries: EntryCardData[];
  editItinerary?: {
    id: string;
    days: ItineraryDay[];
    total_days: number;
  } | null;
}

export default function PlanFlow({ entries, editItinerary }: PlanFlowProps) {
  const [prefs, setPrefs] = useState<TripPreferences | null>(null);

  if (editItinerary || prefs) {
    return (
      <ItineraryBuilder
        citySlug="krakow"
        entries={entries}
        initialDays={editItinerary?.days}
        tripLength={editItinerary?.total_days}
        isEditMode={!!editItinerary}
        editItineraryId={editItinerary?.id}
      />
    );
  }

  return (
    <PreferenceQuestionnaire
      citySlug="krakow"
      onComplete={setPrefs}
    />
  );
}
