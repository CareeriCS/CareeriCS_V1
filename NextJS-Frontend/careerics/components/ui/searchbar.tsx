"use client";

type SearchBarProps = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    style?: React.CSSProperties;
    inputStyle?: React.CSSProperties;
};

export const SearchBar = ({
    value,
    onChange,
    placeholder = "Search...",
    style,
    inputStyle,
}: SearchBarProps) => {
    return (
        
            <div
                style={{
                    width: "fit-content",
                    padding: "var(--space-xs) var(--space-md)",
                    borderRadius: "var(--radius-xl)",
                    border: "1px solid var(--light-blue)",
                    backgroundColor: "transparent",
                    color: "var(--light-blue)",
                    fontSize: "var(--text-sm)",
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-md)",
                    ...inputStyle,
                }}
            >
                <input
                    type="text"
                    placeholder={placeholder}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    style={{
                        border: "none",
                        background: "transparent",
                        color: "inherit",
                        fontSize: "inherit",
                        outline: "none",
                        width: "100%",
                        fontFamily: "inherit",
                    }}
                />

                <img
                    src="/global/search.svg"
                    alt="search"
                    style={{
                        width: "var(--icon-lg)",
                        pointerEvents: "none",
                        flexShrink: 0,
                    }}
                />
            </div>
    );
};