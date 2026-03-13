// src/app/krakow/essentials/page.tsx
// City Essentials — Step 7
//
// Layout:
//   CityLayout sidebar={<StaticPageSidebar />}
//   CityLayout owns the 280px aside shell.
//   StaticPageSidebar provides the nav content inside it.
//
// Token paths: flat on tokens object.
//   tokens.ink, tokens.warm, tokens.gold etc.
//   tokens.sp4 … tokens.sp96
//   tokens.radiusCard, tokens.radiusButton
//   tokens.fontDisplay, tokens.fontBody
//   tokens.textDisplayXl … tokens.textCaption, tokens.textOverline

import type { Metadata } from "next";
import CityLayout from "@/components/layout/CityLayout";
import StaticPageSidebar from "@/components/layout/StaticPageSidebar";
import { tokens } from "@/lib/tokens";

// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Kraków Essentials — Getting Around, When to Go, What to Know | Sonder",
  description:
    "Everything you need before you arrive: transport, money, language, neighbourhoods, and the tourist traps worth knowing about.",
};

// ── JSON-LD ───────────────────────────────────────────────────────────────────

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TouristDestination",
  name: "Kraków, Poland",
  description:
    "Practical travel information for Kraków: transport, money, neighbourhoods, seasonal advice, and what to avoid.",
  url: "https://sonderapp.co/krakow/essentials",
  publisher: {
    "@type": "Organization",
    name: "Sonder",
    url: "https://sonderapp.co",
  },
};

