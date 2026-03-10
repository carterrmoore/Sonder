// Design tokens as JS constants — use in inline styles instead of var(--token)
// This ensures correct rendering in Safari, which does not reliably resolve
// Tailwind v4 @theme tokens in inline styles.

export const tokens = {
  // Colours
  ink:       "#1a1a18",
  warm:      "#f5f0e8",
  card:      "#FFFFFF",
  gold:      "#C49A3C",
  apricot:   "#F2A07B",
  verdigris: "#43B3AE",
  // Spacing
  sp2:   "2px",
  sp4:   "4px",
  sp8:   "8px",
  sp12:  "12px",
  sp16:  "16px",
  sp24:  "24px",
  sp32:  "32px",
  sp40:  "40px",
  sp48:  "48px",
  sp64:  "64px",
  sp80:  "80px",
  sp96:  "96px",
  // Radii
  radiusButton: "4px",
  radiusCard:   "8px",
  radiusModal:  "12px",
  radiusPill:   "999px",
  // Typography
  fontDisplay: '"Freight Display", Georgia, serif',
  fontBody:    '"Söhne", "Helvetica Neue", Arial, sans-serif',
  textDisplayXl:  "3.5rem",
  textDisplayLg:  "2.75rem",
  textDisplayMd:  "2.25rem",
  textDisplaySm:  "1.75rem",
  textHeadingLg:  "1.75rem",
  textHeadingMd:  "1.375rem",
  textHeadingSm:  "1.25rem",
  textBodyLg:     "1.125rem",
  textBodyMd:     "1rem",
  textBodySm:     "0.875rem",
  textCaption:    "0.75rem",
  textOverline:   "0.6875rem",
  // Shadows
  shadowCardRest:  "0 1px 2px rgba(26, 26, 24, 0.06)",
  shadowCardHover: "0 2px 8px rgba(26, 26, 24, 0.08)",
  shadowModal:     "0 8px 32px rgba(26, 26, 24, 0.14)",
} as const;
