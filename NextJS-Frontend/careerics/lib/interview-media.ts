import { publicConfig } from "@/config";

const FASTAPI_PROXY_PREFIX = "/api/fastapi";

export type InterviewAudioKind = "questions" | "followups";

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isUsingDirectFastApi(): boolean {
  return isAbsoluteUrl(publicConfig.fastapiUrl);
}

function getDirectFastApiBaseUrl(): string {
  return trimTrailingSlash(publicConfig.fastapiUrl);
}

function toProxyPath(value: string, kind: InterviewAudioKind): string {
  if (isAbsoluteUrl(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.pathname.startsWith("/api/fastapi/")) {
        const directPath = parsed.pathname.replace("/api/fastapi", "");
        return `${FASTAPI_PROXY_PREFIX}${directPath}${parsed.search}`;
      }

      return `${FASTAPI_PROXY_PREFIX}${parsed.pathname}${parsed.search}`;
    } catch {
      return value;
    }
  }

  if (value.startsWith(`${FASTAPI_PROXY_PREFIX}/`)) {
    return value;
  }

  if (value.startsWith("/audio/")) {
    return `${FASTAPI_PROXY_PREFIX}${value}`;
  }

  if (value.startsWith("audio/")) {
    return `${FASTAPI_PROXY_PREFIX}/${value}`;
  }

  if (value.startsWith("/")) {
    return `${FASTAPI_PROXY_PREFIX}${value}`;
  }

  return `${FASTAPI_PROXY_PREFIX}/audio/${kind}/${value}`;
}

function toDirectPath(value: string, kind: InterviewAudioKind): string {
  if (value.startsWith("/api/fastapi/")) {
    return value.replace("/api/fastapi", "");
  }

  if (value.startsWith("/audio/")) {
    return value;
  }

  if (value.startsWith("audio/")) {
    return `/${value}`;
  }

  if (value.startsWith("/")) {
    return value;
  }

  return `/audio/${kind}/${value}`;
}

function toDirectUrl(value: string, kind: InterviewAudioKind): string {
  if (isAbsoluteUrl(value)) {
    return value;
  }

  return `${getDirectFastApiBaseUrl()}${toDirectPath(value, kind)}`;
}

export function buildInterviewAudioCandidates(
  rawValue: string | null | undefined,
  kind: InterviewAudioKind,
): string[] {
  if (!rawValue) {
    return [];
  }

  const value = rawValue.trim();
  if (!value) {
    return [];
  }

  const candidates: string[] = [];

  if (isAbsoluteUrl(value)) {
    candidates.push(value);

    if (isUsingDirectFastApi()) {
      try {
        const parsed = new URL(value);
        candidates.push(toDirectUrl(`${parsed.pathname}${parsed.search}`, kind));
      } catch {
        // Preserve the original absolute candidate even if URL parsing fails.
      }
    }

    const proxyCandidate = toProxyPath(value, kind);
    if (proxyCandidate && proxyCandidate !== value) {
      candidates.push(proxyCandidate);
    }

    return Array.from(new Set(candidates.filter(Boolean)));
  }

  if (isUsingDirectFastApi()) {
    candidates.push(toDirectUrl(value, kind));
  }

  const proxyCandidate = toProxyPath(value, kind);
  if (proxyCandidate) {
    candidates.push(proxyCandidate);
  }

  if (!isUsingDirectFastApi()) {
    candidates.push(toDirectPath(value, kind));
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

export function normalizeInterviewAudioUrl(
  rawValue: string | null | undefined,
  kind: InterviewAudioKind,
): string {
  const candidates = buildInterviewAudioCandidates(rawValue, kind);
  return candidates[0] || "";
}