// ── Section anchors ───────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "getting-there",  label: "Getting there"  },
  { id: "getting-around", label: "Getting around" },
  { id: "when-to-go",     label: "When to go"     },
  { id: "money",          label: "Money"           },
  { id: "language",       label: "Language"        },
  { id: "neighbourhoods", label: "Neighbourhoods"  },
  { id: "what-to-avoid",  label: "What to avoid"  },
] as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EssentialsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <CityLayout sidebar={<StaticPageSidebar />}>
        <div
          style={{
            padding: `${tokens.sp48} ${tokens.sp32} ${tokens.sp96}`,
          }}
        >
          {/* Page header */}
          <header style={{ marginBottom: tokens.sp48 }}>
            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textOverline,
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
                color: tokens.ink,
                opacity: 0.45,
                marginBottom: tokens.sp8,
              }}
            >
              Kraków
            </p>
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
              Essentials
            </h1>
            <p
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textBodyLg,
                lineHeight: 1.6,
                color: tokens.ink,
                opacity: 0.65,
                maxWidth: "520px",
                margin: 0,
              }}
            >
              What you need to know before you arrive. No fluff — just the
              things that will make the trip work.
            </p>
          </header>

          {/* Section anchor nav */}
          <nav
            aria-label="Page sections"
            style={{
              borderTop: "1px solid rgba(26,26,24,0.1)",
              borderBottom: "1px solid rgba(26,26,24,0.1)",
              padding: `${tokens.sp16} 0`,
              marginBottom: tokens.sp48,
              display: "flex",
              flexWrap: "wrap" as const,
              gap: `${tokens.sp4} ${tokens.sp24}`,
            }}
          >
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                style={{
                  fontFamily: tokens.fontBody,
                  fontSize: tokens.textBodySm,
                  color: tokens.ink,
                  opacity: 0.55,
                  textDecoration: "none",
                }}
              >
                {s.label}
              </a>
            ))}
          </nav>

          {/* Prose content — max 680px */}
          <div style={{ maxWidth: "680px" }}>

            {/* ── Getting there ───────────────────────────────────────── */}
            <section id="getting-there" style={{ marginBottom: tokens.sp64 }}>
              <SectionHeading>Getting there</SectionHeading>

              <SubHeading>By air</SubHeading>
              <Prose>
                Kraków John Paul II International Airport (KRK) is the
                second-busiest airport in Poland and well connected for a city
                of its size. Ryanair, Wizz Air, and LOT operate frequent routes
                from across Europe. The airport is 11 kilometres west of the
                city centre.
              </Prose>
              <Prose>
                The 208 bus runs to Kraków Główny train station roughly every
                30 minutes and costs around 6 PLN. Journey time is 40–50
                minutes. Taxis to the city centre cost 50–80 PLN by meter —
                use the official rank outside arrivals, not the offers inside
                the terminal. Bolt and Uber operate from the airport and tend
                to be cheaper than official taxis in low-demand periods.
              </Prose>
              <Prose>
                There is no direct train from the airport to the city centre.
                Anyone suggesting otherwise means the Balice commuter rail,
                which terminates some distance from the terminal and requires
                a connecting bus — not worth the confusion when the 208 bus
                is straightforward.
              </Prose>

              <SubHeading>By train</SubHeading>
              <Prose>
                Kraków Główny is well connected by intercity rail. From Warsaw:
                PKP Intercity runs hourly, journey time around 2h 15min on the
                fastest services. From Wrocław: roughly 3.5 hours. From Prague:
                a direct overnight Nightjet runs three times weekly; daytime
                journeys require a change, total around 7–8 hours. Buy tickets
                through PKP Intercity or Koleo for Polish domestic routes.
              </Prose>

              <SubHeading>By bus</SubHeading>
              <Prose>
                FlixBus and RegioJet connect Kraków to major European cities at
                considerably lower prices than trains. The main bus station
                (MDA) is adjacent to the train station. For Zakopane, the PKS
                Kraków bus station behind Galeria Krakowska is the departure
                point — buses run every 20–30 minutes in summer.
              </Prose>
            </section>

            {/* ── Getting around ──────────────────────────────────────── */}
            <section id="getting-around" style={{ marginBottom: tokens.sp64 }}>
              <SectionHeading>Getting around</SectionHeading>

              <SubHeading>On foot</SubHeading>
              <Prose>
                The old city is walkable. Old Town to Kazimierz is 15 minutes
                at a comfortable pace. Kazimierz to Podgórze crosses the
                Vistula via the Powstańców Śląskich footbridge — 10 minutes.
                Most of what a first-time visitor wants to see can be covered
                on foot across a few days.
              </Prose>

              <SubHeading>Trams</SubHeading>
              <Prose>
                The tram network is excellent and locals actually use it. A
                single journey ticket (20 minutes) costs 3.80 PLN; a 60-minute
                ticket is 5 PLN. Lines 1, 6, 7, 13, and 24 are the most useful
                for visitors, connecting the main station, Old Town, Kazimierz,
                and Nowa Huta. Validate inside the vehicle — inspectors do
                check. The KMK Kraków app has real-time departures.
              </Prose>

              <SubHeading>Taxis and rideshare</SubHeading>
              <Prose>
                Bolt and Uber both operate reliably. A ride across the city
                centre costs 10–20 PLN. Do not use traditional taxis hailing
                from the main square — they frequently run unmetered fares for
                foreigners. If you use a taxi, call it via the Taxi Kraków or
                iTaxi app.
              </Prose>

              <SubHeading>Bikes</SubHeading>
              <Prose>
                Wavelo is Kraków's municipal bike-share with docking stations
                throughout the centre. Day passes are good value if you are
                covering multiple neighbourhoods. The Vistula riverside path
                from Wawel through Kazimierz into Podgórze is one of the better
                urban cycling routes in Central Europe.
              </Prose>
            </section>

            {/* ── When to go ──────────────────────────────────────────── */}
            <section id="when-to-go" style={{ marginBottom: tokens.sp64 }}>
              <SectionHeading>When to go</SectionHeading>

              <Prose>
                Kraków is a year-round city. But different months offer quite
                different experiences, and the promotional language around
                "perfect any time of year" glosses over real tradeoffs.
              </Prose>

              <SubHeading>May and June</SubHeading>
              <Prose>
                The best months. Crowds present but not overwhelming. Restaurant
                terraces open. The Vistula riverside comes alive. Weather
                reliably pleasant — highs around 18–22°C. The Dragon Parade
                (Parada Smoków) runs in early June: a genuinely good spectacle.
              </Prose>

              <SubHeading>July and August</SubHeading>
              <Prose>
                Peak season. The main square is uncomfortably crowded by
                mid-morning. Accommodation prices rise sharply. Several good
                local restaurants close for the owner's summer holiday — worth
                checking before booking. Evenings are warm, outdoor bars run
                late, and the city has the energy of genuine popularity. Go
                knowing what you are getting.
              </Prose>

              <SubHeading>September and October</SubHeading>
              <Prose>
                Probably the locals' favourite months. Summer crowds have
                thinned. Temperatures drop to a comfortable 13–18°C. The light
                in Kazimierz in October is exceptional. Jazz Autumn (Jesień
                Jazzowa) runs through October.
              </Prose>

              <SubHeading>November through March</SubHeading>
              <Prose>
                Winter Kraków is genuinely atmospheric — the castle in low fog,
                Christmas markets in the main square through December, fewer
                tourists at major sites. But: the city has an air quality
                problem in winter. Coal heating in the outlying areas produces
                smog that can be severe in November and December. Check
                airly.org before planning a full outdoor day. Some venues reduce
                hours or close from January through March — verify before
                visiting.
              </Prose>
              <Prose>
                The Szopki competition in early December (nativity scene displays
                at Wawel hill) is worth knowing about: genuinely beautiful,
                entirely Polish, and not marketed to tourists.
              </Prose>
            </section>

            {/* ── Money ───────────────────────────────────────────────── */}
            <section id="money" style={{ marginBottom: tokens.sp64 }}>
              <SectionHeading>Money</SectionHeading>

              <SubHeading>Currency</SubHeading>
              <Prose>
                Poland uses the Polish Złoty (PLN). As of early 2026, 1 EUR
                buys approximately 4.25 PLN. Poland is not on the Euro. Do not
                attempt to pay in Euros — a few large tourist restaurants near
                the main square accept them, but at rates that simply charge
                you more.
              </Prose>

              <SubHeading>Cash vs card</SubHeading>
              <Prose>
                This matters more than most guides acknowledge. Card payment is
                widely accepted at larger restaurants, hotels, and shops. But a
                significant portion of the best places on this platform — the
                small family restaurants in Kazimierz, the market stalls at
                Stary Kleparz, the craft beer bars on Plac Nowy, the zapiekanki
                stands at the Okrąglak — are cash only. Arriving with no cash
                will cause problems.
              </Prose>
              <Prose>
                Withdraw from bank ATMs (PKO Bank Polski, mBank, Alior) rather
                than the commercial currency exchange booths near the main
                square. The ATMs give you the real rate; the booths frequently
                do not. Decline the ATM's offer to convert the transaction to
                your home currency — that is dynamic currency conversion and the
                rate is poor.
              </Prose>
              <Prose>
                A rough guide: mid-range local restaurant meals run 35–65 PLN
                per person before drinks. A beer at a Kazimierz bar costs
                12–18 PLN. Coffee at a good café is 10–14 PLN. Main square
                restaurants charge nearly double.
              </Prose>
            </section>

            {/* ── Language ────────────────────────────────────────────── */}
            <section id="language" style={{ marginBottom: tokens.sp64 }}>
              <SectionHeading>Language</SectionHeading>

              <Prose>
                Polish is the first language of Kraków. In the tourist-facing
                parts of the city, English is widely spoken. In more local
                neighbourhoods — Kleparz, Nowa Huta, residential Kazimierz —
                you will encounter people who do not speak English.
              </Prose>
              <Prose>
                Attempting even a few Polish words is appreciated by locals in
                a way that is noticeable. Polish people are accustomed to
                tourists not trying at all. Trying a little, even badly, tends
                to produce warmth rather than correction.
              </Prose>

              <SubHeading>Useful phrases</SubHeading>
              <PhraseTable
                phrases={[
                  ["Dzień dobry",      "JYEN DOH-brih",       "Good day (use until evening)"],
                  ["Dobry wieczór",    "DOH-brih VYEH-choor", "Good evening"],
                  ["Dziękuję",         "JYEN-koo-yeh",        "Thank you"],
                  ["Przepraszam",      "psheh-PRAH-shahm",    "Excuse me / sorry"],
                  ["Poproszę",         "poh-PROH-sheh",       "Please / I'd like (use when ordering)"],
                  ["Ile to kosztuje?", "EE-leh toh kosh-TOO-yeh", "How much does this cost?"],
                  ["Smacznego",        "smach-NEH-goh",       "Enjoy your meal"],
                  ["Na zdrowie",       "nah ZDRO-vyeh",       "Cheers"],
                ]}
              />
            </section>

            {/* ── Neighbourhoods ──────────────────────────────────────── */}
            <section id="neighbourhoods" style={{ marginBottom: tokens.sp64 }}>
              <SectionHeading>Neighbourhoods</SectionHeading>

              <Prose>
                Kraków is compact. These are the neighbourhoods relevant to
                most visitors — each has a distinct character worth
                understanding before you plan where to spend your time.
              </Prose>

              <NeighbourhoodEntry
                name="Stare Miasto (Old Town)"
                character="The medieval core. Europe's largest market square anchors it. Dense with history, bars, and restaurants aimed primarily at tourists. Worth time for the architecture and night energy; worth scepticism when eating within 200 metres of the Rynek."
              />
              <NeighbourhoodEntry
                name="Kazimierz"
                character="The former Jewish quarter, now Kraków's most interesting neighbourhood for food, nightlife, and slow walking. Plac Nowy is the gravitational centre — zapiekanki from the round market hall, bars that open late, galleries in former prayer houses. Not sanitised. The history is real and present."
              />
              <NeighbourhoodEntry
                name="Podgórze"
                character="The south bank of the Vistula. Heavier history than most of the city — the wartime ghetto was here. Schindler's Factory museum is essential. The Zabłocie sub-district, a former industrial zone, now has some of the most serious restaurants and creative spaces in the city, almost entirely unknown to first-time visitors."
              />
              <NeighbourhoodEntry
                name="Nowa Huta"
                character="A Soviet-era planned city annexed into Kraków in 1951. Built to prove a model socialist city could function without bourgeois remnants. The architecture is extraordinary in the way utopian projects often are. Worth half a day, especially with a local guide. The tram from the centre takes 25 minutes."
              />
              <NeighbourhoodEntry
                name="Kleparz"
                character="Immediately north of the Old Town walls, largely overlooked by visitors. The Stary Kleparz market has been running since the 15th century and remains genuinely local — produce vendors, flower stalls, cheese makers. One of the few places in the city centre where the dominant language in any conversation is Polish."
              />
              <NeighbourhoodEntry
                name="Piasek"
                character="The residential neighbourhood west of the Old Town. Quieter, more local-facing, good for accommodation at prices that make sense. Streets around Karmelicka have neighbourhood restaurants worth knowing about."
              />
            </section>

            {/* ── What to avoid ───────────────────────────────────────── */}
            <section id="what-to-avoid" style={{ marginBottom: tokens.sp64 }}>
              <SectionHeading>What to avoid</SectionHeading>

              <Prose>
                Naming specific problems is more useful than vague warnings.
                These are places and patterns that consistently disappoint.
              </Prose>

              <AvoidEntry
                name="Restaurants on the main square"
                reason="Almost without exception, the restaurants directly facing the Rynek are mediocre food at premium prices, optimised for turnover. Getting a coffee or beer on a terrace is entirely reasonable — you are paying for the view, and it is worth it once. Eating a full meal here is not."
              />
              <AvoidEntry
                name="Floriańska Street restaurants"
                reason="The main tourist thoroughfare from the Barbican to the Rynek. The restaurant-to-quality ratio is poor. There are good things on Floriańska — shops and cafés — but not the sit-down restaurants that line it."
              />
              <AvoidEntry
                name="Airport money exchange booths"
                reason="Exchange rates at booths inside and immediately outside the airport typically run 10–15% worse than bank ATM rates. Withdraw PLN from a bank ATM instead."
              />
              <AvoidEntry
                name="Commercial salt mine tours from the main square"
                reason="Wieliczka Salt Mine is genuinely worth visiting. The commercial package tour operators near the square add a premium over booking directly at wieliczka.eu or taking the bus from near the main station."
              />
              <AvoidEntry
                name="Horse-drawn carriages"
                reason="Ongoing debates about animal welfare, poor way to see the city, and considerable expense. All three at once."
              />
              <AvoidEntry
                name="Wawel hill restaurants"
                reason="Two cafés on the castle hill that exist because they are the only option there. Eat before you visit Wawel, or descend to Kazimierz afterwards."
              />

              <Prose
                style={{
                  marginTop: tokens.sp32,
                  fontStyle: "italic",
                  opacity: 0.52,
                }}
              >
                For specific recommendations on what is worth your time, the
                city guide reflects entries that passed our curation filter.
                Everything on the platform earned its place.
              </Prose>
            </section>

          </div>
        </div>
      </CityLayout>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: tokens.fontDisplay,
        fontSize: tokens.textDisplayMd,
        fontWeight: 400,
        lineHeight: 1.2,
        color: tokens.ink,
        margin: `0 0 ${tokens.sp24} 0`,
      }}
    >
      {children}
    </h2>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontFamily: tokens.fontBody,
        fontSize: tokens.textHeadingMd,
        fontWeight: 600,
        lineHeight: 1.3,
        color: tokens.ink,
        margin: `${tokens.sp32} 0 ${tokens.sp12} 0`,
      }}
    >
      {children}
    </h3>
  );
}

