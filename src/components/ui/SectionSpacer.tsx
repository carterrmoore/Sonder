type SpacerSize = "sm" | "md" | "xl";

const SIZE_MAP: Record<SpacerSize, string> = {
  sm: "var(--spacing-px-16)",
  md: "var(--spacing-px-32)",
  xl: "var(--spacing-px-96)",
};

interface SectionSpacerProps {
  size?: SpacerSize;
}

export default function SectionSpacer({ size = "md" }: SectionSpacerProps) {
  return <div style={{ height: SIZE_MAP[size] }} aria-hidden="true" />;
}
