import { courseService } from "@/services";
import type { UserCourseProgressItem } from "@/types";

export const COURSE_PROGRESS_UPDATED_EVENT = "course-progress-updated";

const COURSE_PROGRESS_STORAGE_KEY = "course-progress";
const COURSE_PROGRESS_STORAGE_SCOPE_GUEST = "__guest__";
const COURSE_PROGRESS_MIGRATION_KEY = "course-progress:migrated";
const LEGACY_MOCK_COURSE_IDS = new Set([
  "html-beginner",
  "javascript-advanced",
  "figma-fundamentals",
  "node-basics",
  "ux-fundamentals",
  "ux-fundamentals-completed",
  "node-basics-completed",
]);
const COURSE_PROGRESS_CACHE_TTL_MS = 5_000;

type CourseProgressStatus = "saved" | "enrolled" | "completed";

export interface CourseProgressItem {
  id: string;
  title: string;
  provider: string;
  url?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  updatedAt?: string | null;
}

export interface CourseProgressState {
  current: CourseProgressItem[];
  completed: CourseProgressItem[];
}

export const EMPTY_COURSE_PROGRESS_STATE: CourseProgressState = {
  current: [],
  completed: [],
};

const courseProgressCache = new Map<
  string,
  {
    data: CourseProgressState;
    expiresAt: number;
  }
>();
const courseProgressSyncPromises = new Map<string, Promise<CourseProgressState>>();

function getStorageScope(userId?: string | null): string {
  const normalized = userId?.trim();
  return normalized || COURSE_PROGRESS_STORAGE_SCOPE_GUEST;
}

function getScopedStorageKey(userId?: string | null): string {
  return `${COURSE_PROGRESS_STORAGE_KEY}:${getStorageScope(userId)}`;
}

function getMigrationKey(userId?: string | null): string {
  return `${COURSE_PROGRESS_MIGRATION_KEY}:${getStorageScope(userId)}`;
}

function isLegacyMockCourseId(courseId: string): boolean {
  return LEGACY_MOCK_COURSE_IDS.has(courseId);
}

function toTimestamp(value?: string | null): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCourseItem(raw: unknown): CourseProgressItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const maybe = raw as Partial<CourseProgressItem>;
  if (
    typeof maybe.id !== "string" ||
    typeof maybe.title !== "string" ||
    typeof maybe.provider !== "string" ||
    isLegacyMockCourseId(maybe.id)
  ) {
    return null;
  }

  return {
    id: maybe.id,
    title: maybe.title,
    provider: maybe.provider,
    url: typeof maybe.url === "string" ? maybe.url : null,
    startedAt: typeof maybe.startedAt === "string" ? maybe.startedAt : null,
    completedAt: typeof maybe.completedAt === "string" ? maybe.completedAt : null,
    updatedAt: typeof maybe.updatedAt === "string" ? maybe.updatedAt : null,
  };
}

function mergeCourseItems(primary: CourseProgressItem, secondary: CourseProgressItem): CourseProgressItem {
  return {
    ...secondary,
    ...primary,
    url: primary.url || secondary.url || null,
    startedAt: primary.startedAt || secondary.startedAt || null,
    completedAt: primary.completedAt || secondary.completedAt || null,
    updatedAt: primary.updatedAt || secondary.updatedAt || null,
  };
}

function normalizeUniqueCourses(entries: CourseProgressItem[]): CourseProgressItem[] {
  const byId = new Map<string, CourseProgressItem>();

  for (const entry of entries) {
    const existing = byId.get(entry.id);
    byId.set(entry.id, existing ? mergeCourseItems(existing, entry) : entry);
  }

  return Array.from(byId.values()).sort((left, right) => {
    return toTimestamp(right.updatedAt ?? right.completedAt ?? right.startedAt) -
      toTimestamp(left.updatedAt ?? left.completedAt ?? left.startedAt);
  });
}

function normalizeState(state: CourseProgressState): CourseProgressState {
  const completed = normalizeUniqueCourses(state.completed);
  const completedIds = new Set(completed.map((course) => course.id));
  const current = normalizeUniqueCourses(
    state.current.filter((course) => !completedIds.has(course.id)),
  );

  return { current, completed };
}

function parseStoredState(raw: string | null): CourseProgressState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { current?: unknown; completed?: unknown };
    if (!Array.isArray(parsed.current) || !Array.isArray(parsed.completed)) {
      return null;
    }

    const current = parsed.current
      .map((item) => normalizeCourseItem(item))
      .filter((item): item is CourseProgressItem => Boolean(item));
    const completed = parsed.completed
      .map((item) => normalizeCourseItem(item))
      .filter((item): item is CourseProgressItem => Boolean(item));

    return normalizeState({ current, completed });
  } catch {
    return null;
  }
}

function updateCache(userId: string | null | undefined, state: CourseProgressState): void {
  if (!userId) {
    return;
  }

  courseProgressCache.set(userId, {
    data: state,
    expiresAt: Date.now() + COURSE_PROGRESS_CACHE_TTL_MS,
  });
}

