// src/components/BookingSection.tsx
// Booking pathway integration — Step 9
// Renders appropriate booking options per entry category.
// Used in /krakow/[slug] entry detail pages.
//
// TOKEN PATHS: flat — tokens.ink, tokens.sp12, tokens.radiusButton, etc.
// SAFARI RULE: tokens.* in style={{}} only. var(--token) only in className CSS.
//
// "use client" required: Stay22 widget mounts client-side.

"use client";

import { tokens } from "@/lib/tokens";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BookingOptions {
  category:
    | "restaurant"
    | "cafe"
    | "accommodation"
    | "tour"
    | "sight"
    | "nightlife";
  viator_product_code: string | null;
  gyg_listing_url: string | null;
  google_place_id: string | null;
  entry_name: string;
}

// ── Affiliate URL builder ─────────────────────────────────────────────────────
// Viator partner deep-link format.
// NEXT_PUBLIC_VIATOR_PARTNER_ID must be set in .env.local and Vercel env.

function buildViatorUrl(productCode: string): string {
  const pid = process.env.NEXT_PUBLIC_VIATOR_PARTNER_ID ?? "";
  return `https://www.viator.com/tours/${productCode}?pid=${pid}&mcid=42383&medium=api&medium_version=selector`;
}


// ── BookingSection ────────────────────────────────────────────────────────────

export function BookingSection({ options }: { options: BookingOptions }) {
  const {
    category,
    viator_product_code,
    gyg_listing_url,
    google_place_id,
    entry_name,
  } = options;

  if (category === "accommodation") {
    if (!google_place_id) return null;
    return (
      <Stay22Section googlePlaceId={google_place_id} entryName={entry_name} />
    );
  }

  if (category === "tour" || category === "sight") {
    const hasViator = Boolean(viator_product_code);
    const hasGYG = Boolean(gyg_listing_url);
    if (!hasViator && !hasGYG) return null;

    return (
      <BookingContainer>
        <BookingHeading>Book this experience</BookingHeading>

        {hasViator && (
          <BookingButton
            href={buildViatorUrl(viator_product_code!)}
            label="Book on Viator"
            isPrimary
          />
        )}

        {hasGYG && (
          <BookingButton
            href={gyg_listing_url!}
            label="View on GetYourGuide"
            isPrimary={!hasViator}
          />
        )}

        <AffiliateDisclosure />
      </BookingContainer>
    );
  }

  return null;
}

// ── Stay22 Section ────────────────────────────────────────────────────────────

function Stay22Section({
  googlePlaceId,
  entryName,
}: {
  googlePlaceId: string;
  entryName: string;
}) {
  const affiliateId =
    process.env.NEXT_PUBLIC_STAY22_AFFILIATE_ID ?? "sonder";

  return (
    <BookingContainer>
      <BookingHeading>Where to stay nearby</BookingHeading>
      <p
        style={{
          fontFamily: tokens.fontBody,
          fontSize: tokens.textBodySm,
          color: tokens.ink,
          opacity: 0.52,
          margin: `0 0 ${tokens.sp16} 0`,
          lineHeight: 1.5,
        }}
      >
        Accommodation options near {entryName}.
      </p>

      {/* Stay22 widget — picked up by the Stay22 script */}
      <div
        id={`stay22-widget-${googlePlaceId}`}
        data-s22-type="widget"
        data-s22-affiliate-id={affiliateId}
        data-s22-search-term={entryName}
        style={{
          width: "100%",
          minHeight: "400px",
          borderRadius: tokens.radiusCard,
          overflow: "hidden",
          backgroundColor: "rgba(26,26,24,0.03)",
          border: "1px solid rgba(26,26,24,0.08)",
        }}
      />

      <AffiliateDisclosure />
    </BookingContainer>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function BookingContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: tokens.sp48,
        paddingTop: tokens.sp32,
        borderTop: "1px solid rgba(26,26,24,0.1)",
      }}
    >
      {children}
    </div>
  );
}

function BookingHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: tokens.fontBody,
        fontSize: tokens.textOverline,
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase" as const,
        color: tokens.ink,
        opacity: 0.38,
        margin: `0 0 ${tokens.sp16} 0`,
      }}
    >
      {children}
    </h2>
  );
}

function BookingButton({
  href,
  label,
  isPrimary,
}: {
  href: string;
  label: string;
  isPrimary: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: tokens.sp8,
        padding: `${tokens.sp12} ${tokens.sp24}`,
        backgroundColor: isPrimary ? tokens.ink : "transparent",
        color: isPrimary ? tokens.warm : tokens.ink,
        border: `1px solid ${isPrimary ? tokens.ink : "rgba(26,26,24,0.2)"}`,
        borderRadius: tokens.radiusButton,
        fontFamily: tokens.fontBody,
        fontSize: tokens.textBodySm,
        fontWeight: 500,
        textDecoration: "none",
        marginRight: tokens.sp12,
        marginBottom: tokens.sp16,
      }}
    >
      {label}
      <span style={{ opacity: 0.45 }}>&rarr;</span>
    </a>
  );
}

function AffiliateDisclosure() {
  return (
    <p
      style={{
        fontFamily: tokens.fontBody,
        fontSize: tokens.textCaption,
        color: tokens.ink,
        opacity: 0.4,
        margin: `${tokens.sp16} 0 0 0`,
        lineHeight: 1.5,
      }}
    >
      Booking links earn Sonder a small commission at no extra cost to you.
      Commission never influences which places are included. Every entry earns
      its place through the same filter regardless.{" "}
      <a
        href="/about/affiliate-disclosure"
        style={{
          color: tokens.ink,
          opacity: 0.7,
          textDecoration: "underline",
        }}
      >
        Learn more
      </a>
    </p>
  );
}

// ── Stay22 Script ─────────────────────────────────────────────────────────────
// Add <Stay22Script /> once to /krakow/[slug]/page.tsx or its layout wrapper.
// Loads asynchronously; picks up all [data-s22-type="widget"] divs on mount.

export function Stay22Script() {
  return (
    // eslint-disable-next-line @next/next/no-sync-scripts
    <script src="https://www.stay22.com/embed/gm" defer />
  );
}