function Prose({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <p
      style={{
        fontFamily: tokens.fontBody,
        fontSize: tokens.textBodyMd,
        lineHeight: 1.7,
        color: tokens.ink,
        opacity: 0.8,
        margin: `0 0 ${tokens.sp16} 0`,
        ...style,
      }}
    >
      {children}
    </p>
  );
}

function PhraseTable({
  phrases,
}: {
  phrases: [string, string, string][];
}) {
  return (
    <div
      style={{
        margin: `${tokens.sp16} 0 ${tokens.sp24} 0`,
        border: "1px solid rgba(26,26,24,0.1)",
        borderRadius: tokens.radiusCard,
        overflow: "hidden",
      }}
    >
      {phrases.map(([polish, pronunciation, meaning], i) => (
        <div
          key={polish}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: tokens.sp16,
            padding: `${tokens.sp12} ${tokens.sp16}`,
            backgroundColor:
              i % 2 === 0 ? "rgba(26,26,24,0.02)" : "transparent",
            borderTop: i > 0 ? "1px solid rgba(26,26,24,0.06)" : undefined,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textBodyMd,
                fontWeight: 500,
                color: tokens.ink,
                marginBottom: "2px",
              }}
            >
              {polish}
            </div>
            <div
              style={{
                fontFamily: tokens.fontBody,
                fontSize: tokens.textCaption,
                color: tokens.ink,
                opacity: 0.4,
              }}
            >
              {pronunciation}
            </div>
          </div>
          <div
            style={{
              fontFamily: tokens.fontBody,
              fontSize: tokens.textBodySm,
              color: tokens.ink,
              opacity: 0.65,
              alignSelf: "center",
            }}
          >
            {meaning}
          </div>
        </div>
      ))}
    </div>
  );
}

