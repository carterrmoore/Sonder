import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import { SharedItineraryView } from "@/components/SharedItineraryView";
import type { ItineraryDay } from "@/types/itinerary";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#1a1a18",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display, Georgia, serif)",
          fontSize: "28px",
          fontWeight: 400,
          color: "#fff",
          letterSpacing: "-0.4px",
          margin: "0 0 12px",
        }}
      >
        This itinerary isn&apos;t available.
      </h1>

      <p
        style={{
          fontFamily: "var(--font-body, system-ui, sans-serif)",
          fontSize: "14px",
          color: "rgba(255,255,255,0.55)",
          margin: "0 0 24px",
        }}
      >
        The link may have expired or been removed by its owner.
      </p>

      <a
        href="/krakow"
        style={{
          fontFamily: "var(--font-body, system-ui, sans-serif)",
          fontSize: "13px",
          fontWeight: 500,
          padding: "9px 18px",
          borderRadius: "8px",
          border: "0.5px solid rgba(255,255,255,0.25)",
          backgroundColor: "transparent",
          color: "rgba(255,255,255,0.7)",
          textDecoration: "none",
        }}
      >
        Explore Krak&oacute;w
      </a>
    </div>
  );
}

type DbItinerary = {
  id: string;
  user_id: string | null;
  city_slug: string;
  total_days: number;
  days: ItineraryDay[];
  trip_narrative: string | null;
  finalised_at: string;
};

export default async function SharedItineraryPage({ params }: PageProps) {
  const { token } = await params;

  // Step 1 — look up the share token
  const { data: share } = await adminClient
    .from("itinerary_shares")
    .select("id, itinerary_id, status, view_count")
    .eq("token", token)
    .single();

  if (!share || share.status === "revoked") {
    return <NotFound />;
  }

  // Step 2 — fetch the itinerary
  const { data: rawItinerary } = await adminClient
    .from("itineraries")
    .select("*")
    .eq("id", share.itinerary_id)
    .single();

  if (!rawItinerary) {
    return <NotFound />;
  }

  const itinerary = rawItinerary as unknown as DbItinerary;

  // Step 3 — increment view count (fire and forget)
  adminClient
    .from("itinerary_shares")
    .update({
      view_count: share.view_count + 1,
      last_viewed_at: new Date().toISOString(),
      ...(share.view_count === 0
        ? { first_viewed_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", share.id)
    .then(() => {});

  // Step 4 — fetch sharer display name
  const { data: owner } = itinerary.user_id
    ? await adminClient
        .from("users")
        .select("display_name, email")
        .eq("id", itinerary.user_id)
        .single()
    : { data: null };

  const sharerName =
    (owner as { display_name?: string | null; email?: string | null } | null)
      ?.display_name ??
    (owner as { display_name?: string | null; email?: string | null } | null)
      ?.email?.split("@")[0] ??
    "Someone";

  return (
    <SharedItineraryView
      itinerary={itinerary}
      sharerName={sharerName}
      shareToken={token}
    />
  );
}
