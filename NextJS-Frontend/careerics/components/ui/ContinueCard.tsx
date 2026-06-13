"use client";
import React from 'react';
import { useRouter } from 'next/navigation';

interface ContinueCardProps {
  description?: string;
  style?: React.CSSProperties;
  theme?: "light" | "dark";
}

const ContinueCard: React.FC<ContinueCardProps> = ({
  description = "Your next opportunity awaits",
  style = {},
  theme = "dark",
}) => {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push('/job-features/application')}
      style={{
        backgroundColor: theme === "dark" ? "var(--dark-blue)" : "var(--bg-grey)",
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-xl)",
        height: "100%",
        display: "flex",
        justifyContent: "flex-start",
        alignItems: "center",
        gap: "var(--space-md)",
        cursor: "pointer",
        color: theme === "dark" ? "white" : "black",
        ...style,
      }}
    >

      <div>

        <h3 style={{
          fontSize: "var(--text-md)",
          fontFamily: 'Nova Square',
          fontWeight: "400",
        }}>
          Continue Applying
        </h3>

        <p style={{
          color: theme === "dark" ? "rgba(255, 255, 255, 0.6)" : "rgba(0, 0, 0, 0.8)",
          fontSize: "var(--text-base)",
        }}>
          {description}
        </p>

      </div>

      <div
        style={{
          fontSize: "var(--text-md)",
          marginLeft: "auto",
        }}
      >
        ❯
      </div>

    </div>
  );
};

export default ContinueCard;
