import Link from "next/link";
import { tokens } from "@/lib/tokens";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

// Max-width content wrapper applied inside every section.
// Sections bleed full-width with their background; content is capped here.
const contentWrapper: React.CSSProperties = {
  maxWidth: "1200px",
  marginLeft: "auto",
  marginRight: "auto",
  paddingLeft: "40px",
  paddingRight: "40px",
};

// Semantic color values used across the landing page.
// These are not yet in tokens.ts; defined here as constants so inline
// styles remain Safari-safe (no var() in style props).
const c = {
  textSecondary:       "rgba(26, 26, 24, 0.65)",
  textTertiary:        "rgba(26, 26, 24, 0.40)",
  borderPrimary:       "rgba(26, 26, 24, 0.18)",
  borderTertiary:      "rgba(26, 26, 24, 0.08)",
  backgroundSecondary: "#f5f0e8",
};

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

function OutlineCTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        border: `0.5px solid ${c.borderPrimary}`,
        backgroundColor: "transparent",
        color: tokens.ink,
        fontSize: "13px",
        fontWeight: 500,
        fontFamily: tokens.fontBody,
        padding: "10px 20px",
        borderRadius: tokens.radiusButton,
        textDecoration: "none",
      }}
    >
      {children}
      <ArrowIcon />
    </Link>
  );
}