function serializeState(state: CourseProgressState): string {
  return JSON.stringify(normalizeState(state));
}

function notifyCourseProgressUpdated(userId?: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(COURSE_PROGRESS_UPDATED_EVENT, {
      detail: { scope: getStorageScope(userId) },
    }),
  );
}

function persistState(
  state: CourseProgressState,
  userId?: string | null,
  shouldNotify = true,
): CourseProgressState {
  const normalized = normalizeState(state);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(getScopedStorageKey(userId), serializeState(normalized));
  }

  updateCache(userId ?? null, normalized);

  if (shouldNotify) {
    notifyCourseProgressUpdated(userId);
  }

  return normalized;
}

function readStorage(userId?: string | null): CourseProgressState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const scopedState = parseStoredState(window.localStorage.getItem(getScopedStorageKey(userId)));
  if (scopedState) {
    updateCache(userId ?? null, scopedState);
    return scopedState;
  }

  const legacyState = parseStoredState(window.localStorage.getItem(COURSE_PROGRESS_STORAGE_KEY));
  if (!legacyState) {
    return null;
  }

  window.localStorage.removeItem(COURSE_PROGRESS_STORAGE_KEY);
  return persistState(legacyState, userId, false);
}

function mapServerItem(item: UserCourseProgressItem): CourseProgressItem {
  return {
    id: item.course_id,
    title: item.title,
    provider: item.provider?.trim() || "Course",
    url: item.url || null,
    startedAt: item.started_at ?? null,
    completedAt: item.completed_at ?? null,
    updatedAt: item.updated_at,
  };
}

function buildStateFromServer(current: UserCourseProgressItem[], completed: UserCourseProgressItem[]): CourseProgressState {
  return normalizeState({
    current: current.map(mapServerItem),
    completed: completed.map(mapServerItem),
  });
}

function getLocalStatus(item: CourseProgressItem, completedIds: Set<string>): CourseProgressStatus {
  if (completedIds.has(item.id)) {
    return "completed";
  }

  return "enrolled";
}

function shouldPushLocalCourse(options: {
  localItem: CourseProgressItem;
  localStatus: CourseProgressStatus;
  remoteItem?: UserCourseProgressItem;
}): boolean {
  const { localItem, localStatus, remoteItem } = options;
  if (!remoteItem) {
    return true;
  }

  const localUpdatedAt = toTimestamp(
    localItem.updatedAt ?? localItem.completedAt ?? localItem.startedAt,
  );
  const remoteUpdatedAt = toTimestamp(
    remoteItem.updated_at ??
      remoteItem.completed_at ??
      remoteItem.started_at ??
      remoteItem.saved_at,
  );

  if (localUpdatedAt && remoteUpdatedAt) {
    return localUpdatedAt > remoteUpdatedAt;
  }

  if (localUpdatedAt && !remoteUpdatedAt) {
    return true;
  }

  if (localStatus === "completed" && remoteItem.status !== "completed") {
    return true;
  }

  if (localStatus === "enrolled" && remoteItem.status === "saved") {
    return true;
  }

  return false;
}

function collectLocalEntries(state: CourseProgressState): Array<{
  item: CourseProgressItem;
  status: CourseProgressStatus;
}> {
  const completedIds = new Set(state.completed.map((item) => item.id));
  const entries: Array<{
    item: CourseProgressItem;
    status: CourseProgressStatus;
  }> = [];

  for (const item of state.completed) {
    entries.push({ item, status: "completed" });
  }

  for (const item of state.current) {
    entries.push({ item, status: getLocalStatus(item, completedIds) });
  }

  return entries;
}

async function migrateLocalStateToServer(userId: string): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  const migrationKey = getMigrationKey(userId);
  if (window.localStorage.getItem(migrationKey) === "1") {
    return false;
  }

  const localState = readStorage(userId);
  if (!localState || (!localState.current.length && !localState.completed.length)) {
    window.localStorage.setItem(migrationKey, "1");
    return false;
  }

  const remoteResponse = await courseService.getUserCourseProgress(userId);
  if (!remoteResponse.success || !remoteResponse.data) {
    return false;
  }

  const remoteItemsById = new Map<string, UserCourseProgressItem>();
  for (const item of [...remoteResponse.data.current, ...remoteResponse.data.completed]) {
    remoteItemsById.set(item.course_id, item);
  }

  const localEntries = collectLocalEntries(localState);
  let migratedAny = false;

  for (const { item, status } of localEntries) {
    if (!shouldPushLocalCourse({ localItem: item, localStatus: status, remoteItem: remoteItemsById.get(item.id) })) {
      continue;
    }

    const response = await courseService.updateCourseStatus(item.id, userId, { status });
    if (!response.success) {
      return false;
    }

    migratedAny = true;
  }

  window.localStorage.setItem(migrationKey, "1");
  return migratedAny;
}

