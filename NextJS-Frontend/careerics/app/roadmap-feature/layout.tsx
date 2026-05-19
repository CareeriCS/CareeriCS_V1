"use client";
import { useRouter } from "next/navigation";

export default function JourneyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    return (
        <div
            style={{
                width: "100%",
                height: "100dvh",
                maxHeight: "100dvh",
                padding: "var(--space-md)",
                overflow: "hidden",
                display: "grid",
                gridTemplateColumns: "1fr",
                gridTemplateRows: "1fr",
            }}
        >
            {/* Main Content */}
            <div
                style={{
                    background: "linear-gradient(180deg, var(--dark-blue) 0%, #000000 100%)",
                    width: "100%",
                    display: "flex",
                    overflow: "hidden",
                    gridArea: "1 / 1 / 2 / 2",
                    borderRadius: "var(--radius-xl)",
                }}
            >
                {children}
            </div>

            {/* Exit Button*/}
            <button
                type="button"
                onClick={() => router.back()}
                style={{
                    width: "var(--icon-lg)",
                    height: "var(--icon-lg)",
                    cursor: "pointer",
                    marginLeft: "auto",
                    marginBottom: "auto",
                    marginTop: "var(--space-md)",
                    marginRight: "var(--space-md)",
                    gridArea: "1 / 1 / 2 / 2",
                }}
            >
                <img
                    src="/global/close.svg"
                    alt="Close"
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                    }}
                />
            </button>
        </div>
    );
}