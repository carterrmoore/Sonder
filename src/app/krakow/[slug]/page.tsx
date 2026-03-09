import { notFound } from "next/navigation";
import { getEntryBySlug } from "@/lib/entries";
import EntryDetail from "@/components/EntryDetail";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function EntryDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const entry = await getEntryBySlug(slug);
  if (!entry) notFound();
  return <EntryDetail entry={entry} />;
}