export function loadCourseProgress(userId?: string | null): CourseProgressState {
  if (userId) {
    const cached = courseProgressCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  return readStorage(userId) || EMPTY_COURSE_PROGRESS_STATE;
}

export function saveCourseProgress(
  state: CourseProgressState,
  userId?: string | null,
): CourseProgressState {
  return persistState(state, userId, true);
}

export async function syncCourseProgressFromServer(
  userId?: string | null,
  force = false,
): Promise<CourseProgressState> {
  const normalizedUserId = userId?.trim() || "";
  if (!normalizedUserId) {
    return loadCourseProgress(userId);
  }

  if (!force) {
    const cached = courseProgressCache.get(normalizedUserId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  const pending = courseProgressSyncPromises.get(normalizedUserId);
  if (pending) {
    return pending;
  }

  const nextRequest = (async () => {
    const migrated = await migrateLocalStateToServer(normalizedUserId);
    const response = await courseService.getUserCourseProgress(normalizedUserId);

    if (!response.success || !response.data) {
      return loadCourseProgress(normalizedUserId);
    }

    const nextState = buildStateFromServer(response.data.current, response.data.completed);
    const persisted = persistState(nextState, normalizedUserId, migrated || force);
    updateCache(normalizedUserId, persisted);
    return persisted;
  })().finally(() => {
    courseProgressSyncPromises.delete(normalizedUserId);
  });

  courseProgressSyncPromises.set(normalizedUserId, nextRequest);
  return nextRequest;
}

function buildEnrolledState(
  course: CourseProgressItem,
  progress: CourseProgressState,
): CourseProgressState {
  const now = new Date().toISOString();
  const nextCompleted = progress.completed.filter((item) => item.id !== course.id);
  const nextCurrent = [
    {
      ...course,
      provider: course.provider,
      url: course.url || null,
      startedAt: course.startedAt || now,
      completedAt: null,
      updatedAt: now,
    },
    ...progress.current.filter((item) => item.id !== course.id),
  ];

  return normalizeState({ current: nextCurrent, completed: nextCompleted });
}

function buildCompletedState(courseId: string, progress: CourseProgressState): CourseProgressState {
  const course = progress.current.find((item) => item.id === courseId);
  if (!course) {
    return progress;
  }

  const now = new Date().toISOString();
  const nextCurrent = progress.current.filter((item) => item.id !== courseId);
  const nextCompleted = [
    {
      ...course,
      completedAt: now,
      updatedAt: now,
    },
    ...progress.completed.filter((item) => item.id !== courseId),
  ];

  return normalizeState({ current: nextCurrent, completed: nextCompleted });
}

function buildRetakeState(courseId: string, progress: CourseProgressState): CourseProgressState {
  const course = progress.completed.find((item) => item.id === courseId);
  if (!course) {
    return progress;
  }

  const now = new Date().toISOString();
  const nextCompleted = progress.completed.filter((item) => item.id !== courseId);
  const nextCurrent = [
    {
      ...course,
      startedAt: now,
      completedAt: null,
      updatedAt: now,
    },
    ...progress.current.filter((item) => item.id !== courseId),
  ];

  return normalizeState({ current: nextCurrent, completed: nextCompleted });
}

async function persistRemoteStatus(options: {
  courseId: string;
  userId?: string | null;
  status: CourseProgressStatus;
  optimisticState: CourseProgressState;
  previousState: CourseProgressState;
}): Promise<CourseProgressState> {
  const { courseId, userId, status, optimisticState, previousState } = options;
  const normalizedUserId = userId?.trim() || "";
  if (!normalizedUserId) {
    return optimisticState;
  }

  const response = await courseService.updateCourseStatus(courseId, normalizedUserId, { status });
  if (!response.success) {
    persistState(previousState, normalizedUserId, true);
    throw new Error(response.message || "Unable to sync course progress right now.");
  }

  updateCache(normalizedUserId, optimisticState);
  return optimisticState;
}

export async function enrollCourse(
  course: CourseProgressItem,
  userId?: string | null,
): Promise<CourseProgressState> {
  const previousState = loadCourseProgress(userId);
  const optimisticState = persistState(buildEnrolledState(course, previousState), userId, true);

  return persistRemoteStatus({
    courseId: course.id,
    userId,
    status: "enrolled",
    optimisticState,
    previousState,
  });
}

export async function completeCourse(
  courseId: string,
  userId?: string | null,
): Promise<CourseProgressState> {
  const previousState = loadCourseProgress(userId);
  const optimisticState = persistState(buildCompletedState(courseId, previousState), userId, true);

  return persistRemoteStatus({
    courseId,
    userId,
    status: "completed",
    optimisticState,
    previousState,
  });
}

export async function retakeCourse(
  courseId: string,
  userId?: string | null,
): Promise<CourseProgressState> {
  const previousState = loadCourseProgress(userId);
  const optimisticState = persistState(buildRetakeState(courseId, previousState), userId, true);

  return persistRemoteStatus({
    courseId,
    userId,
    status: "enrolled",
    optimisticState,
    previousState,
  });
}
