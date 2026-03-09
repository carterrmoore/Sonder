"use client";

import { useState, useEffect, useCallback } from "react";
import type { Itinerary, ItineraryDay, ItinerarySlot, TimeBlock } from "@/types/itinerary";
import type { EntryCardData } from "@/lib/entries";

function storageKey(citySlug: string): string {
  return `sonder_itinerary_${citySlug}`;
}

function buildDays(tripLength: number, arrival: string | null): ItineraryDay[] {
  return Array.from({ length: tripLength }, (_, i) => {
    let date: string | null = null;
    if (arrival) {
      const d = new Date(arrival);
      d.setDate(d.getDate() + i);
      date = d.toISOString().slice(0, 10);
    }
    return { dayNumber: i + 1, date, slots: [] };
  });
}

export function useItinerary(citySlug: string) {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);

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
    (tripLength: number, arrival: string | null) => {
      const now = new Date().toISOString();
      const next: Itinerary = {
        id: crypto.randomUUID(),
        citySlug,
        createdAt: now,
        updatedAt: now,
        tripLength,
        days: buildDays(tripLength, arrival),
      };
      setItinerary(next);
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
          entrySnapshot: {
            name: entry.name,
            category: entry.category,
            neighbourhood: entry.neighbourhood,
            editorial_hook: entry.editorial_hook,
            slug: entry.slug,
            citySlug,
          },
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

  const clearItinerary = useCallback(() => {
    try {
      localStorage.removeItem(storageKey(citySlug));
    } catch {}
    setItinerary(null);
  }, [citySlug]);

  return { itinerary, initItinerary, addEntry, removeEntry, moveEntry, clearItinerary };
}
