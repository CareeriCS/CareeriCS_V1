import { useState, useRef } from "react";

type Variant = "normal" | "radio";
type Theme = "light" | "dark";
type TitleVariant = "clip" | "full";

const formatTitle = (title: string = "") =>
  title.length > 32 ? title.slice(0, 32) + "..." : title;

export const RectangularCard = ({
  style,
  Title = "Your Title",
  subtext = "Your Subtext",
  isSubtextVisible = false,
  variant = "normal",
  theme = "light",
  selectable = false,
  selected = false,
  onSelect,
  font = "jura",
  titleVariant = "clip",
}: {
  style?: React.CSSProperties;
  Title?: string;
  subtext?: string;
  isSubtextVisible?: boolean;
  variant?: Variant;
  theme?: Theme;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  font?: string;
  titleVariant?: TitleVariant;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const isTouchDevice =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;

  const baseBg =
    theme === "dark" ? "var(--medium-blue)" : "#C1CBE6";

  const hoverBg = "var(--light-green)";

  const active = isHovered || selected;

  const backgroundColor = active ? hoverBg : baseBg;

  const textColor =
    theme === "dark" && !active ? "white" : "black";

  const handlePressStart = () => {
    if (!isTouchDevice) return;

    pressTimer.current = setTimeout(() => {
      setShowTooltip(true);
    }, 500);
  };

  const handlePressEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
  };

  const shouldClipTitle = titleVariant === "clip";

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onClick={() => {
        setShowTooltip(false);
        if (selectable) onSelect?.();
      }}
      title={!isTouchDevice ? Title : undefined}
      style={{
        position: "relative",
        backgroundColor,
        borderRadius: "var(--radius-lg)",
        cursor: selectable ? "pointer" : "default",
        height: "fit-content",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: "var(--space-sm)",
        width: "fit-content",
        ...style,
      }}
    >
      {/* Tooltip (mobile only) */}
      {showTooltip && isTouchDevice && (
        <div
          style={{
            position: "absolute",
            top: "-2.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            background: "black",
            color: "white",
            padding: "0.4rem 0.6rem",
            borderRadius: "0.5rem",
            fontSize: "0.75rem",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          {Title}
        </div>
      )}

      {/* Text */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width:"fit-content",
        }}
      >
        <p
          style={{
            color: textColor,
            fontSize: "var(--text-sm)",
            maxWidth: shouldClipTitle ? "30ch" : "unset",
            overflow: shouldClipTitle ? "hidden" : "visible",
            textOverflow: shouldClipTitle ? "ellipsis" : "unset",
            whiteSpace: shouldClipTitle ? "nowrap" : "normal",
            textAlign: "center",
            marginRight: "auto",
            fontWeight: "800",
            fontFamily:
              font === "jura"
                ? "var(--font-jura)"
                : "var(--font-nova-square)",
          }}
        >
          {shouldClipTitle ? formatTitle(Title) : Title}
        </p>

        {isSubtextVisible && (
          <p
            style={{
              color: textColor,
              fontSize: "var(--text-sm)",
              whiteSpace: "nowrap",
              marginRight: "auto",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "20ch",
              fontFamily:
                font === "jura"
                  ? "var(--font-jura)"
                  : "var(--font-nova-square)",
            }}
          >
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
};