function NeighbourhoodEntry({
  name,
  character,
}: {
  name: string;
  character: string;
}) {
  return (
    <div
      style={{
        marginBottom: tokens.sp24,
        paddingLeft: tokens.sp16,
        borderLeft: `2px solid ${tokens.gold}`,
      }}
    >
      <h3
        style={{
          fontFamily: tokens.fontBody,
          fontSize: tokens.textBodyMd,
          fontWeight: 600,
          color: tokens.ink,
          margin: `0 0 ${tokens.sp4} 0`,
        }}
      >
        {name}
      </h3>
      <p
        style={{
          fontFamily: tokens.fontBody,
          fontSize: tokens.textBodyMd,
          lineHeight: 1.65,
          color: tokens.ink,
          opacity: 0.72,
          margin: 0,
        }}
      >
        {character}
      </p>
    </div>
  );
}

function AvoidEntry({
  name,
  reason,
}: {
  name: string;
  reason: string;
}) {
  return (
    <div
      style={{
        marginBottom: tokens.sp24,
        paddingLeft: tokens.sp16,
        borderLeft: "2px solid rgba(26,26,24,0.15)",
      }}
    >
      <h3
        style={{
          fontFamily: tokens.fontBody,
          fontSize: tokens.textBodyMd,
          fontWeight: 600,
          color: tokens.ink,
          margin: `0 0 ${tokens.sp4} 0`,
        }}
      >
        {name}
      </h3>
      <p
        style={{
          fontFamily: tokens.fontBody,
          fontSize: tokens.textBodyMd,
          lineHeight: 1.65,
          color: tokens.ink,
          opacity: 0.72,
          margin: 0,
        }}
      >
        {reason}
      </p>
    </div>
  );
}
