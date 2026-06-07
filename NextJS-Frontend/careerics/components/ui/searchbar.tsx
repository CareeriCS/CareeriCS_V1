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
                        minWidth: 0,
                        fontFamily: "inherit",
                    }}
                />

                {value ? (
                    <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => onChange("")}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "1.75rem",
                            height: "1.75rem",
                            border: "none",
                            borderRadius: "999px",
                            background: "transparent",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            flexShrink: 0,
                            padding: 0,
                        }}
                        onMouseEnter={(event) => {
                            event.currentTarget.style.backgroundColor = "var(--light-red)";
                            event.currentTarget.style.color = "var(--dark-blue)";
                        }}
                        onMouseLeave={(event) => {
                            event.currentTarget.style.backgroundColor = "transparent";
                            event.currentTarget.style.color = "var(--text-muted)";
                        }}
                    >
                        <img
                            src="/global/close.svg"
                            alt=""
                            aria-hidden="true"
                            style={{
                                width: "var(--icon-sm)",
                                height: "var(--icon-sm)",
                                objectFit: "contain",
                            }}
                        />
                    </button>
                ) : (
                    <img
                        src="/global/search.svg"
                        alt="search"
                        style={{
                            width: "var(--icon-lg)",
                            pointerEvents: "none",
                            flexShrink: 0,
                        }}
                    />
                )}
            </div>
    );
};