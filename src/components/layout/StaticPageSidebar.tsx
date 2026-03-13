// src/components/layout/StaticPageSidebar.tsx
// Sidebar content for static pages (Essentials, Guides) that have no
// category filtering, no itinerary, and no preference state.
//
// Rendered inside CityLayout's <aside> shell via the sidebar prop.
// CityLayout owns the 280px fixed width, sticky positioning, border, and padding.
// This component only provides the content that goes inside that shell.
//
// "use client" required for usePathname active-state detection.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tokens } from "@/lib/tokens";

// ── Static nav items ──────────────────────────────────────────────────────────

const STATIC_NAV: Array<{ label: string; href: string }> = [
  { label: "City guide",  href: "/krakow" },
  { label: "Essentials",  href: "/krakow/essentials" },
  { label: "Guides",      href: "/krakow/guides" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function StaticPageSidebar() {
  const pathname = usePathname();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column" as const,
        height: "100%",
      }}
    >
      {/* City name header — mirrors CitySidebar's header block */}
      <div style={{ marginBottom: tokens.sp32 }}>
        <p
          style={{
            fontFamily: tokens.fontBody,
            fontSize: tokens.textOverline,
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            color: tokens.ink,
            opacity: 0.4,
            margin: `0 0 ${tokens.sp4} 0`,
          }}
        >
          Poland
        </p>
        <Link
          href="/krakow"
          style={{ textDecoration: "none" }}
        >
          <h1
            style={{
              fontFamily: tokens.fontDisplay,
              fontSize: tokens.textDisplayMd,
              fontWeight: 400,
              lineHeight: 1.2,
              color: tokens.ink,
              margin: 0,
            }}
          >
            Kraków
          </h1>
        </Link>
      </div>

      {/* Nav */}
      <nav aria-label="Kraków pages">
        <div
          style={{
            display: "flex",
            flexDirection: "column" as const,
            gap: tokens.sp4,
          }}
        >
          {STATIC_NAV.map(({ label, href }) => {
            // Active: exact match for sub-pages, prefix match for city guide
            const isActive =
              href === "/krakow"
                ? pathname === "/krakow"
                : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                style={{ textDecoration: "none" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: tokens.sp8,
                    padding: `${tokens.sp8} ${tokens.sp12}`,
                    borderRadius: tokens.radiusButton,
                    backgroundColor: isActive
                      ? "rgba(26,26,24,0.06)"
                      : "transparent",
                  }}
                >
                  {/* Active indicator dot — matches CitySidebar's accent dot pattern */}
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: isActive ? tokens.gold : "transparent",
                      border: isActive
                        ? "none"
                        : "1px solid rgba(26,26,24,0.2)",
                      flexShrink: 0,
                      transition: "background-color 0.15s ease",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: tokens.fontBody,
                      fontSize: tokens.textBodySm,
                      fontWeight: isActive ? 500 : 400,
                      color: tokens.ink,
                      opacity: isActive ? 1 : 0.55,
                      transition: "opacity 0.15s ease",
                    }}
                  >
                    {label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
