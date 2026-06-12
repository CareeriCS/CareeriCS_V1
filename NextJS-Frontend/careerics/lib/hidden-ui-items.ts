export function normalizeHiddenUiText(value?: string | null): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

export function isComputerScienceUiLabel(value?: string | null): boolean {
  const normalized = normalizeHiddenUiText(value);
  return normalized === "computer science" || normalized === "cs";
}

export function hasComputerScienceUiText(value?: string | null): boolean {
  const normalized = normalizeHiddenUiText(value);
  if (!normalized) return false;

  return (
    normalized === "computer science" ||
    normalized === "cs" ||
    normalized.includes("computer science")
  );
}

export function isHiddenComputerScienceOption(option: unknown): boolean {
  if (typeof option === "string") {
    return isComputerScienceUiLabel(option);
  }

  if (!option || typeof option !== "object") {
    return false;
  }

  const item = option as {
    title?: string | null;
    label?: string | null;
    name?: string | null;
    value?: string | null;
  };

  return (
    isComputerScienceUiLabel(item.title) ||
    isComputerScienceUiLabel(item.label) ||
    isComputerScienceUiLabel(item.name) ||
    isComputerScienceUiLabel(item.value)
  );
}

export type HiddenComputerScienceCourseContext = {
  roadmapTitle?: string | null;
};

export function isHiddenComputerScienceCourse(
  item: unknown,
  context?: HiddenComputerScienceCourseContext,
): boolean {
  if (!item || typeof item !== "object") {
    return false;
  }

  const course = item as {
    title?: string | null;
    name?: string | null;
    provider?: string | null;
    description?: string | null;
    category?: string | null;
    department?: string | null;
    major?: string | null;
    track?: string | null;
    track_name?: string | null;
    roadmap_title?: string | null;
    tags?: string[] | null;
  };

  const strongFields = [
    course.category,
    course.department,
    course.major,
    course.track,
    course.track_name,
    course.roadmap_title ?? context?.roadmapTitle,
  ];

  const tagMatch = course.tags?.some(hasComputerScienceUiText) ?? false;

  return strongFields.some(hasComputerScienceUiText) || tagMatch;
}
