"use client";
import React, { useEffect, useRef } from 'react';

// --- Helper: Dynamic Circle Component (Green Only) ---
const CircleScore = ({ score }: { score: number }) => {
  const radius = 18; 
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div style={{ 
      position: "relative", width: "55px", height: "55px", 
      backgroundColor: "#1A2E5A", borderRadius: "12px",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0
    }}>
      <svg width="45" height="45" style={{ transform: "rotate(-90deg)" }}>
        {/* Track (Transparent Green) */}
        <circle
          cx="22.5" cy="22.5" r={radius}
          fill="none" stroke="rgba(212, 255, 71, 0.1)" strokeWidth="3.5"
        />
        {/* Progress (Solid Green) */}
        <circle
          cx="22.5" cy="22.5" r={radius}
          fill="none" stroke="#d4ff47" strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <span style={{ 
        position: "absolute", color: "white", fontSize: "11px", 
        fontWeight: "bold", fontFamily: 'var(--font-nova-square)' 
      }}>
        {score}%
      </span>
    </div>
  );
};

// --- Card 1: Learning Skills (Horizontal Scroll) ---
type LearningSkillItem = {
  id: string;
  label: string;
  isCurrent?: boolean;
};

interface PastTestItem {
  id: string;
  title: string;
  score: number;
}

interface PastTestsCardProps {
  tests: PastTestItem[];
  style?: React.CSSProperties;
}

interface MoreSkillsCardProps {
  skills: string[];
  selected?: string;
  onSelect: (skill: string) => void;
  style?: React.CSSProperties;
}

export const LearningSkillsCard = ({
  items,
  selectedId,
  focusedId,
  onSelect,
  style,
  title = "Skills you are currently learning",
}: {
  items: LearningSkillItem[];
  selectedId?: string;
  focusedId?: string;
  onSelect: (id: string) => void;
  style?: React.CSSProperties;
  title?: string;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const container = scrollRef.current;
    const focusTarget = focusedId || selectedId;
    if (!container || !focusTarget) {
      return;
    }

    const button = itemRefs.current[focusTarget];
    if (!button) {
      return;
    }

    const buttonCenter = button.offsetLeft + button.offsetWidth / 2;
    const targetScrollLeft = Math.max(0, buttonCenter - container.clientWidth / 2);
    container.scrollTo({
      left: targetScrollLeft,
      behavior: "smooth",
    });
  }, [focusedId, selectedId, items]);

  const handleScroll = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
  };

  return (
    <div style={{ 
      backgroundColor: "#1e2b58", borderRadius: "20px", padding: "20px 30px", color: "white",
      display: "flex", flexDirection: "column", justifyContent: "center", position: "relative",
      ...style, marginTop: "50px" 
    }}>
      <h3 style={{ fontSize: "16px", marginBottom: "15px", fontFamily: 'var(--font-nova-square)', fontWeight: "200" }}>
        {title}
      </h3>
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <div ref={scrollRef} style={{ display: "flex", gap: "20px", overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {items.map((item: LearningSkillItem) => {
            const isSelected = selectedId === item.id;
            const isCurrent = Boolean(item.isCurrent);
            return (
            <button
              key={item.id}
              ref={(element) => {
                itemRefs.current[item.id] = element;
              }}
              onClick={() => onSelect(item.id)}
              style={{
                padding: "15px 30px", borderRadius: "10px", border: "none", flexShrink: 0,
                backgroundColor: isSelected ? "var(--light-green)" : isCurrent ? "#fff6bf" : "#c1cbe6",
                boxShadow: isCurrent ? "0 0 0 2px var(--light-green) inset" : "none",
                color: "black", fontWeight: "bold", cursor: "pointer", fontSize: "13px",
                transition: "transform 0.2s",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                minWidth: "180px",
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              <span>{item.label}</span>
            </button>
            );
          })}
        </div>
        <span onClick={handleScroll} style={{ fontSize: "24px", cursor: "pointer", color: "#c1cbe6" }}>❯</span>
      </div>
    </div>
  );
};

// --- Card 2: Past Tests (VERTICAL EDIT) ---
export const PastTestsCard = ({ tests, style }: PastTestsCardProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const handleScroll = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ top: 100, behavior: 'smooth' });
  };

  return (
    <div style={{ 
      backgroundColor: "var(--medium-blue)", borderRadius: "25px", padding: "15px", color: "white",
      display: "flex", flexDirection: "column", gap: "5px", position: "relative", ...style 
    }}>
      <h3 style={{ fontSize: "22px", textAlign: "center", marginBottom: "10px", fontFamily: 'var(--font-nova-square)' }}>Past Tests</h3>
      
      <div ref={scrollRef} style={{ 
        display: "flex", flexDirection: "column", gap: "5px", 
        overflowY: "auto", scrollbarWidth: "none", flexGrow: 1 
      }}>
        {tests.map((test) => (
          <div key={test.id} style={{ 
            backgroundColor: "rgba(193, 203, 230, 0.95)", borderRadius: "18px", padding: "5px 10px", 
            display: "flex", justifyContent: "space-between", alignItems: "center", color: "#1A213D"
          }}>
            <div style={{ fontWeight: "800", fontSize: "14px", fontFamily: 'var(--font-nova-square)' }}>
              {test.title}
            </div>
            
            {/* Dynamic Circle Score (ALWAYS GREEN) */}
            <CircleScore score={test.score} />
          </div>
        ))}
      </div>

      <div onClick={handleScroll} style={{ 
        textAlign: "center", cursor: "pointer", color: "#c1cbe6", 
        fontSize: "24px", transform: "rotate(90deg)"
      }}>❯</div>
    </div>
  );
};

// --- Card 3: More Skills to Test (DYNAMIC SELECTION) ---
export const MoreSkillsCard = ({
  skills,
  selected,
  onSelect,
  style,
}: MoreSkillsCardProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const handleScroll = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ top: 120, behavior: 'smooth' });
  };

  return (
    <div style={{ 
      backgroundColor: "#1e2b58", borderRadius: "20px", padding: "20px", color: "white",
      display: "flex", flexDirection: "column", position: "relative", ...style 
    }}>
      <h3 style={{ fontSize: "18px", marginBottom: "15px", fontFamily: 'var(--font-nova-square)', fontWeight:"300" }}>More skills to test</h3>
      <div ref={scrollRef} style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", overflowY: "auto", scrollbarWidth: "none", flexGrow: 1 }}>
        {skills.map((skill: string) => (
          <button
            key={skill}
            onClick={() => onSelect(skill)}
            style={{
              padding: "15px 5px", borderRadius: "15px", border: "none",
              backgroundColor: selected === skill ? "var(--light-green)" : "var(--medium-blue)",
              color: selected === skill ? "black" : "white", 
              fontSize: "11px", fontWeight: "500", cursor: "pointer",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              if (selected !== skill) e.currentTarget.style.backgroundColor = "#2d5bb3";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              if (selected !== skill) e.currentTarget.style.backgroundColor = "var(--medium-blue)";
            }}
          >
            {skill}
          </button>
        ))}
      </div>
<div onClick={handleScroll} style={{ 
        textAlign: "center", cursor: "pointer", color: "#c1cbe6", 
        fontSize: "24px", transform: "rotate(90deg)"
      }}>❯</div>    </div>
  );
};
