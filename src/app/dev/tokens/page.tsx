// app/dev/tokens/page.tsx
// Development scaffolding — DELETE before launch.
// Renders every Sonder design token using Tailwind utility classes.
// If a token is missing or broken, it will show as unstyled/fallback.

export default function TokensPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-warm)", padding: "var(--spacing-px-48) var(--spacing-px-32)" }}>
      <h1 className="text-heading-lg" style={{ fontFamily: "var(--font-body)", marginBottom: "var(--spacing-px-48)", color: "var(--color-ink)" }}>
        Sonder Design Token Verification
      </h1>

      {/* ── COLOUR PALETTE ── */}
      <Section title="Colour Palette">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "var(--spacing-px-16)" }}>
          <Swatch name="Ink" hex="#1a1a18" style={{ backgroundColor: "var(--color-ink)" }} />
          <Swatch name="Warm White" hex="#f5f0e8" style={{ backgroundColor: "var(--color-warm)", border: "1px solid var(--color-ink)" }} dark />
          <Swatch name="Card White" hex="#FFFFFF" style={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-ink)" }} dark />
          <Swatch name="Old Gold" hex="#C49A3C" style={{ backgroundColor: "var(--color-gold)" }} />
          <Swatch name="Apricot" hex="#F2A07B" style={{ backgroundColor: "var(--color-apricot)" }} />
          <Swatch name="Verdigris" hex="#43B3AE" style={{ backgroundColor: "var(--color-verdigris)" }} />
        </div>

        <div style={{ marginTop: "var(--spacing-px-24)" }}>
          <p className="text-overline" style={{ color: "var(--color-ink)", opacity: 0.65, marginBottom: "var(--spacing-px-12)" }}>
            Secondary text (ink at 65% opacity)
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--spacing-px-8)" }}>
            <Swatch name="Surface 0" hex="#1a1a18" style={{ backgroundColor: "var(--color-surface-0)" }} />
            <Swatch name="Surface 1" hex="#242420" style={{ backgroundColor: "var(--color-surface-1)" }} />
            <Swatch name="Surface 2" hex="#2e2e28" style={{ backgroundColor: "var(--color-surface-2)" }} />
            <Swatch name="Surface 3" hex="#3a3a32" style={{ backgroundColor: "var(--color-surface-3)" }} />
          </div>
        </div>
      </Section>

      {/* ── TYPOGRAPHY ── */}
      <Section title="Typography Scale">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-px-24)" }}>
          <TypeRow
            token="display-xl"
            size="56px / Freight Display 300"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-display-xl)",
              fontWeight: 300,
              lineHeight: "var(--leading-display-xl)",
              color: "var(--color-ink)",
            }}
            sample="Kraków"
          />
          <TypeRow
            token="display-lg"
            size="44px / Freight Display 400"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-display-lg)",
              fontWeight: 400,
              lineHeight: "var(--leading-display-lg)",
              color: "var(--color-ink)",
            }}
            sample="Where to eat well"
          />
          <TypeRow
            token="display-md"
            size="36px / Freight Display 400"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-display-md)",
              fontWeight: 400,
              lineHeight: "var(--leading-display-md)",
              color: "var(--color-ink)",
            }}
            sample="Kazimierz"
          />
          <TypeRow
            token="heading-lg"
            size="28px / Söhne 600"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-heading-lg)",
              fontWeight: 600,
              lineHeight: "var(--leading-heading-lg)",
              color: "var(--color-ink)",
            }}
            sample="Starka"
          />
          <TypeRow
            token="heading-md"
            size="22px / Söhne 600"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-heading-md)",
              fontWeight: 600,
              lineHeight: "var(--leading-heading-md)",
              color: "var(--color-ink)",
            }}
            sample="Traditional Polish"
          />
          <TypeRow
            token="body-lg"
            size="18px / Söhne 400"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-lg)",
              fontWeight: 400,
              lineHeight: "var(--leading-body-lg)",
              color: "var(--color-ink)",
            }}
            sample="Old Polish recipes in a vaulted cellar that has been feeding Kazimierz since before the neighbourhood became a destination."
          />
          <TypeRow
            token="body-md"
            size="16px / Söhne 400"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-md)",
              fontWeight: 400,
              lineHeight: "var(--leading-body-md)",
              color: "var(--color-ink)",
            }}
            sample="The cooking is rooted in pre-war Polish tradition — bigos aged in a clay pot, duck served with cherries, bread that arrives still warm."
          />
          <TypeRow
            token="body-sm"
            size="14px / Söhne 400"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-sm)",
              fontWeight: 400,
              lineHeight: "var(--leading-body-sm)",
              color: "var(--color-ink)",
              opacity: 0.65,
            }}
            sample="Kazimierz · Upscale · Verified open"
          />
          <TypeRow
            token="caption"
            size="12px / Söhne 400"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-caption)",
              fontWeight: 400,
              lineHeight: "var(--leading-caption)",
              color: "var(--color-ink)",
              opacity: 0.65,
            }}
            sample="Updated March 2026"
          />
          <TypeRow
            token="overline"
            size="11px / Söhne 500 / uppercase"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-overline)",
              fontWeight: 500,
              lineHeight: "var(--leading-overline)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-gold)",
            }}
            sample="Restaurant"
          />
        </div>
      </Section>

      {/* ── SPACING ── */}
      <Section title="Spacing Scale (8px base)">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-px-8)" }}>
          {[
            ["2px", "var(--spacing-px-2)"],
            ["4px", "var(--spacing-px-4)"],
            ["8px", "var(--spacing-px-8)"],
            ["12px", "var(--spacing-px-12)"],
            ["16px", "var(--spacing-px-16)"],
            ["24px", "var(--spacing-px-24)"],
            ["32px", "var(--spacing-px-32)"],
            ["40px", "var(--spacing-px-40)"],
            ["48px", "var(--spacing-px-48)"],
            ["64px", "var(--spacing-px-64)"],
            ["80px", "var(--spacing-px-80)"],
            ["96px", "var(--spacing-px-96)"],
            ["128px", "var(--spacing-px-128)"],
          ].map(([label, token]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "var(--spacing-px-16)" }}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-ink)", opacity: 0.65, width: "48px", flexShrink: 0 }}>
                {label}
              </span>
              <div style={{ height: "16px", backgroundColor: "var(--color-verdigris)", width: token, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </Section>

      {/* ── CORNER RADIUS ── */}
      <Section title="Corner Radius">
        <div style={{ display: "flex", gap: "var(--spacing-px-32)", alignItems: "flex-end" }}>
          {[
            ["Images", "var(--radius-none)", "0px"],
            ["Buttons", "var(--radius-button)", "4px"],
            ["Cards", "var(--radius-card)", "8px"],
            ["Modals", "var(--radius-modal)", "12px"],
          ].map(([label, token, value]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--spacing-px-8)" }}>
              <div style={{
                width: "80px",
                height: "80px",
                backgroundColor: "var(--color-ink)",
                borderRadius: token,
              }} />
              <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-ink)", opacity: 0.65 }}>
                {label}
              </span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-caption)", color: "var(--color-ink)", opacity: 0.4 }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── SHADOWS ── */}
      <Section title="Shadows">
        <div style={{ display: "flex", gap: "var(--spacing-px-32)" }}>
          {[
            ["Card rest", "var(--shadow-card-rest)"],
            ["Card hover", "var(--shadow-card-hover)"],
            ["Modal", "var(--shadow-modal)"],
          ].map(([label, shadow]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--spacing-px-12)" }}>
              <div style={{
                width: "120px",
                height: "80px",
                backgroundColor: "var(--color-card)",
                borderRadius: "var(--radius-card)",
                boxShadow: shadow as string,
              }} />
              <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-ink)", opacity: 0.65 }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── CATEGORY PILLS ── */}
      <Section title="Category Pills">
        <div style={{ display: "flex", gap: "var(--spacing-px-8)", flexWrap: "wrap" }}>
          {[
            ["Restaurant", "var(--color-gold)"],
            ["Café", "var(--color-gold)"],
            ["See", "var(--color-apricot)"],
            ["Night", "var(--color-apricot)"],
            ["Experience", "var(--color-apricot)"],
            ["Stay", "#E8E3DA"],
          ].map(([label, bg]) => (
            <span key={label} style={{
              backgroundColor: bg as string,
              color: "var(--color-ink)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-overline)",
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "4px 10px",
              borderRadius: "var(--radius-button)",
            }}>
              {label}
            </span>
          ))}
        </div>
      </Section>

      <p style={{ marginTop: "var(--spacing-px-64)", fontFamily: "var(--font-body)", fontSize: "var(--text-caption)", color: "var(--color-ink)", opacity: 0.4 }}>
        Development page — delete before launch
      </p>
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "var(--spacing-px-64)" }}>
      <h2 style={{
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-overline)",
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--color-ink)",
        opacity: 0.4,
        marginBottom: "var(--spacing-px-24)",
      }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Swatch({ name, hex, style, dark }: { name: string; hex: string; style: React.CSSProperties; dark?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-px-8)" }}>
      <div style={{ height: "80px", borderRadius: "var(--radius-card)", ...style }} />
      <div>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
          {name}
        </p>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-caption)", color: "var(--color-ink)", opacity: 0.4, margin: 0 }}>
          {hex}
        </p>
      </div>
    </div>
  );
}

function TypeRow({ token, size, style, sample }: { token: string; size: string; style: React.CSSProperties; sample: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "var(--spacing-px-16)", alignItems: "baseline" }}>
      <div>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
          {token}
        </p>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-caption)", color: "var(--color-ink)", opacity: 0.4, margin: 0 }}>
          {size}
        </p>
      </div>
      <p style={{ ...style, margin: 0 }}>{sample}</p>
    </div>
  );
}