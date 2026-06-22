import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_HEADERS_TIMEOUT_MS = 15_000;
const TOKEN_COOKIE = "careerics_token";

function parseMs(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const upstreamHeadersTimeoutMs = parseMs(
  process.env.FASTAPI_PROXY_HEADERS_TIMEOUT_MS,
  DEFAULT_HEADERS_TIMEOUT_MS,
);

async function fetchUpstreamWithTimeout(
  url: string,
  init: RequestInit & { duplex?: "half" },
): Promise<Response> {
  if (upstreamHeadersTimeoutMs <= 0) {
    return fetch(url, init);
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), upstreamHeadersTimeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}

const isDevelopment = process.env.NODE_ENV !== "production";

type ErrorMeta = {
  name: string;
  message: string;
  causeCode?: string;
  causeMessage?: string;
};

function toErrorMeta(error: unknown): ErrorMeta {
  if (!(error instanceof Error)) {
    return {
      name: "UnknownError",
      message: String(error),
    };
  }

  const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause;
  return {
    name: error.name,
    message: error.message,
    causeCode: cause?.code,
    causeMessage: cause?.message,
  };
}

function isHeadersTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === "AbortError" || error.name === "TimeoutError") {
    return true;
  }

  const cause = (error as Error & { cause?: { code?: string } }).cause;
  return cause?.code === "UND_ERR_HEADERS_TIMEOUT";
}

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "content-encoding",
  "accept-encoding",
]);

function getFastApiBaseUrl(): string {
  const configured = process.env.FASTAPI_URL?.trim();
  if (!configured) {
    if (process.env.VERCEL === "1") {
      console.error("[fastapi-proxy] FASTAPI_URL is missing in environment variables");
      throw new Error("FASTAPI_URL is missing in environment variables");
    }

    return "http://127.0.0.1:8000";
  }

  const normalized = configured.replace(/\/+$/, "");

  try {
    const parsed = new URL(normalized);
    const isLocalHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

    if (process.env.VERCEL === "1" && isLocalHost) {
      console.error("[fastapi-proxy] FASTAPI_URL points to localhost in production", {
        fastapiUrl: normalized,
      });
      throw new Error("FASTAPI_URL must not point to localhost in production");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Invalid URL")) {
      console.error("[fastapi-proxy] FASTAPI_URL is not a valid URL", {
        fastapiUrl: normalized,
      });
      throw new Error("FASTAPI_URL must be a valid absolute URL");
    }
    throw error;
  }

  return normalized;
}

const FASTAPI_BASE_URL = getFastApiBaseUrl();

function buildTargetUrl(
  baseUrl: string,
  path: string[],
  search: string,
  incomingPathname: string,
): string {
  const normalizedPath = path.length ? `/${path.join("/")}` : "";
  const keepTrailingSlash = incomingPathname.endsWith("/") && normalizedPath !== "";
  const finalPath = keepTrailingSlash ? `${normalizedPath}/` : normalizedPath;

  return `${baseUrl}${finalPath}${search}`;
}

function buildForwardHeaders(req: NextRequest): Headers {
  const headers = new Headers(req.headers);

  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }

  // FastAPI authenticates with Authorization, not browser cookies. Dropping
  // cookies here keeps forwarded headers small and avoids upstream 431s.
  headers.delete("cookie");

  if (!headers.has("authorization")) {
    const token = req.cookies.get(TOKEN_COOKIE)?.value;
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  return headers;
}

type PreparedUpstreamRequest = {
  headers: Headers;
  body: BodyInit | null | undefined;
  replayable: boolean;
  requiresDuplex: boolean;
};

function isReplayableContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }

  const normalized = contentType.toLowerCase();
  return (
    normalized.startsWith("application/json") ||
    normalized.startsWith("application/x-www-form-urlencoded")
  );
}

async function prepareUpstreamRequest(
  req: NextRequest,
  hasBody: boolean,
): Promise<PreparedUpstreamRequest> {
  const headers = buildForwardHeaders(req);

  if (!hasBody || !req.body) {
    return {
      headers,
      body: undefined,
      replayable: false,
      requiresDuplex: false,
    };
  }

  if (isReplayableContentType(headers.get("content-type"))) {
    const bodyBuffer = await req.arrayBuffer();
    return {
      headers,
      body: bodyBuffer.byteLength ? new Uint8Array(bodyBuffer) : undefined,
      replayable: true,
      requiresDuplex: false,
    };
  }

  return {
    headers,
    body: req.body,
    replayable: false,
    requiresDuplex: true,
  };
}

