import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { ItineraryView } from "@/components/ItineraryView";
import type { ItineraryDay } from "@/types/itinerary";
import type { EntryMetaHint } from "@/types/handoff-types";

export const metadata: Metadata = {
  title: "Your itinerary — Sonder",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

type DbItinerary = {
  id: string;
  user_id: string | null;
  city_id: string;
  total_days: number;
  days: ItineraryDay[];
  entry_meta: Record<string, EntryMetaHint> | null;
  trip_narrative: string | null;
  finalised_at: string;
  handoff_version: number | null;
};

export default async function ItineraryPage({ params }: PageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const hasMagicLinkAccess = cookieStore.has(`sonder_itinerary_access_${id}`);

  const { data: rawItinerary } = await adminClient
    .from("itineraries")
    .select("*")
    .eq("id", id)
    .single();

  if (!rawItinerary) redirect("/krakow");

  const itinerary = rawItinerary as unknown as DbItinerary;

  // Determine ownership
  let isOwner = false;
  if (authUser) {
    const { data: user } = await adminClient
      .from("users")
      .select("id")
      .eq("auth_id", authUser.id)
      .single();
    isOwner = user?.id === itinerary.user_id;
  }

  // Access control: owner, magic link cookie, or unowned (no user_id) itinerary
  const canAccess = isOwner || hasMagicLinkAccess || itinerary.user_id === null;
  if (!canAccess) redirect("/krakow");

  const isMagicLinkSession =
    !isOwner && (hasMagicLinkAccess || itinerary.user_id === null);

  return (
    <ItineraryView
      itinerary={itinerary}
      isOwner={isOwner}
      isMagicLinkSession={isMagicLinkSession}
    />
  );
}
