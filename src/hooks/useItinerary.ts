"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Itinerary, ItineraryDay, ItinerarySlot, TimeBlock } from "@/types/itinerary";
import type { EntryCardData } from "@/lib/entries";
import type { ScoredEntry } from "@/lib/preference-filter";
import { generateDays } from "@/lib/day-generator";

function storageKey(citySlug: string): string {
  return `sonder_itinerary_${citySlug}`;
}

function makeSnapshot(entry: EntryCardData, citySlug: string): ItinerarySlot["entrySnapshot"] {
  return {
    name: entry.name,
    category: entry.category,
    neighbourhood: entry.neighbourhood,
    editorial_hook: entry.editorial_hook,
    slug: entry.slug,
    citySlug,
  };
}

export function useItinerary(citySlug: string, onFinalised?: () => void) {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  // Stable ref so finaliseItinerary's useCallback dep array stays clean
  const onFinalisedRef = useRef(onFinalised);
  useEffect(() => { onFinalisedRef.current = onFinalised; }, [onFinalised]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(citySlug));
      if (raw) setItinerary(JSON.parse(raw) as Itinerary);
    } catch {}
  }, [citySlug]);

  // Persist on every change
  useEffect(() => {
    if (itinerary === null) return;
    try {
      localStorage.setItem(storageKey(citySlug), JSON.stringify(itinerary));
    } catch {}
  }, [citySlug, itinerary]);

  const initItinerary = useCallback(
    (tripLength: number, arrival: string | null, scoredEntries: ScoredEntry[]) => {
      const now = new Date().toISOString();
      const next: Itinerary = {
        id: crypto.randomUUID(),
        citySlug,
        createdAt: now,
        updatedAt: now,
        tripLength,
        days: generateDays(tripLength, arrival, scoredEntries, citySlug),
      };
      setItinerary(next);
    },
    [citySlug]
  );

  const hydrateItinerary = useCallback(
    (days: ItineraryDay[], tripLength: number) => {
      const now = new Date().toISOString();
      const next: Itinerary = {
        id: crypto.randomUUID(),
        citySlug,
        createdAt: now,
        updatedAt: now,
        tripLength,
        days,
      };
      setItinerary(next);
      localStorage.setItem(
        `sonder_itinerary_${citySlug}`,
        JSON.stringify(next)
      );
    },
    [citySlug]
  );

  const addEntry = useCallback(
    (entry: EntryCardData, dayNumber: number, timeBlock: TimeBlock) => {
      setItinerary((prev) => {
        if (!prev) return prev;
        // No-op if already added anywhere in the itinerary
        const alreadyAdded = prev.days.some((d) =>
          d.slots.some((s) => s.entryId === entry.id)
        );
        if (alreadyAdded) return prev;

        const slot: ItinerarySlot = {
          id: crypto.randomUUID(),
          entryId: entry.id,
          timeBlock,
          notes: null,
          entrySnapshot: makeSnapshot(entry, citySlug),
        };

        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          days: prev.days.map((d) =>
            d.dayNumber === dayNumber
              ? { ...d, slots: [...d.slots, slot] }
              : d
          ),
        };
      });
    },
    [citySlug]
  );

  const removeEntry = useCallback((slotId: string) => {
    setItinerary((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        days: prev.days.map((d) => ({
          ...d,
          slots: d.slots.filter((s) => s.id !== slotId),
        })),
      };
    });
  }, []);

  const swapEntry = useCallback(
    (slotId: string, newEntry: EntryCardData) => {
      setItinerary((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          days: prev.days.map((d) => ({
            ...d,
            slots: d.slots.map((s) =>
              s.id === slotId
                ? {
                    ...s,
                    entryId: newEntry.id,
                    entrySnapshot: makeSnapshot(newEntry, citySlug),
                  }
                : s
            ),
          })),
        };
      });
    },
    [citySlug]
  );

  const moveEntry = useCallback(
    (slotId: string, toDayNumber: number, toTimeBlock: TimeBlock) => {
      setItinerary((prev) => {
        if (!prev) return prev;

        const movedSlot: ItinerarySlot | undefined = prev.days
          .flatMap((d) => d.slots)
          .find((s) => s.id === slotId);

        if (!movedSlot) return prev;

        const daysWithoutSlot = prev.days.map((d) => ({
          ...d,
          slots: d.slots.filter((s) => s.id !== slotId),
        }));

        const updated: ItinerarySlot = { ...movedSlot, timeBlock: toTimeBlock };

        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          days: daysWithoutSlot.map((d) =>
            d.dayNumber === toDayNumber
              ? { ...d, slots: [...d.slots, updated] }
              : d
          ),
        };
      });
    },
    []
  );

  const finaliseItinerary = useCallback(() => {
    setItinerary((prev) => {
      if (!prev) return prev;
      const finalised = { ...prev, finalised: true, updatedAt: new Date().toISOString() };
      try {
        localStorage.setItem(storageKey(citySlug), JSON.stringify(finalised));
      } catch {}
      return finalised;
    });
    // Post-finalisation trigger -- fires after state is scheduled
    onFinalisedRef.current?.();
  }, [citySlug]);

  const clearItinerary = useCallback(() => {
    try {
      localStorage.removeItem(storageKey(citySlug));
    } catch {}
    setItinerary(null);
  }, [citySlug]);

  return {
    itinerary,
    initItinerary,
    hydrateItinerary,
    addEntry,
    removeEntry,
    swapEntry,
    moveEntry,
    finaliseItinerary,
    clearItinerary,
  };
}
