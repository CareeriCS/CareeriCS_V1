"use client";
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";

interface JobDetailsProps {
  jobData: {
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
  };
  onApply?: () => void | Promise<void>;
  onClose?: () => void;
  isApplying?: boolean;
  actionLabel?: string;
  isApplyDisabled?: boolean;
}

const JobDetailsCard: React.FC<JobDetailsProps> = ({
  jobData,
  onApply,
  onClose,
  isApplying = false,
  actionLabel = "Apply",
  isApplyDisabled = false,
}) => {
  const [activeSection, setActiveSection] = useState<string | null>("About the Role");

  const toggleSection = (sectionTitle: string) => {
    setActiveSection(activeSection === sectionTitle ? null : sectionTitle);
  };

  const renderSection = (title: string, content: React.ReactNode) => {
    const isOpen = activeSection === title;

    return (
      /* Section Wrapper */
      <div style={{
        border: "1px solid rgba(255, 255, 255, 0.4)",
        marginBottom: "var(--space-xs)",
        overflow: "auto",
        borderRadius: "var(--radius-lg)",
      }}>

        {/* Section Header (Clickable Toggle) */}
        <div
          onClick={() => toggleSection(title)}
          style={{
            padding: "var(--space-md) ",
            borderBottom: isOpen ? "1px solid rgba(255, 255, 255, 0.4)" : "",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
            transition: "0.3s",
          }}
        >
          <span style={{ fontSize: "var(--text-base)" }}>{title}</span>

          {/* Arrow Icon */}
          <span style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: isOpen ? "rotate(180deg)" : "rotate(270deg)",
            width: "var(--icon-sm)",
            height: "var(--icon-sm)"
          }}>
            <img
              src="/auth/Back Arrow.svg"
              alt="arrow"
              style={{
                width: "100%",
                height: "100%",
                opacity: 0.8,
                pointerEvents: "none"
              }}
            />
          </span>
        </div>

        {/* Section Content */}
        {isOpen && (
          <div style={{
            padding: "var(--space-md) ",
            fontSize: "var(--text-sm)",
            lineHeight: "var(--line-relaxed)",
            color: "var(--text-grey)",
            wordBreak: "break-word",
            overflowWrap: "break-word"
          }}>
            {content}
          </div>
        )}
      </div>
    );
  };

  return (
    /* Root Card Container */
    <div style={{
      backgroundColor: "rgba(57, 66, 88, 0.8)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      backgroundImage: "linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(0, 0, 0, 0.05) 100%)",
      borderRadius: "var(--radius-2xl)",
      padding: "var(--space-lg)",
      color: "white",
      height: "100%",
      maxHeight: "100%",
      width: "var(--container-xm)",
      flexShrink: 0,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Nova Square', sans-serif",
      boxSizing: "border-box",
    }}>

      {/* Scrollable Content Wrapper */}
      <div
        className="no-scrollbar"
        style={{
          flex: 1,
          overflowY: "auto",
          scrollbarWidth: "none",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          gap: "var(--space-md)",
        }}
      >

        {/* 1. Header Section */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--space-md)",
          flexWrap: "wrap",
        }}>

          {/* Title + Company Info Block */}
          <div style={{ minWidth: 0, flex: 1, gap: "var(--space-md)", display: "flex", flexDirection: "column" }}>

            {/* Title + Tags Row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                minWidth: "100%",
                gap: "var(--space-md)"
              }}
            >
              <h2 style={{ fontSize: "var(--text-md)", wordBreak: "break-word" }}>
                {jobData.title}
              </h2>

              {/* Tags Container */}
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-sm)",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                  maxWidth: "100%",
                }}
              >
                {jobData.tags.map(tag => (
                  <div
                    key={tag}
                    style={{
                      width: "fit-content",
                      height: "fit-content",
                      backgroundColor: "var(--bg-grey)",
                      color: "black",
                      paddingInline: "var(--space-sm)",
                      borderRadius: "var(--radius-lg)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    {tag}
                  </div>
                ))}
              </div>
            </div>

            {/* Company + Location Row */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-md)",
              flexWrap: "wrap"
            }}>
              <span style={{
                fontSize: "var(--text-base)",
                opacity: 0.9,
                whiteSpace: "normal",
                wordBreak: "break-word"
              }}>
                {jobData.company}
              </span>

              {/* Location Block */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-xs)",
                flexWrap: "wrap"
              }}>
                <img
                  src="/job/map pin.svg"
                  alt="location"
                  style={{
                    opacity: 0.6,
                    width: "var(--icon-sm)",
                    height: "var(--icon-sm)"
                  }}
                />
                <span style={{
                  fontSize: "var(--text-sm)",
                  opacity: 0.6,
                  color: "white",
                  whiteSpace: "normal",
                  wordBreak: "break-word"
                }}>
                  {jobData.location}
                </span>
              </div>
            </div>
          </div>

          {/* Salary Block */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            maxWidth: "100%"
          }}>
            {jobData.salary ? (
              <div style={{
                width: "fit-content",
                      height: "fit-content",
                      backgroundColor: "var(--bg-grey)",
                      color: "black",
                      paddingInline: "var(--space-xxs)",
                      borderRadius: "var(--radius-lg)",
                      fontSize: "var(--text-sm)",
              }}>
                Salary: {jobData.salary}
              </div>
            ) : null}
          </div>
          {onClose && 
              <div
              onClick={onClose}
                style={{
                  fontSize: "var(--icon-md)",
                  height: "fit-content",
                  lineHeight: "var(--icon-md)",
                  cursor: "pointer",
                }}
              >
                ✖
              </div>
            }
        </div>

        {/* 2. Accordions Section */}
        <div style={{ overflowY: "auto", scrollbarWidth: "none" }}>
          {renderSection("About the Role", jobData.description)}
          {jobData.responsibilities && renderSection("Key Responsibilities", jobData.responsibilities)}
          {jobData.requirements && renderSection("Requirements", jobData.requirements)}
          {jobData.niceToHave && renderSection("Nice To Have", jobData.niceToHave)}
          {jobData.skills && renderSection("Skills Needed", jobData.skills)}
        </div>

        {/* 3. Apply Button Section */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "auto" }}>
          <Button
            variant="primary-inverted"
            isLoading={isApplying}
            disabled={isApplyDisabled}
            onClick={onApply}
            style={{
              paddingInline:"var(--space-xl)",
            }}
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default JobDetailsCard;