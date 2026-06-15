"use client";

import CV from "@/components/ui/cv";

export default function Page() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        top: 0,
        left: 0,
        color: "white",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 100,
      }}
    >
      <CV />
    </div>
  );
}
