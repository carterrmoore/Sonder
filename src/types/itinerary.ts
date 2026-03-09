export interface Itinerary {
  id: string;          // crypto.randomUUID()
  citySlug: string;
  createdAt: string;   // ISO datetime
  updatedAt: string;
  tripLength: number;  // number of days
  days: ItineraryDay[];
}

export interface ItineraryDay {
  dayNumber: number;   // 1-indexed
  date: string | null; // ISO date if specific dates given, null if flexible
  slots: ItinerarySlot[];
}

export type TimeBlock = "morning" | "afternoon" | "evening";

export interface ItinerarySlot {
  id: string;          // crypto.randomUUID()
  entryId: string;
  entrySnapshot: SlotEntrySnapshot;
  timeBlock: TimeBlock;
  notes: string | null;
}

// Snapshot of entry data at time of adding — insulates itinerary
// from future entry edits
export interface SlotEntrySnapshot {
  name: string;
  category: string;
  neighbourhood: string | null;
  editorial_hook: string | null;
  slug: string | null;
  citySlug: string;
}

/** Set when the user clicks "Save itinerary" on the summary screen */
export type FinalisedItinerary = Itinerary & { finalised: true };
