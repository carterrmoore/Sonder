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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: entry.name,
    description: entry.editorial_hook ?? entry.insider_tip ?? undefined,
    url: `https://sonderapp.co/krakow/${entry.slug}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Kraków",
      addressCountry: "PL",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EntryDetail entry={entry} />
    </>
  );
}
