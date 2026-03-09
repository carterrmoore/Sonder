import type { Metadata } from "next";
import { getApprovedEntries } from "@/lib/entries";
import KrakowGuide from "@/components/KrakowGuide";

export const metadata: Metadata = {
  title: "Kraków — Sonder",
  description:
    "Thirty-one carefully chosen places in Kraków. Restaurants, cafés, accommodation, and experiences chosen by people who live here.",
};

export const dynamic = "force-dynamic";

export default async function KrakowPage() {
  const entries = await getApprovedEntries("21b778e8-0b37-4adc-ae10-5a226929c59c");
  return <KrakowGuide entries={entries} />;
}
