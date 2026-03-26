import Link from "next/link";
import { tokens } from "@/lib/tokens";

const footerWrapper: React.CSSProperties = {
  maxWidth: "1200px",
  marginLeft: "auto",
  marginRight: "auto",
  paddingLeft: "40px",
  paddingRight: "40px",
  paddingTop: "28px",
  paddingBottom: "28px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const FOOTER_LINKS = [
  { label: "How it works",         href: "/how-it-works" },
  { label: "About",                href: "/about" },
  { label: "Affiliate disclosure", href: "/about/affiliate-disclosure" },
] as const;

export function Footer() {
  return (
    <footer
      style={{
        borderTop: "0.5px solid rgba(26, 26, 24, 0.08)",
      }}
    >
      <div style={footerWrapper}>
        <span
          style={{
            fontFamily: tokens.fontDisplay,
            fontSize: "15px",
            color: "rgba(26, 26, 24, 0.65)",
          }}
        >
          Sonder
        </span>

        <div style={{ display: "flex", gap: "20px" }}>
          {FOOTER_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="landing-footer-link"
              style={{
                fontFamily: tokens.fontBody,
                fontSize: "12px",
                textDecoration: "none",
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
