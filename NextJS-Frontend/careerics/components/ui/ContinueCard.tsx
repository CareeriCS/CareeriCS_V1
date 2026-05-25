"use client";
import React from 'react';
import { useRouter } from 'next/navigation';

interface ContinueCardProps {
  description?: string;
  style?: React.CSSProperties;
}

const ContinueCard: React.FC<ContinueCardProps> = ({
  description = "Your next opportunity awaits",
  style = {},
}) => {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push('/job-features/application')}
      style={{
        backgroundColor: "var(--dark-blue)",
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-xl)",
        height: "100%",
        display: "flex",
        justifyContent: "flex-start",
        alignItems: "center",
        gap: "var(--space-md)",
        cursor: "pointer",
        ...style,
      }}
    >

      <div>

        <h3 style={{
          color: "white",
          fontSize: "var(--text-md)",
          fontFamily: 'Nova Square',
          fontWeight: "400",
        }}>
          Continue Applying
        </h3>

        <p style={{
          color: "rgba(255,255,255,0.6)",
          fontSize: "var(--text-base)",
        }}>
          {description}
        </p>

      </div>

      <div
        style={{
          color: "white",
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
