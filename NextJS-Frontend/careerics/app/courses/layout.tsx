"use client";

export default function JourneyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
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
                    borderRadius: "var(--radius-xl)",
                    flexDirection:"column",
                }}
            >
                {children}
            </div>


        </div>
    );
}