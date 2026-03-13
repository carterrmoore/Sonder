import type { Metadata } from "next";
import { getApprovedEntries } from "@/lib/entries";
import KrakowGuide from "@/components/KrakowGuide";

export const metadata: Metadata = {
  title: "Kraków — Sonder",
  description:
    "Thirty-one carefully chosen places in Kraków. Restaurants, cafés, accommodation, and experiences chosen by people who live here.",
};

export const dynamic = "force-dynamic";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TouristDestination",
  name: "Kraków, Poland",
  description:
    "Curated travel recommendations for Kraków — restaurants, cafés, bars, and experiences chosen by people who know the city.",
  url: "https://sonderapp.co/krakow",
  publisher: {
    "@type": "Organization",
    name: "Sonder",
    url: "https://sonderapp.co",
  },
};

export default async function KrakowPage() {
  const entries = await getApprovedEntries("21b778e8-0b37-4adc-ae10-5a226929c59c");
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <KrakowGuide entries={entries} />
    </>
  );
}
