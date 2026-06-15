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
                height: "100vh",
                padding: "10px",
                boxSizing: "border-box",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    background: "linear-gradient(180deg, var(--dark-blue) 0%, #000000 100%)",
                    borderRadius: "5vh",
                    width: "100%",
                    height: "100%",
                    margin: "0 auto",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "row",
                }}
            >
                {/* Main content */}
                <div
                    style={{
                        position: "relative",
                        display: "flex",
                        flex: 1,
                        overflow:"hidden",
                        scrollbarWidth: "none",
                    }}
                >
                    {children}
                </div>


                {/* Exit Button*/}
                <button
                    type="button"
                    onClick={() => router.back()}
                    style={{
                        width: "5vh",
                        height: "5vh",
                        cursor: "pointer",
                        margin: "20px",

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
        </div>
    );
}