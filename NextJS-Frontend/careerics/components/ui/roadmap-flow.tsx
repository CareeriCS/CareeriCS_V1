"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useResponsive } from "@/hooks/useResponsive";

type StepItem = {
  label: string;
  href: string;
};

type StepNode = {
  label: string | null;
  href?: string;
  globalIndex: number;
};

type StepFlowProps = {
  steps: StepItem[];
  isNavigatable?: boolean;
  onSelect?: (index: number) => void;
  selectedIndex?: number;
  lockedStepIndexes?: number[];
  variant?: "light" | "dark";
  routeOnClick?: boolean;
  roadmapId?: string;
};



export const StepFlow: React.FC<StepFlowProps> = ({
  steps,
  onSelect,
  isNavigatable = true,
  selectedIndex,
  lockedStepIndexes = [],
  routeOnClick = true,
  roadmapId,
  variant = "light",
}) => {

  const { isLarge, isMedium, isSmall } = useResponsive();

  const COLUMNS = isLarge ? 4 : 3;
  const ROW_GAP = isSmall ? 40 : 50;
  const NODE_HEIGHT = 60  ;


  const DEFAULT_BORDER_COLOR = variant === "light" ? "#C1CBE6" : "var(--medium-blue)";
  const router = useRouter();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const lockedStepIndexSet = new Set(lockedStepIndexes);

  let horizontalCount = 0;
  let verticalCount = 0;

  const rows: StepNode[][] = [];

  for (let i = 0; i < steps.length; i += COLUMNS) {
    const chunk: StepNode[] = steps
      .slice(i, i + COLUMNS)
      .map((step, index) => ({
        label: step.label,
        href: step.href,
        globalIndex: i + index,
      }));

    const rowIndex = Math.floor(i / COLUMNS);
    const isOddRow = rowIndex % 2 === 1;

    while (chunk.length < COLUMNS) {
      chunk.push({
        label: null,
        globalIndex: -1,
      });
    }

    if (isOddRow) chunk.reverse();

    rows.push(chunk);
  }

  const flat = rows.flat();
  const HORIZONTAL_DISTANCE = ROW_GAP;

  const toSlug = (text: string) =>
    text.toLowerCase().replace(/\s+/g, "-");

  const resolveStepParam = (node: StepNode): string => {
    if (node.href && node.href !== "#") {
      return node.href;
    }
    return node.label ? toSlug(node.label) : "";
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
        columnGap: `${ROW_GAP}px`,
        rowGap: `${ROW_GAP}px`,
        width: "100%",
        height: "100%",
      }}
    >
      {flat.map((node, index) => {
        if (!node.label) return <div key={`empty-${index}`} />;

        const rowIndex = Math.floor(index / COLUMNS);
        const colIndex = index % COLUMNS;

        const isLastStep = node.globalIndex === steps.length - 1;

        const isEndOfRow =
          rowIndex % 2 === 1
            ? colIndex === 0
            : colIndex === COLUMNS - 1;

        const isHovered = hoveredIndex === node.globalIndex;
        const isSelected = selectedIndex === node.globalIndex;
        const isLocked = lockedStepIndexSet.has(node.globalIndex);

        return (
          <div
            key={node.globalIndex}
            style={{
              position: "relative",
              width: "100%",
              height: NODE_HEIGHT,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontFamily: "var(--font-nova-square)",
            }}
          >
            {/* NODE */}
            <div
              onMouseEnter={() => {
                if (!isLocked) {
                  setHoveredIndex(node.globalIndex);
                }
              }}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => {
                if (isLocked) {
                  return;
                }

                onSelect?.(node.globalIndex);

                if (isNavigatable && routeOnClick && node.label) {
                  const params = new URLSearchParams();
                  const stepParam = resolveStepParam(node);

                  if (roadmapId) {
                    params.set("roadmap", roadmapId);
                  }

                  if (stepParam) {
                    params.set("step", stepParam);
                  }

                  const query = params.toString();
                  router.push(
                    query
                      ? `/roadmap-feature?${query}`
                      : "/roadmap-feature"
                  );
                }
              }}
              style={{
                width: "100%",
                height: NODE_HEIGHT,
                border: `2px solid ${isLocked
                  ? "rgba(148, 163, 184, 0.35)"
                  : isHovered || isSelected
                    ? "var(--light-green)"
                    : DEFAULT_BORDER_COLOR
                  }`,
                borderRadius: "3.5vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                background:
                  isLocked
                    ? "rgba(15, 23, 42, 0.65)"
                    : isHovered || isSelected
                      ? "var(--light-green)"
                      : variant === "light" ?
                        "#C1CBE6" :
                        "var(--medium-blue)",
                fontSize: isSmall?"var(--text-xxs)":"var(--text-sm)",
                zIndex: 2,
                cursor: isLocked ? "not-allowed" : isNavigatable ? "pointer" : "default",
                paddingBlock: "1rem",
                paddingInline: "0.5rem",
                color: isLocked
                  ? "#CBD5E1"
                  : isHovered || isSelected || variant === "light"
                    ? "black"
                    : "white",
                opacity: isLocked ? 0.8 : 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.15rem",
                }}
              >
                <span>{node.label}</span>
                {isLocked ? (
                  <span style={{ fontSize: "0.55rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Locked
                  </span>
                ) : null}
              </div>
            </div>

            {/* HORIZONTAL CONNECTOR (occurrence-based flip) */}
            {!isEndOfRow && !isLastStep && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: rowIndex % 2 === 1
                    ? `-${HORIZONTAL_DISTANCE}px`
                    : "100%",
                  width: `${HORIZONTAL_DISTANCE}px`,
                  height: "20px",
                  transform: "translateY(-50%)",
                  overflow: "hidden",
                  zIndex: 1,
                }}
              >
                <img
                  src={variant === "light" ? "/roadmap/connector.svg" : "/roadmap/connector-blue.svg"}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "fill",
                    transform:
                      horizontalCount++ % 2 === 1
                        ? "scaleX(-1)"
                        : "scaleX(1)",
                  }}
                />
              </div>
            )}

            {/* VERTICAL CONNECTOR (occurrence-based flip) */}
            {isEndOfRow && !isLastStep && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: "50%",
                  width: "20px",
                  height: `${ROW_GAP}px`,
                  transform: "translateX(-50%)",
                  overflow: "hidden",
                  zIndex: 1,
                }}
              >
                <img
                  src={variant === "light" ? "/roadmap/connector-vertical.svg" : "/roadmap/connector-vertical-blue.svg"}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "fill",
                    transform:
                      verticalCount++ % 2 === 1
                        ? "scaleY(-1)"
                        : "scaleY(1)",
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
