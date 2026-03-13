// src/app/about/affiliate-disclosure/page.tsx
// Affiliate disclosure — static page.
//
// Layout matches the Essentials page: CityLayout + StaticPageSidebar.
// Token paths: flat — tokens.ink, tokens.sp*, tokens.fontDisplay, etc.
// SAFARI RULE: tokens.* in style={{}} only. var(--token) only in className CSS.

import type { Metadata } from "next";
import CityLayout from "@/components/layout/CityLayout";
import StaticPageSidebar from "@/components/layout/StaticPageSidebar";
import { tokens } from "@/lib/tokens";

// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Affiliate Disclosure | Sonder",
  description:
    "How Sonder uses affiliate links and the role commissions play in our curation process.",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AffiliateDisclosurePage() {
  return (
    <CityLayout sidebar={<StaticPageSidebar />}>
      <div
        style={{
          padding: `${tokens.sp48} ${tokens.sp32} ${tokens.sp96}`,
        }}
      >
        {/* Page header */}
        <header style={{ marginBottom: tokens.sp48 }}>
          <h1
            style={{
              fontFamily: tokens.fontDisplay,
              fontSize: tokens.textDisplayLg,
              fontWeight: 400,
              lineHeight: 1.15,
              color: tokens.ink,
              margin: `0 0 ${tokens.sp16} 0`,
            }}
          >
            Affiliate Disclosure
          </h1>
        </header>

        {/* Body */}
        <div style={{ maxWidth: "640px" }}>
          <p
            style={{
              fontFamily: tokens.fontBody,
              fontSize: tokens.textBodyMd,
              lineHeight: 1.7,
              color: tokens.ink,
              opacity: 0.8,
              margin: `0 0 ${tokens.sp16} 0`,
            }}
          >
            Sonder earns a commission when you book through links on this site.
            We partner with Viator, GetYourGuide, and Stay22 for tours,
            experiences, and accommodation bookings. These commissions help keep
            Sonder free to use.
          </p>

          <p
            style={{
              fontFamily: tokens.fontBody,
              fontSize: tokens.textBodyMd,
              lineHeight: 1.7,
              color: tokens.ink,
              opacity: 0.8,
              margin: `0 0 ${tokens.sp16} 0`,
            }}
          >
            Booking links are added only after an entry has passed the full
            curation filter. Commission relationships play no role in which
            places are included or excluded. An entry recommended here would
            receive the same recommendation if no affiliate relationship existed.
          </p>

          <p
            style={{
              fontFamily: tokens.fontBody,
              fontSize: tokens.textBodyMd,
              lineHeight: 1.7,
              color: tokens.ink,
              opacity: 0.8,
              margin: 0,
            }}
          >
            If you prefer to book direct, every entry detail page lists the
            venue&rsquo;s own website where available.
          </p>
        </div>
      </div>
    </CityLayout>
  );
}
