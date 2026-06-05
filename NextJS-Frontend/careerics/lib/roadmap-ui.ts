"use client";

import type {
  RoadmapCompletionStatus,
  RoadmapProgressSummary,
  RoadmapRead,
} from "@/types";

export type RoadmapUiResource = {
  title: string;
  url: string;
  resourceType: string;
};

export type RoadmapUiSkill = {
  id: string;
  text: string;
  checked: boolean;
  completionStatus: RoadmapCompletionStatus;
};

export type RoadmapUiSection = {
  id: string;
  title: string;
  href: string;
  resources: RoadmapUiResource[];
  skills: RoadmapUiSkill[];
  locked: boolean;
  lockReason: string | null;
  completionStatus: RoadmapCompletionStatus;
  completionPercent: number;
  completedSteps: number;
  totalSteps: number;
  hasExistingProgress: boolean;
};

export type RoadmapSectionSelection = {
  requestedSection: RoadmapUiSection | null;
  selectedSection: RoadmapUiSection | null;
  selectedSectionId: string;
  selectedIndex: number;
  lockedMessage: string | null;
};

export function toRoadmapStepSlug(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-");
}

export function buildRoadmapUiSections(options: {
  roadmap: RoadmapRead | null;
  progress: RoadmapProgressSummary | null;
  localStepCompletion?: Record<string, boolean>;
}): RoadmapUiSection[] {
  const { roadmap, progress, localStepCompletion = {} } = options;
  const orderedSections = roadmap?.sections.slice().sort((a, b) => a.order - b.order) || [];
  const progressSectionsById = new Map<string, RoadmapProgressSummary["sections"][number]>();
  const progressByStepId = new Map<string, RoadmapCompletionStatus>();

  for (const section of progress?.sections || []) {
    progressSectionsById.set(section.section_id, section);

    for (const step of section.steps) {
      progressByStepId.set(step.step_id, step.completion_status);
    }
  }

  return orderedSections.map((section, index) => {
    const rawResources = section.steps
      .slice()
      .sort((a, b) => a.order - b.order)
      .flatMap((step) => step.resources || [])
      .map((resource) => {
        const title = String(resource.title || "").trim();
        const url = String(resource.url || "").trim();
        const resourceType = String(resource.resourceType || "resource").trim();

        return {
          title: title || (url ? "Resource Link" : "Resource"),
          url,
          resourceType: resourceType || "resource",
        };
      })
      .filter((resource) => resource.title || resource.url);

    const resources: RoadmapUiResource[] = [];
    const seenResourceKeys = new Set<string>();

    for (const resource of rawResources) {
      const key = `${resource.url}|${resource.title}`;
      if (seenResourceKeys.has(key)) {
        continue;
      }

      seenResourceKeys.add(key);
      resources.push(resource);
    }

    const sectionProgress = progressSectionsById.get(section.id);
    const skills = section.steps
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((step) => {
        const backendStatus = progressByStepId.get(step.id) || "not_started";
        const checked = step.id in localStepCompletion
          ? localStepCompletion[step.id]
          : backendStatus === "completed";

        return {
          id: step.id,
          text: step.title,
          checked,
          completionStatus: checked ? "completed" : backendStatus,
        };
      });

    const previousIncompleteSection = orderedSections.slice(0, index).find((previousSection) => {
      const previousProgress = progressSectionsById.get(previousSection.id);
      return previousProgress?.completion_status !== "completed";
    });

    const hasExistingProgress = (sectionProgress?.steps || []).some((step) => {
      return step.completion_status !== "not_started";
    });

    const locked = Boolean(previousIncompleteSection) && !hasExistingProgress;
    const lockReason = locked && previousIncompleteSection
      ? `Complete "${previousIncompleteSection.title}" before opening "${section.title}".`
      : null;

    const completedSteps = sectionProgress?.completed_steps ?? skills.filter((skill) => skill.checked).length;
    const totalSteps = sectionProgress?.total_steps ?? skills.length;
    const completionPercent = sectionProgress?.completion_percent ?? (
      totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
    );

    return {
      id: section.id,
      title: section.title,
      href: section.id,
      resources,
      skills,
      locked,
      lockReason,
      completionStatus: sectionProgress?.completion_status ?? "not_started",
      completionPercent,
      completedSteps,
      totalSteps,
      hasExistingProgress,
    };
  });
}

export function getFirstUnlockedRoadmapSectionId(sections: RoadmapUiSection[]): string {
  return sections.find((section) => !section.locked)?.id || sections[0]?.id || "";
}

export function getNextUnlockedRoadmapSectionAfterCompletion(
  sections: RoadmapUiSection[],
  currentSectionId: string,
): RoadmapUiSection | null {
  const currentIndex = sections.findIndex((section) => section.id === currentSectionId);
  if (currentIndex < 0) {
    return null;
  }

  const currentSection = sections[currentIndex];
  if (currentSection?.completionStatus !== "completed") {
    return null;
  }

  const nextSection = sections[currentIndex + 1] || null;
  if (!nextSection || nextSection.locked) {
    return null;
  }

  return nextSection;
}

export function buildRoadmapStepFlowItems(sections: RoadmapUiSection[]): Array<{
  label: string;
  href: string;
}> {
  return sections.map((section) => ({
    label: section.title,
    href: section.href,
  }));
}

export function getLockedRoadmapStepIndexes(sections: RoadmapUiSection[]): number[] {
  return sections.reduce<number[]>((indexes, section, index) => {
    if (section.locked) {
      indexes.push(index);
    }
    return indexes;
  }, []);
}

export function resolveRoadmapSectionSelection(options: {
  sections: RoadmapUiSection[];
  preferredSectionId?: string | null;
  requestedSectionParam?: string | null;
  fallbackSectionId?: string | null;
}): RoadmapSectionSelection {
  const { sections, preferredSectionId, requestedSectionParam, fallbackSectionId } = options;

  if (!sections.length) {
    return {
      requestedSection: null,
      selectedSection: null,
      selectedSectionId: "",
      selectedIndex: -1,
      lockedMessage: null,
    };
  }

  const firstUnlockedSectionId = getFirstUnlockedRoadmapSectionId(sections);
  const normalizedPreferredId = String(preferredSectionId || "").trim();
  const normalizedRequestedParam = String(requestedSectionParam || "").trim().toLowerCase();
  const normalizedFallbackId = String(fallbackSectionId || "").trim();

  const requestedSection = normalizedPreferredId
    ? sections.find((section) => section.id === normalizedPreferredId) || null
    : normalizedRequestedParam
      ? sections.find((section) => {
        return (
          section.id.toLowerCase() === normalizedRequestedParam ||
          toRoadmapStepSlug(section.title) === normalizedRequestedParam
        );
      }) || null
      : normalizedFallbackId
        ? sections.find((section) => section.id === normalizedFallbackId) || null
        : sections[0] || null;

  const fallbackSelection = (
    sections.find((section) => section.id === normalizedFallbackId && !section.locked) ||
    sections.find((section) => section.id === firstUnlockedSectionId) ||
    sections[0]
  );

  const selectedSection = !requestedSection
    ? fallbackSelection
    : requestedSection.locked
      ? fallbackSelection
      : requestedSection;

  const selectedIndex = selectedSection
    ? sections.findIndex((section) => section.id === selectedSection.id)
    : -1;

  return {
    requestedSection,
    selectedSection,
    selectedSectionId: selectedSection?.id || "",
    selectedIndex,
    lockedMessage:
      requestedSection?.locked && requestedSection.id !== selectedSection?.id
        ? requestedSection.lockReason || "Complete the previous section first to unlock this one."
        : null,
  };
}
