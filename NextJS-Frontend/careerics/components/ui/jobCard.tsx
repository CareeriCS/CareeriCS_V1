"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildJobDetailsHref, persistSelectedJobId } from '@/lib/jobs';

interface JobCardData {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string | null;
  tags: string[];
  description: string;
  responsibilities?: string;
  requirements?: string;
  niceToHave?: string;
  skills?: string;
}

interface JobProps extends JobCardData {
  isBookmarked?: boolean;
  isBookmarkLoading?: boolean;
  disableNavigation?: boolean;
  isSelected?: boolean;
  detailsHref?: string;
  onSelect?: (job: JobCardData) => void;
  onBookmarkToggle?: (job: JobCardData) => void | Promise<void>;
}

const JobCard: React.FC<JobProps> = ({
  isBookmarked,
  isBookmarkLoading = false,
  disableNavigation = false,
  detailsHref,
  onSelect,
  onBookmarkToggle,
  isSelected,
  ...job
}) => {
  const router = useRouter();
  const [internalBookmarked, setInternalBookmarked] = useState(Boolean(isBookmarked));

  useEffect(() => {
    setInternalBookmarked(Boolean(isBookmarked));
  }, [isBookmarked]);

  const cardData: JobCardData = job;

  const bookmarked = isBookmarked ?? internalBookmarked;

  const handleCardClick = () => {
    onSelect?.(cardData);
    persistSelectedJobId(job.id);

    if (disableNavigation) {
      return;
    }

  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isBookmarkLoading) {
      return;
    }

    if (onBookmarkToggle) {
      await onBookmarkToggle(cardData);
      return;
    }

    setInternalBookmarked((prev) => !prev);
  };

  return (
    <div
      onClick={handleCardClick}
      style={{
        backgroundColor: isSelected
          ? "var(--light-blue)"
          : "var(--bg-grey)",
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-md)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
        position: "relative",
        minWidth: "var(--container-xs)",
        maxWidth: "var(--container-sm)",
        boxSizing: "border-box",
        fontFamily: "'Nova Square', sans-serif",
        cursor: "pointer",
        transition: "0.2s ease",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = "var(--light-blue)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = "var(--bg-grey)";
        }
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--space-md)",
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "var(--text-md)",
              fontWeight: "500",
              color: "var(--bg-color)",
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              minHeight: "1lh",
              lineHeight: "var(--line-relaxed)",
              wordBreak: "break-word",
            }}
          >
            {job.title}
          </h3>

          <div
            style={{
              display: "flex",
              gap: "var(--space-sm)",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "var(--text-base)",
                color: "var(--bg-color)",
                opacity: 0.8,
                whiteSpace: "nowrap",
              }}
            >
              {job.company
                .toLowerCase()
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </p>

            <p
              style={{
                margin: 0,
                fontSize: "var(--text-sm)",
                color: "var(--bg-color)",
                opacity: 0.6,
              }}
            >
              {job.location}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-md)",
            flexShrink: 0,
          }}
        >
          {job.salary ? (
            <span
              style={{
                fontSize: "var(--text-md)",
                fontWeight: "100",
                color: "var(--bg-color)",
                whiteSpace: "nowrap",
              }}
            >
              {job.salary}
            </span>
          ) : null}

          <div
            onClick={handleBookmark}
            style={{
              cursor: isBookmarkLoading ? "wait" : "pointer",
              transition: "transform 0.15s ease",
              opacity: isBookmarkLoading ? 0.7 : 1,
              width: "var(--icon-md)",
              height: "var(--icon-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.transform = "scale(1.15)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.transform = "scale(1)")
            }
          >
            {bookmarked ? (
              <svg
                width="var(--icon-lg)"
                viewBox="0 0 24 24"
                fill="var(--black)"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M5 3C5 2.44772 5.44772 2 6 2H18C18.5523 2 19 2.44772 19 3V21L12 17.5L5 21V3Z" />
              </svg>
            ) : (
              <svg
                width="var(--icon-lg)"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5 3C5 2.44772 5.44772 2 6 2H18C18.5523 2 19 2.44772 19 3V21L12 17.5L5 21V3Z"
                  stroke="var(--form-grey)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "var(--space-sm)",
          flexWrap: "wrap",
          width: "100%",
        }}
      >
        {job.tags.map((tag, index) => (
          <div
            key={index}
            style={{
              backgroundColor: "var(--form-grey)",
              color: "white",
              padding: "var(--button-padding-y) var(--space-xs)",
              borderRadius: "var(--radius-lg)",
              flex: 1,
              whiteSpace: "nowrap",
              textAlign: "center",
              fontSize: "var(--text-xs)",
              minWidth: "fit-content",
            }}
          >
            {tag}
          </div>
        ))}
      </div>
    </div>
  );
};

export default JobCard;