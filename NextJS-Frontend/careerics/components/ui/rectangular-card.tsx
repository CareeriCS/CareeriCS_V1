import { useState } from "react";

type Variant = "normal" | "radio";
type Theme = "light" | "dark";

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
}) => {
    const [isHovered, setIsHovered] = useState(false);

    const baseBg = theme === "dark" ? "var(--medium-blue)" : "#C1CBE6";
    const hoverBg = "var(--light-green)";

    const active = isHovered || selected;

    const backgroundColor = active ? hoverBg : baseBg;

    const textColor =
        theme === "dark" && !active ? "white" : "black";

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => {
                if (selectable) onSelect?.();
            }}
            style={{
                backgroundColor,
                borderRadius: "var(--radius-lg)",
                cursor: selectable ? "pointer" : "default",
                height:"fit-content",
                display: "flex",
                alignItems: "center",
                justifyContent: "center ",
                gap: "1rem",
                padding: "var(--space-sm)",
                width: "fit-content",
                
                ...style,
            }}
        >
            {/* Text section */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <p
                    style={{
                        color: textColor,
                        fontSize: "var(--text-sm)",
                        maxWidth: variant === "normal"?"30ch":"fit-content",
                        textAlign: "center",
                        whiteSpace: variant === "radio" ? "nowrap" : "normal",
                        marginRight:"auto",
                        fontWeight: "800",
                        fontFamily:font==="jura"?"var(--font-jura)":"var(--font-nova-square)",
                    }}
                >
                    {Title}
                </p>

                {isSubtextVisible && (
                    <p
                        style={{
                            color: textColor,
                            fontSize: "var(--text-sm)",
                            whiteSpace: "nowrap",
                            marginRight:"auto",
                            fontFamily:font==="jura"?"var(--font-jura)":"var(--font-nova-square)",
                        }}
                    >
                        {subtext}
                    </p>
                )}
            </div>

        </div>
    );
};