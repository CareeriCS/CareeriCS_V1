import React from "react";
import CustomDropdown from "./dropdown-menu";

export type SkillFilterType = "general" | "specific";

export interface SkillFilterTrackOption {
  id: string;
  title: string;
}

interface SkillFiltersProps {
  tracks: SkillFilterTrackOption[];
  selectedTrackId: string;
  onTrackChange: (trackId: string) => void;
  skillType: SkillFilterType;
  onSkillTypeChange: (type: SkillFilterType) => void;
  disabled?: boolean;
  disableSkillTypeToggle?: boolean;
  trackHelperText?: string;
  style?: React.CSSProperties;
}

export default function SkillFilters({
  tracks,
  selectedTrackId,
  onTrackChange,
  skillType,
  onSkillTypeChange,
  disabled = false,
  disableSkillTypeToggle = false,
  style,
}: SkillFiltersProps) {

  const isSkillTypeDisabled = disabled || disableSkillTypeToggle;

  function getButtonStyle(type: SkillFilterType): React.CSSProperties {
    const isActive = skillType === type;

    return {
      flex: 1,
      
      borderRadius: "var(--radius-md)",
      backgroundColor: isActive ? "var(--light-green)" : "#C1CBE6",
      color: "#000",
      fontSize: "var(--text-base)",
      paddingBlock: "var(--button-padding-y)", 
      fontWeight: 600,
      cursor: isSkillTypeDisabled ? "not-allowed" : "pointer",
      transition: "all 0.25s ease",
      opacity: isSkillTypeDisabled ? 0.7 : 1,
      border: "none",
      whiteSpace: "nowrap",
    };
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "var(--medium-blue)",
        color: "white",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",

        padding: "var(--space-xl)",
        gap: "var(--space-md)",

        borderRadius: "var(--radius-xl)",
        boxSizing: "border-box",

        ...style,
      }}
    >
      {/* Track Selector */}
      <div style={{ width: "100%", height: "fit-content", }}>
        <h3
          style={{
            fontSize: "var(--text-md)",
          }}
        >
          Track
        </h3>

        <CustomDropdown
          background="#C1CBE6"
          value={selectedTrackId}
          options={tracks}
          placeholder="Choose a track"
          onChange={onTrackChange}
        />
      </div>

      {/* Skill Type Toggle */}
      <div style={{ width: "100%", height: "fit-content", }}>
        <h3
          style={{
            fontSize: "var(--text-md)",
          }}
        >
          Skill Type
        </h3>

        <div
          style={{
            display: "flex",
            gap: "var(--space-md)",
            width: "100%",
          }}
        >
          <button
            onClick={() => onSkillTypeChange("general")}
            disabled={isSkillTypeDisabled}
            style={getButtonStyle("general")}
          >
            General Topic
          </button>

          <button
            onClick={() => onSkillTypeChange("specific")}
            disabled={isSkillTypeDisabled}
            style={getButtonStyle("specific")}
          >
            Specific Skill
          </button>
        </div>
      </div>
    </div>
  );
}