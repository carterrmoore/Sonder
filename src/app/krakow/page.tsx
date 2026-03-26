import type { Metadata } from "next";
import Link from "next/link";
import { tokens } from "@/lib/tokens";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { MapPanel } from "@/components/index";
import type { MapZone } from "@/components/index";

// ── Metadata ───────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Kraków — Sonder",
  description:
    "A hand-curated guide to Kraków. Medieval centre, Jewish quarter, communist-era Nowa Huta, and a food scene most visitors miss entirely.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TouristDestination",
  name: "Kraków, Poland",
  description:
    "Curated travel recommendations for Kraków. Restaurants, cafés, bars, sights, and experiences chosen by people who know the city.",
  url: "https://sonderapp.co/krakow",
  publisher: {
    "@type": "Organization",
    name: "Sonder",
    url: "https://sonderapp.co",
  },
};

// ── City data (structured to be swappable from a params fetch in Phase 4) ──────

const krakowZones: MapZone[] = [
  {
    id: "stare-miasto",
    label: "Stare Miasto",
    description:
      "The old town. Medieval architecture, the Rynek Glowny, and cafés that have been there since before tourism was an industry. More depth than it looks like from the square.",
  },
  {
    id: "kazimierz",
    label: "Kazimierz",
    description:
      "The former Jewish quarter. Galleries, bars, and restaurants that arrived in the last twenty years without replacing what was already there. The best evening neighbourhood in the city.",
  },
  {
    id: "podgorze",
    label: "Podgórze",
    description:
      "South of the river. Industrially converted, genuinely local, and largely missed by visitors who don\u2019t cross the bridge. Worth half a day at minimum.",
  },
  {
    id: "nowa-huta",
    label: "Nowa Huta",
    description:
      "A complete socialist-realist city built in the 1950s as a counterweight to Kraków\u2019s bourgeois character. One of the most unusual urban environments in Europe.",
  },
  {
    id: "kleparz",
    label: "Kleparz",
    description:
      "The market district just north of the old town. Quieter and more residential than Stare Miasto, with a handful of places that would be famous if they were somewhere more visible.",
  },
  {
    id: "zwierzyniec",
    label: "Zwierzyniec",
    description:
      "The western residential district running along the river. Where you stay if you want to feel like a resident rather than a visitor.",
  },
];

// ── Shared design constants (Safari-safe, no var() in inline styles) ───────────

const c = {
  textSecondary:       "rgba(26, 26, 24, 0.65)",
  textTertiary:        "rgba(26, 26, 24, 0.40)",
  borderPrimary:       "rgba(26, 26, 24, 0.18)",
  borderTertiary:      "rgba(26, 26, 24, 0.08)",
  backgroundSecondary: tokens.warm,
};

// ── Layout ─────────────────────────────────────────────────────────────────────

const contentWrapper: React.CSSProperties = {
  maxWidth: "1200px",
  marginLeft: "auto",
  marginRight: "auto",
  paddingLeft: "40px",
  paddingRight: "40px",
};

// ── Shared sub-components ──────────────────────────────────────────────────────

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

function GoldCTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        backgroundColor: "#C4922A",
        color: "#fff",
        fontSize: "14px",
        fontWeight: 500,
        fontFamily: tokens.fontBody,
        padding: "13px 26px",
        borderRadius: tokens.radiusButton,
        textDecoration: "none",
      }}
    >
      {children}
      <ArrowIcon />
    </Link>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function KrakowPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div style={{ fontFamily: tokens.fontBody }}>

        <Nav />

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section
          style={{
            backgroundColor: tokens.ink,
            paddingTop: "52px",
            paddingBottom: "44px",
          }}
        >
          <div style={contentWrapper}>
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
              Kraków
            </p>

            <h1
              style={{
                fontFamily: tokens.fontDisplay,
                fontSize: "46px",
                color: "#fff",
                lineHeight: 1.08,
                maxWidth: "480px",
                marginBottom: "16px",
                marginTop: 0,
                fontWeight: 400,
                letterSpacing: "-0.6px",
              }}
            >
              A city that rewards the curious.
            </h1>

            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "14px",
                color: "rgba(255, 255, 255, 0.5)",
                maxWidth: "440px",
                lineHeight: 1.7,
                marginBottom: "32px",
                marginTop: 0,
              }}
            >
              Medieval centre, Jewish quarter, communist-era Nowa Huta, and a food
              scene that most visitors miss entirely. Kraków takes longer than a
              weekend to understand, but we can get you started.
            </p>

            {/* Stats row */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: "32px",
                marginBottom: "36px",
              }}
            >
              {([
                { number: "94", label: "Curated entries" },
                { number: "6",  label: "Neighbourhoods" },
                { number: "15", label: "Guides" },
              ] as const).map(({ number, label }) => (
                <div key={label}>
                  <div
                    style={{
                      fontFamily: tokens.fontDisplay,
                      fontSize: "28px",
                      color: "#fff",
                      letterSpacing: "-0.3px",
                      lineHeight: 1,
                      fontWeight: 400,
                    }}
                  >
                    {number}
                  </div>
                  <div
                    style={{
                      fontFamily: tokens.fontBody,
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.8px",
                      color: "rgba(255, 255, 255, 0.35)",
                      marginTop: "4px",
                    }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div style={{ display: "flex", flexDirection: "row", gap: "12px" }}>
              <GoldCTA href="/krakow/plan">Start planning your trip</GoldCTA>

              <Link
                href="/krakow/essentials"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  border: "0.5px solid rgba(255, 255, 255, 0.2)",
                  backgroundColor: "transparent",
                  color: "rgba(255, 255, 255, 0.7)",
                  fontSize: "13px",
                  fontFamily: tokens.fontBody,
                  padding: "10px 20px",
                  borderRadius: tokens.radiusButton,
                  textDecoration: "none",
                }}
              >
                City Essentials
              </Link>
            </div>
          </div>
        </section>

        {/* ── NEIGHBOURHOODS ───────────────────────────────────────────────── */}
        <section
          style={{
            backgroundColor: "#fff",
            borderTop: `0.5px solid ${c.borderTertiary}`,
          }}
        >
          <div style={{ ...contentWrapper, paddingTop: "48px", paddingBottom: "48px" }}>
            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "2px",
                color: c.textTertiary,
                marginBottom: "12px",
                marginTop: 0,
              }}
            >
              Neighbourhoods
            </p>

            <h2
              style={{
                fontFamily: tokens.fontDisplay,
                fontSize: "24px",
                letterSpacing: "-0.2px",
                marginBottom: "24px",
                marginTop: 0,
                color: tokens.ink,
                fontWeight: 400,
              }}
            >
              Six distinct parts of the city
            </h2>

            <MapPanel
              mode="zones"
              height={480}
              headerLabel="6 neighbourhoods"
              citySlug="krakow"
              zones={krakowZones}
            />

            <div style={{ marginTop: "20px" }}>
              <OutlineCTA href="/krakow/plan">
                Build a neighbourhood-first itinerary
              </OutlineCTA>
            </div>
          </div>
        </section>

        {/* ── GUIDES ───────────────────────────────────────────────────────── */}
        <section
          style={{
            backgroundColor: c.backgroundSecondary,
            borderTop: `0.5px solid ${c.borderTertiary}`,
          }}
        >
          <div style={{ ...contentWrapper, paddingTop: "48px", paddingBottom: "48px" }}>
            {/* Header row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: "24px",
              }}
            >
              <div>
                <p
                  style={{
                    fontFamily: tokens.fontBody,
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "2px",
                    color: c.textTertiary,
                    marginBottom: "12px",
                    marginTop: 0,
                  }}
                >
                  Guides
                </p>
                <h2
                  style={{
                    fontFamily: tokens.fontDisplay,
                    fontSize: "24px",
                    letterSpacing: "-0.2px",
                    margin: 0,
                    color: tokens.ink,
                    fontWeight: 400,
                  }}
                >
                  Read before you go
                </h2>
              </div>

              <Link
                href="/krakow/guides"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontFamily: tokens.fontBody,
                  fontSize: "13px",
                  color: c.textSecondary,
                  textDecoration: "none",
                  borderBottom: `0.5px solid rgba(26, 26, 24, 0.12)`,
                  paddingBottom: "1px",
                  whiteSpace: "nowrap",
                }}
              >
                All guides
                <ArrowIcon />
              </Link>
            </div>

            {/* Article cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "16px",
                marginBottom: "28px",
              }}
            >
              {([
                {
                  slug:        "where-to-eat-in-kazimierz",
                  category:    "Eating + Drinking",
                  headline:    "Where to eat in Kazimierz without walking into the wrong place",
                  description: "The neighbourhood has more restaurants per block than anywhere else in Kraków, which means more bad ones too. Here is how to tell the difference before you sit down.",
                },
                {
                  slug:        "krakow-coffee-culture",
                  category:    "Cafés",
                  headline:    "Kraków has a serious coffee culture. Most visitors miss all of it.",
                  description: "The city has been roasting its own beans since before third-wave became a phrase. The places worth going to are not on the main square.",
                },
                {
                  slug:        "nowa-huta",
                  category:    "Neighbourhoods",
                  headline:    "Nowa Huta is not a detour. It is the point.",
                  description: "Most itineraries treat it as an optional add-on. It shouldn\u2019t be. Understanding it changes how you see the rest of the city.",
                },
                {
                  slug:        "first-day-in-krakow",
                  category:    "First-time visitors",
                  headline:    "Your first day in Kraków, done properly",
                  description: "A sequence that gets you past the Rynek, into Kazimierz by evening, and back across the river before dark. In that order, for reasons that become obvious once you do it.",
                },
              ] as const).map(({ slug, category, headline, description }) => (
                <Link
                  key={slug}
                  href={`/krakow/guides/${slug}`}
                  className="city-article-card"
                  style={{
                    display: "block",
                    borderRadius: "12px",
                    border: `0.5px solid ${c.borderTertiary}`,
                    padding: "22px",
                    backgroundColor: "#fff",
                    textDecoration: "none",
                  }}
                >
                  <p
                    style={{
                      fontFamily: tokens.fontBody,
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "1.5px",
                      color: c.textTertiary,
                      marginBottom: "10px",
                      marginTop: 0,
                    }}
                  >
                    {category}
                  </p>
                  <h3
                    style={{
                      fontFamily: tokens.fontDisplay,
                      fontSize: "17px",
                      lineHeight: 1.35,
                      letterSpacing: "-0.1px",
                      color: tokens.ink,
                      fontWeight: 400,
                      marginBottom: "8px",
                      marginTop: 0,
                    }}
                  >
                    {headline}
                  </h3>
                  <p
                    style={{
                      fontFamily: tokens.fontBody,
                      fontSize: "13px",
                      color: c.textSecondary,
                      lineHeight: 1.65,
                      margin: 0,
                    }}
                  >
                    {description}
                  </p>
                </Link>
              ))}
            </div>

            {/* Articles footer row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: "24px",
                borderTop: `0.5px solid ${c.borderTertiary}`,
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
                Fifteen guides to Kraków, updated as the city changes.
              </p>
              <OutlineCTA href="/krakow/plan">Start planning your trip</OutlineCTA>
            </div>
          </div>
        </section>

        {/* ── ENTRY COUNT GATE STRIP ────────────────────────────────────────── */}
        <section style={{ backgroundColor: c.backgroundSecondary }}>
          <div style={{ ...contentWrapper, paddingTop: "32px", paddingBottom: "32px" }}>
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: "12px",
                border: `0.5px solid ${c.borderTertiary}`,
                padding: "28px 32px",
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "24px",
              }}
            >
              {/* Left */}
              <div>
                <h2
                  style={{
                    fontFamily: tokens.fontDisplay,
                    fontSize: "19px",
                    letterSpacing: "-0.2px",
                    color: tokens.ink,
                    fontWeight: 400,
                    marginBottom: "6px",
                    marginTop: 0,
                  }}
                >
                  94 curated entries across Kraków, ready for your trip.
                </h2>
                <p
                  style={{
                    fontFamily: tokens.fontBody,
                    fontSize: "13px",
                    color: c.textSecondary,
                    lineHeight: 1.6,
                    maxWidth: "440px",
                    marginBottom: "12px",
                    marginTop: 0,
                  }}
                >
                  Every café, restaurant, bar, sight, accommodation option, and tour
                  we recommend, organised into a day-by-day itinerary built around
                  your travel style and dates.
                </p>

                {/* Category counts */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: "20px",
                    flexWrap: "wrap",
                  }}
                >
                  {([
                    { count: "18", label: "cafés" },
                    { count: "21", label: "restaurants" },
                    { count: "16", label: "bars" },
                    { count: "19", label: "sights" },
                    { count: "12", label: "accommodation" },
                    { count: "8",  label: "tours" },
                  ] as const).map(({ count, label }) => (
                    <span
                      key={label}
                      style={{
                        fontFamily: tokens.fontBody,
                        fontSize: "12px",
                        color: c.textSecondary,
                      }}
                    >
                      <span style={{ fontWeight: 500, color: tokens.ink }}>{count}</span>{" "}
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right */}
              <div style={{ flexShrink: 0 }}>
                <GoldCTA href="/krakow/plan">Build your itinerary</GoldCTA>
              </div>
            </div>
          </div>
        </section>

        {/* ── CITY ESSENTIALS PREVIEW ───────────────────────────────────────── */}
        <section
          style={{
            backgroundColor: "#fff",
            borderTop: `0.5px solid ${c.borderTertiary}`,
          }}
        >
          <div style={{ ...contentWrapper, paddingTop: "48px", paddingBottom: "48px" }}>
            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "2px",
                color: c.textTertiary,
                marginBottom: "12px",
                marginTop: 0,
              }}
            >
              City Essentials
            </p>

            <h2
              style={{
                fontFamily: tokens.fontDisplay,
                fontSize: "24px",
                letterSpacing: "-0.2px",
                color: tokens.ink,
                fontWeight: 400,
                marginBottom: "4px",
                marginTop: 0,
              }}
            >
              What you need to know before you arrive
            </h2>

            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "13px",
                color: c.textSecondary,
                marginBottom: "24px",
                marginTop: 0,
              }}
            >
              Practical orientation for Kraków. Currency, transport, tipping, when to go.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "14px",
              }}
            >
              {([
                {
                  topic:  "Getting around",
                  detail: "Trams cover the centre well. Old Town is walkable. Buy a 24-hour pass at any kiosk, not on the tram.",
                },
                {
                  topic:  "Currency",
                  detail: "Polish Zloty (PLN). Cards accepted widely in the centre. Kleparz market is cash only. ATMs are reliable.",
                },
                {
                  topic:  "When to go",
                  detail: "May and September are the right months. July is overrun. January is cold and quiet in a way some people love.",
                },
              ] as const).map(({ topic, detail }) => (
                <div
                  key={topic}
                  style={{
                    padding: "18px",
                    borderRadius: tokens.radiusCard,
                    backgroundColor: c.backgroundSecondary,
                  }}
                >
                  <p
                    style={{
                      fontFamily: tokens.fontBody,
                      fontSize: "13px",
                      fontWeight: 500,
                      color: tokens.ink,
                      marginBottom: "5px",
                      marginTop: 0,
                    }}
                  >
                    {topic}
                  </p>
                  <p
                    style={{
                      fontFamily: tokens.fontBody,
                      fontSize: "12px",
                      color: c.textSecondary,
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {detail}
                  </p>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "20px" }}>
              <OutlineCTA href="/krakow/essentials">Full City Essentials</OutlineCTA>
            </div>
          </div>
        </section>

        <Footer />

      </div>
    </>
  );
}