export default function LandingPage() {
  return (
    <div style={{ fontFamily: tokens.fontBody }}>

      <Nav />

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section
        style={{
          backgroundColor: tokens.ink,
          minHeight: "500px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <div style={{ ...contentWrapper, paddingBottom: "56px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <p
          style={{
            fontFamily: tokens.fontBody,
            fontSize: "11px",
            letterSpacing: "2px",
            color: "rgba(255, 255, 255, 0.35)",
            textTransform: "uppercase",
            marginBottom: "16px",
            marginTop: 0,
          }}
        >
          KRAKÓW, POLAND
        </p>
        <h1
          style={{
            fontFamily: tokens.fontDisplay,
            fontSize: "58px",
            color: "#fff",
            lineHeight: 1.05,
            maxWidth: "520px",
            marginBottom: "18px",
            marginTop: 0,
            fontWeight: 400,
          }}
        >
          The places worth going. Nothing else.
        </h1>
        <p
          style={{
            fontFamily: tokens.fontBody,
            fontSize: "15px",
            color: "rgba(255, 255, 255, 0.55)",
            maxWidth: "400px",
            lineHeight: 1.65,
            marginBottom: "36px",
            marginTop: 0,
          }}
        >
          A hand-curated guide to Kraków. Every entry reviewed by someone who
          actually lives there, held to a standard most places don&apos;t survive.
        </p>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: "16px" }}>
          <Link
            href="/krakow/plan"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#C4922A",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 500,
              fontFamily: tokens.fontBody,
              padding: "13px 26px",
              borderRadius: tokens.radiusButton,
              textDecoration: "none",
            }}
          >
            Plan your Kraków trip
            <ArrowIcon />
          </Link>
          <Link
            href="/krakow"
            className="landing-secondary-cta"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              fontFamily: tokens.fontBody,
              color: "rgba(255, 255, 255, 0.7)",
              borderBottom: "0.5px solid rgba(255, 255, 255, 0.25)",
              paddingBottom: "1px",
              textDecoration: "none",
            }}
          >
            Explore Kraków first
            <ArrowIcon />
          </Link>
        </div>
        </div>
      </section>

      {/* ── PROBLEM ─────────────────────────────────────────────────────────── */}
      <section
        style={{
          backgroundColor: "#fff",
          borderBottom: `0.5px solid ${c.borderTertiary}`,
        }}
      >
        <div style={{ ...contentWrapper, paddingTop: "52px", paddingBottom: "52px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "40px",
          }}
        >
          <div style={{ maxWidth: "520px" }}>
            <h2
              style={{
                fontFamily: tokens.fontDisplay,
                fontSize: "28px",
                lineHeight: 1.3,
                letterSpacing: "-0.3px",
                marginBottom: "14px",
                marginTop: 0,
                color: tokens.ink,
                fontWeight: 400,
              }}
            >
              Spent an hour on TripAdvisor and still not sure where to eat?
            </h2>
            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "14px",
                color: c.textSecondary,
                lineHeight: 1.75,
                margin: 0,
              }}
            >
              That&apos;s because it&apos;s designed to show you everything, not
              the right thing. Sonder works differently. A local curator reviewed
              every entry. What&apos;s left is a short list you can actually trust.
            </p>
          </div>
          <div style={{ flexShrink: 0 }}>
            <OutlineCTA href="/krakow/plan">Start planning</OutlineCTA>
          </div>
        </div>
        </div>
      </section>

      {/* ── ENTRY CARDS ─────────────────────────────────────────────────────── */}
      <section
        style={{
          backgroundColor: "#fff",
        }}
      >
        <div style={{ ...contentWrapper, paddingTop: "52px", paddingBottom: "52px" }}>
        {/* Header row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "28px",
          }}
        >
          <h2
            style={{
              fontFamily: tokens.fontDisplay,
              fontSize: "22px",
              letterSpacing: "-0.2px",
              margin: 0,
              color: tokens.ink,
              fontWeight: 400,
            }}
          >
            A few things worth knowing about in Kraków
          </h2>
          <Link
            href="/krakow"
            className="landing-browse-link"
            style={{
              fontFamily: tokens.fontBody,
              fontSize: "13px",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Browse all of Kraków &rarr;
          </Link>
        </div>

        {/* Cards grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "18px",
          }}
        >
          {(
            [
              {
                name: "Camelot",
                neighbourhood: "Stare Miasto",
                category: "Café",
                imageBg: "#2e1f14",
                hook: "The café that Kraków\u2019s artists have been using as an office since before anyone called it that. Order the zapiekanka. Take the corner table if it\u2019s free.",
              },
              {
                name: "Alchemia",
                neighbourhood: "Kazimierz",
                category: "Bar",
                imageBg: "#151c28",
                hook: "Candlelit, crowded, no music loud enough to stop conversation. This is the bar that put Kazimierz on the map and the one that still deserves to be there.",
              },
              {
                name: "Stary Kleparz",
                neighbourhood: "Kleparz",
                category: "Market",
                imageBg: "#1e1a10",
                hook: "The market Krak\u00f3w residents actually use. Not the tourist stalls on the Rynek. Come on a Saturday morning before 9 and bring a bag.",
              },
            ] as const
          ).map(({ name, neighbourhood, category, imageBg, hook }) => (
            <div
              key={name}
              style={{
                borderRadius: "12px",
                border: `0.5px solid ${c.borderTertiary}`,
                overflow: "hidden",
              }}
            >
              {/* Image area */}
              <div
                style={{
                  height: "190px",
                  backgroundColor: imageBg,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignSelf: "flex-start",
                    backgroundColor: "rgba(255, 255, 255, 0.10)",
                    border: "0.5px solid rgba(255, 255, 255, 0.18)",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontFamily: tokens.fontBody,
                    color: "rgba(255, 255, 255, 0.7)",
                    padding: "3px 10px",
                    marginBottom: "7px",
                  }}
                >
                  {category}
                </div>
                <span
                  style={{
                    fontFamily: tokens.fontDisplay,
                    fontSize: "17px",
                    color: "#fff",
                    fontWeight: 400,
                  }}
                >
                  {name}
                </span>
              </div>
              {/* Card body */}
              <div style={{ padding: "15px 16px 18px" }}>
                <p
                  style={{
                    fontFamily: tokens.fontBody,
                    fontSize: "11px",
                    color: c.textTertiary,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: "7px",
                    marginTop: 0,
                  }}
                >
                  {neighbourhood}
                </p>
                <p
                  style={{
                    fontFamily: tokens.fontBody,
                    fontSize: "13px",
                    color: c.textSecondary,
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  {hook}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Cards footer row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "24px",
            borderTop: `0.5px solid ${c.borderTertiary}`,
            marginTop: "28px",
          }}
        >
          <p
            style={{
              fontFamily: tokens.fontBody,
              fontSize: "13px",
              color: c.textSecondary,
              margin: 0,
            }}
          >
            Cafés, restaurants, bars, sights, accommodation and tours across Kraków.
          </p>
          <OutlineCTA href="/krakow/plan">Build your itinerary</OutlineCTA>
        </div>
        </div>
      </section>

      {/* ── CITY GRID ───────────────────────────────────────────────────────── */}
      <section
        style={{
          backgroundColor: c.backgroundSecondary,
        }}
      >
        <div style={{ ...contentWrapper, paddingTop: "52px", paddingBottom: "52px" }}>
        <h2
          style={{
            fontFamily: tokens.fontDisplay,
            fontSize: "22px",
            color: tokens.ink,
            marginBottom: "6px",
            marginTop: 0,
            fontWeight: 400,
          }}
        >
          Where Sonder works
        </h2>
        <p
          style={{
            fontFamily: tokens.fontBody,
            fontSize: "13px",
            color: c.textSecondary,
            marginBottom: "28px",
            marginTop: 0,
          }}
        >
          Built city by city. Every entry reviewed before it goes live.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "12px",
          }}
        >
          {/* Kraków — live */}
          <div
            style={{
              borderRadius: "12px",
              border: `0.5px solid ${c.borderPrimary}`,
              padding: "20px",
              backgroundColor: "#fff",
            }}
          >
            <p
              style={{
                fontFamily: tokens.fontDisplay,
                fontSize: "19px",
                color: tokens.ink,
                margin: "0 0 4px 0",
                fontWeight: 400,
              }}
            >
              Kraków
            </p>
            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "11px",
                color: c.textTertiary,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                margin: "0 0 10px 0",
              }}
            >
              Poland
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "10px",
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "#1D9E75",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: "11px",
                  color: "#0F6E56",
                }}
              >
                Live now
              </span>
            </div>
            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "11px",
                color: c.textTertiary,
                margin: 0,
              }}
            >
              Cafés &middot; Restaurants &middot; Bars &middot; Sights &middot; Accommodation &middot; Tours
            </p>
          </div>

          {/* Coming-soon cities */}
          {(
            [
              { city: "Vienna",   country: "Austria" },
              { city: "Budapest", country: "Hungary" },
              { city: "Prague",   country: "Czech Republic" },
            ] as const
          ).map(({ city, country }) => (
            <div
              key={city}
              style={{
                borderRadius: "12px",
                border: `0.5px solid ${c.borderTertiary}`,
                padding: "20px",
                backgroundColor: "#fff",
              }}
            >
              <p
                style={{
                  fontFamily: tokens.fontDisplay,
                  fontSize: "19px",
                  color: tokens.ink,
                  margin: "0 0 4px 0",
                  fontWeight: 400,
                }}
              >
                {city}
              </p>
              <p
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: "11px",
                  color: c.textTertiary,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  margin: "0 0 10px 0",
                }}
              >
                {country}
              </p>
              <span
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: "11px",
                  color: c.textTertiary,
                }}
              >
                Coming soon
              </span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "28px" }}>
          <OutlineCTA href="/krakow/plan">Start with Kraków</OutlineCTA>
        </div>
        </div>
      </section>

      {/* ── ABOUT STRIP ─────────────────────────────────────────────────────── */}
      <section
        style={{
          backgroundColor: "#fff",
          borderTop: `0.5px solid ${c.borderTertiary}`,
        }}
      >
        <div style={{ ...contentWrapper, paddingTop: "52px", paddingBottom: "52px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "40px",
          }}
        >
          <div style={{ maxWidth: "520px" }}>
            <h2
              style={{
                fontFamily: tokens.fontDisplay,
                fontSize: "19px",
                lineHeight: 1.5,
                letterSpacing: "-0.2px",
                marginBottom: "12px",
                marginTop: 0,
                color: tokens.ink,
                fontWeight: 400,
              }}
            >
              Travel research is broken. We fixed it for Kraków.
            </h2>
            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "13px",
                color: c.textSecondary,
                lineHeight: 1.75,
                margin: 0,
              }}
            >
              Sonder is a curated travel platform for independent travelers who
              would rather have twenty trusted recommendations than two thousand
              uncertain ones. No paid placements. No review aggregation. No
              incentive to show you something you shouldn&apos;t go to.
            </p>
          </div>
          <div style={{ flexShrink: 0 }}>
            <OutlineCTA href="/how-it-works">See how it works</OutlineCTA>
          </div>
        </div>
        </div>
      </section>

      <Footer />

    </div>
  );
}
