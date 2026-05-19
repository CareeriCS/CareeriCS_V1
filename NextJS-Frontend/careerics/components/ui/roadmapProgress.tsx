"use client";

interface roadmapProgressProps {
    text?: string | null;
    done?: string | "0";
    total?: string | "0";
    isTotal?: boolean;
    color?: string;
    isScore?: boolean;
}

export default function roadmapProgress({ text, done = "0", total = "0", isTotal = true, isScore = true, color = "var(--light-green)" }: roadmapProgressProps) {
    return (<div
        style={{
            display: "flex",
            width: "fit-content",
            height: "fit-content",
            gap: "var(--space-sm)",
        }}>
        <div
            style={{
                maxHeight: "100%",
                width: "var(--space-xxs)",
                backgroundColor: color,
                borderRadius: "999px",
            }}
        />
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                color: "white",
            }}
        >
            {isScore &&
                <>
                    <h2
                        style={{
                            fontSize: "var(--text-md)",
                            whiteSpace: "nowrap",
                        }}
                    >
                        <span
                            style={{
                                color: color,
                            }}
                        >
                            {done}
                        </span>
                        {isTotal && (
                            <>
                                {" / "}
                                <span>{total}</span>
                            </>
                        )}
                    </h2>
                </>
            }

            <p
                style={{
                    fontSize: "var(--text-base)",
                    whiteSpace: "nowrap",
                }}
            >
                {text}
            </p>

        </div>

    </div >
    );
}