import type { Metadata } from "next";
import PreferenceQuestionnaire from "@/components/PreferenceQuestionnaire";

export const metadata: Metadata = {
  title: "Plan your trip — Kraków · Sonder",
  description: "Tell us about your trip and we'll shape the Kraków guide around you.",
};

export default function KrakowPlanPage() {
  return <PreferenceQuestionnaire citySlug="krakow" />;
}
