"use client";
import React from 'react';
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';

interface BookmarkCardProps {
  description?: string;
  style?: React.CSSProperties;
}

const BookmarkCard: React.FC<BookmarkCardProps> = ({
  description = "All of your saved jobs are here",
  style,
}) => {
  const router = useRouter();
  return (
    <div style={{
      backgroundColor: "var(--dark-blue)",
      borderRadius: "var(--radius-xl)",
      padding: "var(--space-xl)",
      height: "100%",
      display: "flex",
      justifyContent: "flex-start",
      alignItems: "center",
      gap: "var(--space-md)",
      ...style,
    }}>

      <img
        src="/global/bookmark.svg" // Ghayar el path lel icon el sa7
        alt="Bookmark"
        style={{ width: "var(--icon-xl)" }}
      />

      <div>
        <h3
          style={{
            color: "white",
            fontSize: "var(--text-md)",
          }}
        >
          Bookmarks
        </h3>
        <p
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: "var(--text-base)",
            fontFamily: "var(--font-nova-square)",
          }}
        >
          {description}
        </p>
      </div>

      {/* Estekhdam el Button component bta3ak */}
      <Button
        variant="primary-inverted"
        style={{
          marginLeft: "auto",
          marginTop: "auto",
          paddingInline:"var(--space-xl)",
        }}
        onClick={() => router.push('/job-features/bookmarks')}
      >
        Open
      </Button>
    </div>
  );
};

export default BookmarkCard;
