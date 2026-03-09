import type { Metadata } from "next";
import { getApprovedEntries } from "@/lib/entries";
import ItineraryBuilder from "@/components/ItineraryBuilder";

export const metadata: Metadata = {
  title: "Your Kraków itinerary — Sonder",
  description: "Your day-by-day Kraków plan.",
};

export const dynamic = "force-dynamic";

export default async function KrakowItineraryPage() {
  const entries = await getApprovedEntries("21b778e8-0b37-4adc-ae10-5a226929c59c");
  return <ItineraryBuilder citySlug="krakow" entries={entries} />;
}
