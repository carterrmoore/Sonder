import Link from "next/link";
import { tokens } from "@/lib/tokens";

const navWrapper: React.CSSProperties = {
  maxWidth: "1200px",
  marginLeft: "auto",
  marginRight: "auto",
  paddingLeft: "40px",
  paddingRight: "40px",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const NAV_LINKS = [
  { label: "Kraków",       href: "/krakow" },
  { label: "How it works", href: "/how-it-works" },
  { label: "About",        href: "/about" },
] as const;

export function Nav() {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backgroundColor: tokens.ink,
        height: "64px",
      }}
    >
      <div style={navWrapper}>
        <span
          style={{
            fontFamily: tokens.fontDisplay,
            fontSize: "22px",
            color: "#fff",
            fontWeight: 400,
          }}
        >
          Sonder
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="landing-nav-link"
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "13px",
                textDecoration: "none",
              }}
            >
              {label}
            </Link>
          ))}

          <Link
            href="/krakow/plan"
            style={{
              fontFamily: tokens.fontBody,
              fontSize: "13px",
              fontWeight: 500,
              color: "#C4922A",
              textDecoration: "none",
            }}
          >
            Plan your trip
          </Link>
        </div>
      </div>
    </nav>
  );
}
