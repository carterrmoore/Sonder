import { CATEGORY_DISPLAY, COLOR_GROUPS } from "@/pipeline/constants";
import type { Category } from "@/types/pipeline";

type PillSize = "sm" | "md";

interface CategoryPillProps {
  category: Category;
  size?: PillSize;
  className?: string;
}

const SIZE_STYLES: Record<PillSize, React.CSSProperties> = {
  sm: {
    fontSize: "var(--text-overline)",
    padding: "2px 8px",
  },
  md: {
    fontSize: "var(--text-caption)",
    padding: "4px 10px",
  },
};

export default function CategoryPill({
  category,
  size = "md",
  className,
}: CategoryPillProps) {
  const config = CATEGORY_DISPLAY[category];
  const colors = COLOR_GROUPS[config.colorGroup];

  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        fontFamily: "var(--font-body)",
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase" as const,
        lineHeight: "var(--leading-overline)",
        borderRadius: "var(--radius-button)",
        backgroundColor: colors.bg,
        color: colors.text,
        whiteSpace: "nowrap",
        ...SIZE_STYLES[size],
      }}
    >
      {config.label}
    </span>
  );
}
