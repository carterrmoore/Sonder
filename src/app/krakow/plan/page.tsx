import type { Metadata } from "next";
import { getApprovedEntries } from "@/lib/entries";
import { adminClient } from "@/lib/supabase/admin";
import PlanFlow from "@/components/PlanFlow";
import type { ItineraryDay } from "@/types/itinerary";

export const metadata: Metadata = {
  title: "Plan your trip — Kraków · Sonder",
  description: "Tell us about your trip and we'll shape the Kraków guide around you.",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ edit?: string }>;
}

type EditItinerary = {
  id: string;
  days: ItineraryDay[];
  total_days: number;
} | null;

export default async function KrakowPlanPage({ searchParams }: PageProps) {
  // TODO: Read utm_source, utm_medium, utm_campaign, utm_content from searchParams
  // and store in session for attribution when user completes signup.
  // See prd-shareable-itineraries.md section 7 for full spec.
  const { edit } = await searchParams;
  const entries = await getApprovedEntries("21b778e8-0b37-4adc-ae10-5a226929c59c");

  let editItinerary: EditItinerary = null;
  if (edit) {
    const { data } = await adminClient
      .from("itineraries")
      .select("id, days, total_days")
      .eq("id", edit)
      .single();
    if (data) {
      editItinerary = data as unknown as EditItinerary;
    }
  }

  return <PlanFlow entries={entries} editItinerary={editItinerary} />;
}