function rewriteLocationHeader(location: string, req: NextRequest, upstreamBase: string): string {
  const proxyPrefix = `${req.nextUrl.origin}/api/fastapi`;

  if (location.startsWith("/")) {
    return `${proxyPrefix}${location}`;
  }

  try {
    const loc = new URL(location);
    const upstream = new URL(upstreamBase);
    const sameUpstreamHostPort = loc.hostname === upstream.hostname && loc.port === upstream.port;

    if (sameUpstreamHostPort) {
      return `${proxyPrefix}${loc.pathname}${loc.search}`;
    }
  } catch {
    // If parsing fails, return original location.
  }

  return location;
}

async function handleProxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const upstreamBase = FASTAPI_BASE_URL;
  const url = buildTargetUrl(upstreamBase, path, req.nextUrl.search, req.nextUrl.pathname);

  const method = req.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  const preparedRequest = await prepareUpstreamRequest(req, hasBody);
  let upstreamResponse: Response;
  let primaryErrorMeta: ErrorMeta | null = null;

  const baseFetchInit: RequestInit & { duplex?: "half" } = {
    method,
    headers: preparedRequest.headers,
    body: preparedRequest.body,
    redirect: "manual" as RequestRedirect,
    cache: "no-store" as RequestCache,
    ...(preparedRequest.requiresDuplex ? { duplex: "half" as const } : {}),
  };

  try {
    upstreamResponse = await fetchUpstreamWithTimeout(url, baseFetchInit);
  } catch (error) {
    primaryErrorMeta = toErrorMeta(error);

    if (isHeadersTimeoutError(error)) {
      return NextResponse.json(
        {
          detail: "FastAPI timed out while preparing response headers.",
          code: "UPSTREAM_HEADERS_TIMEOUT",
        },
        { status: 504 },
      );
    }

    const canRetryRequest = !preparedRequest.requiresDuplex;

    if (canRetryRequest) {
      try {
        upstreamResponse = await fetchUpstreamWithTimeout(url, baseFetchInit);
      } catch (fallbackError) {
        const fallbackErrorMeta = toErrorMeta(fallbackError);

        if (isHeadersTimeoutError(fallbackError)) {
          return NextResponse.json(
            {
              detail: "FastAPI timed out while preparing response headers.",
              code: "UPSTREAM_HEADERS_TIMEOUT",
            },
            { status: 504 },
          );
        }

        if (isDevelopment) {
          console.error("[fastapi-proxy] upstream fetch failed", {
            url,
            method,
            primary: primaryErrorMeta,
            fallback: fallbackErrorMeta,
          });
        }

        return NextResponse.json(
          {
            detail: "Failed to connect to FastAPI upstream.",
            code: "UPSTREAM_FETCH_FAILED",
            ...(isDevelopment
              ? {
                  debug: {
                    url,
                    method,
                    replayableBody: preparedRequest.replayable,
                    primary: primaryErrorMeta,
                    fallback: fallbackErrorMeta,
                  },
                }
              : {}),
          },
          { status: 502 },
        );
      }

      primaryErrorMeta = null;
    } else {
      if (isDevelopment) {
        console.error("[fastapi-proxy] upstream fetch failed", {
          url,
          method,
          primary: primaryErrorMeta,
        });
      }

      return NextResponse.json(
        {
          detail: "Failed to connect to FastAPI upstream.",
          code: "UPSTREAM_FETCH_FAILED",
          ...(isDevelopment
            ? {
                debug: {
                  url,
                  method,
                  replayableBody: preparedRequest.replayable,
                  primary: primaryErrorMeta,
                },
              }
            : {}),
        },
        { status: 502 },
      );
    }
  }

  const responseHeaders = new Headers(upstreamResponse.headers);
  const location = responseHeaders.get("location");

  if (location) {
    responseHeaders.set("location", rewriteLocationHeader(location, req, upstreamBase));
  }

  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, context);
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, context);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, context);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, context);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, context);
}

export async function OPTIONS(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, context);
}

export async function HEAD(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, context);
}
