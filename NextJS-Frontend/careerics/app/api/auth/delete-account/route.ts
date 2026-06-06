import { NextRequest, NextResponse } from "next/server";
import {
  createClient,
  type PostgrestError,
  type SupabaseClient,
} from "@supabase/supabase-js";

export const runtime = "nodejs";

const TOKEN_COOKIE = "careerics_token";
const DELETE_BATCH_SIZE = 500;

const DIRECT_USER_TABLES = [
  "user_skills",
  "user_experiences",
  "user_education",
  "user_certifications",
  "user_projects",
  "user_languages",
  "user_awards",
  "user_references",
  "reports",
  "user_roadmap_bookmarks",
  "roadmap_assessment_results",
  "user_journey_progress",
  "job_user_interactions",
  "job_applications",
  "course_user_progress",
] as const;

type AdminClient = SupabaseClient;

function formatUserTag(userId: string): string {
  if (!userId) {
    return "unknown";
  }

  if (userId.length <= 10) {
    return userId;
  }

  return `${userId.slice(0, 6)}...${userId.slice(-4)}`;
}

function logDeleteAccountInfo(step: string, details?: Record<string, unknown>) {
  console.info("[delete-account]", step, details ?? {});
}

function logDeleteAccountWarn(step: string, details?: Record<string, unknown>) {
  console.warn("[delete-account]", step, details ?? {});
}

function logDeleteAccountError(step: string, details?: Record<string, unknown>) {
  console.error("[delete-account]", step, details ?? {});
}

function publicTable(adminClient: AdminClient, table: string) {
  return adminClient.schema("public").from(table);
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function formatPostgrestError(error: PostgrestError | null): string {
  if (!error) {
    return "Unknown database error.";
  }

  const details = [error.message, error.details, error.hint]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" | ");

  return details || "Unknown database error.";
}

function isMissingTableError(error: PostgrestError | null): boolean {
  if (!error) {
    return false;
  }

  if (error.code === "42P01" || error.code === "PGRST205") {
    return true;
  }

  return /could not find the table/i.test(error.message);
}

function readStringField(row: unknown, field: string): string | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const value = (row as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

function readBlockingTableFromFkError(error: PostgrestError | null): string | null {
  if (!error) {
    return null;
  }

  const source = `${error.message || ""} ${error.details || ""}`;
  const referencedMatch = source.match(/referenced from table "([^"]+)"/i);
  if (referencedMatch?.[1]) {
    return referencedMatch[1];
  }

  const onTableMatch = source.match(/on table "([^"]+)"/i);
  if (onTableMatch?.[1]) {
    return onTableMatch[1];
  }

  return null;
}

async function forceDeleteUsersRow(adminClient: AdminClient, userId: string): Promise<void> {
  const attemptedBlockingTables = new Set<string>();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { error } = await publicTable(adminClient, "users")
      .delete()
      .eq("id", userId);

    if (!error) {
      return;
    }

    if (isMissingTableError(error)) {
      return;
    }

    const blockingTable = readBlockingTableFromFkError(error);
    if (!blockingTable || blockingTable === "users" || attemptedBlockingTables.has(blockingTable)) {
      throw new Error(`Failed deleting from users: ${formatPostgrestError(error)}`);
    }

    attemptedBlockingTables.add(blockingTable);

    await deleteWhereEq(adminClient, blockingTable, "user_id", userId, {
      ignoreMissingTable: true,
    });
  }

  throw new Error("Failed deleting from users: too many FK cleanup attempts.");
}

async function selectIdsWhereEq(
  adminClient: AdminClient,
  table: string,
  idColumn: string,
  filterColumn: string,
  filterValue: string,
  options?: { ignoreMissingTable?: boolean },
): Promise<string[]> {
  const { data, error } = await adminClient
    .schema("public")
    .from(table)
    .select(idColumn)
    .eq(filterColumn, filterValue);

  if (error) {
    if (options?.ignoreMissingTable && isMissingTableError(error)) {
      return [];
    }

    throw new Error(`Failed selecting from ${table}: ${formatPostgrestError(error)}`);
  }

  return (data ?? [])
    .map((row) => {
      return readStringField(row, idColumn);
    })
    .filter((value): value is string => Boolean(value));
}

async function selectIdsWhereIn(
  adminClient: AdminClient,
  table: string,
  idColumn: string,
  filterColumn: string,
  filterValues: string[],
  options?: { ignoreMissingTable?: boolean },
): Promise<string[]> {
  if (!filterValues.length) {
    return [];
  }

  const values = new Set<string>();

  for (const batch of chunkArray(filterValues, DELETE_BATCH_SIZE)) {
    const { data, error } = await adminClient
      .schema("public")
      .from(table)
      .select(idColumn)
      .in(filterColumn, batch);

    if (error) {
      if (options?.ignoreMissingTable && isMissingTableError(error)) {
        return [];
      }

      throw new Error(`Failed selecting from ${table}: ${formatPostgrestError(error)}`);
    }

    for (const row of data ?? []) {
      const value = readStringField(row, idColumn);
      if (value) {
        values.add(value);
      }
    }
  }

  return Array.from(values);
}

async function deleteWhereEq(
  adminClient: AdminClient,
  table: string,
  filterColumn: string,
  filterValue: string,
  options?: { ignoreMissingTable?: boolean },
): Promise<void> {
  const { error } = await publicTable(adminClient, table)
    .delete()
    .eq(filterColumn, filterValue);

  if (error) {
    if (options?.ignoreMissingTable && isMissingTableError(error)) {
      return;
    }

    throw new Error(`Failed deleting from ${table}: ${formatPostgrestError(error)}`);
  }
}

async function deleteWhereIn(
  adminClient: AdminClient,
  table: string,
  filterColumn: string,
  filterValues: string[],
  options?: { ignoreMissingTable?: boolean },
): Promise<void> {
  if (!filterValues.length) {
    return;
  }

  for (const batch of chunkArray(filterValues, DELETE_BATCH_SIZE)) {
    const { error } = await publicTable(adminClient, table)
      .delete()
      .in(filterColumn, batch);

    if (error) {
      if (options?.ignoreMissingTable && isMissingTableError(error)) {
        return;
      }

      throw new Error(`Failed deleting from ${table}: ${formatPostgrestError(error)}`);
    }
  }
}

async function deletePublicUserData(adminClient: AdminClient, userId: string): Promise<void> {
  // Interview data (leaf tables first).
  const interviewSessionIds = await selectIdsWhereEq(
    adminClient,
    "interview_sessions",
    "id",
    "user_id",
    userId,
    { ignoreMissingTable: true },
  );
  const interviewAnswerIds = await selectIdsWhereIn(
    adminClient,
    "interview_answers",
    "id",
    "session_id",
    interviewSessionIds,
    { ignoreMissingTable: true },
  );

  await deleteWhereIn(adminClient, "interview_followups", "answer_id", interviewAnswerIds, {
    ignoreMissingTable: true,
  });
  await deleteWhereIn(adminClient, "interview_answers", "session_id", interviewSessionIds, {
    ignoreMissingTable: true,
  });
  await deleteWhereIn(adminClient, "interview_sessions", "id", interviewSessionIds, {
    ignoreMissingTable: true,
  });

  // Assessment sessions can exist even without an FK constraint.
  const assessmentSessionIds = await selectIdsWhereEq(
    adminClient,
    "assessment_sessions",
    "id",
    "user_id",
    userId,
    { ignoreMissingTable: true },
  );

  await deleteWhereIn(adminClient, "assessment_answers", "session_id", assessmentSessionIds, {
    ignoreMissingTable: true,
  });
  await deleteWhereIn(adminClient, "assessment_questions", "session_id", assessmentSessionIds, {
    ignoreMissingTable: true,
  });
  await deleteWhereIn(adminClient, "assessment_sessions", "id", assessmentSessionIds, {
    ignoreMissingTable: true,
  });

  // Career quiz sessions.
  const careerSessionIds = await selectIdsWhereEq(
    adminClient,
    "career_sessions",
    "id",
    "user_id",
    userId,
    { ignoreMissingTable: true },
  );

  await deleteWhereIn(adminClient, "career_track_results", "session_id", careerSessionIds, {
    ignoreMissingTable: true,
  });
  await deleteWhereIn(adminClient, "career_answers", "session_id", careerSessionIds, {
    ignoreMissingTable: true,
  });
  await deleteWhereIn(adminClient, "career_selected_cards", "session_id", careerSessionIds, {
    ignoreMissingTable: true,
  });
  await deleteWhereIn(adminClient, "career_sessions", "id", careerSessionIds, {
    ignoreMissingTable: true,
  });

  for (const table of DIRECT_USER_TABLES) {
    await deleteWhereEq(adminClient, table, "user_id", userId, {
      ignoreMissingTable: true,
    });
  }

  await forceDeleteUsersRow(adminClient, userId);
}

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    "";
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service-role configuration is missing.");
  }

  return { supabaseUrl, serviceRoleKey };
}

function readAccessToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token) {
      return token;
    }
  }

  return req.cookies.get(TOKEN_COOKIE)?.value ?? null;
}

async function isPublicUserDeleted(adminClient: AdminClient, userId: string): Promise<boolean> {
  const { data, error } = await adminClient
    .schema("public")
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return true;
    }

    throw new Error(`Failed verifying users deletion: ${formatPostgrestError(error)}`);
  }

  return !data;
}

async function isAuthUserDeleted(adminClient: AdminClient, userId: string): Promise<boolean> {
  const { data, error } = await adminClient.auth.admin.getUserById(userId);
  if (error) {
    if (/not found/i.test(error.message || "")) {
      return true;
    }

    throw new Error(
      `Failed verifying auth user deletion: ${error.message || "Unknown auth error."}`,
    );
  }

  return !data.user;
}

export async function POST(req: NextRequest) {
  let userTag = "unknown";

  try {
    logDeleteAccountInfo("request_received", {
      hasAuthorizationHeader: Boolean(req.headers.get("authorization")),
      hasSessionCookie: Boolean(req.cookies.get(TOKEN_COOKIE)?.value),
    });

    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    logDeleteAccountInfo("config_loaded", {
      supabaseHost: (() => {
        try {
          return new URL(supabaseUrl).host;
        } catch {
          return "invalid-url";
        }
      })(),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });

    const accessToken = readAccessToken(req);

    if (!accessToken) {
      logDeleteAccountWarn("missing_access_token");
      return NextResponse.json(
        { detail: "Missing authenticated session." },
        { status: 401 },
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: "public" },
    });

    const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
    if (authError || !authData.user?.id) {
      logDeleteAccountWarn("access_token_invalid", {
        reason: authError?.message || "missing user id",
      });
      return NextResponse.json(
        { detail: authError?.message || "Invalid authenticated session." },
        { status: 401 },
      );
    }

    const userId = authData.user.id;
    userTag = formatUserTag(userId);
    logDeleteAccountInfo("authenticated_user_resolved", { userTag });

    logDeleteAccountInfo("public_data_deletion_started", { userTag });
    await deletePublicUserData(adminClient, userId);
    logDeleteAccountInfo("public_data_deletion_completed", { userTag });

    logDeleteAccountInfo("public_user_verification_started", { userTag });
    const publicUserDeleted = await isPublicUserDeleted(adminClient, userId);
    if (!publicUserDeleted) {
      logDeleteAccountError("public_user_verification_failed", { userTag });
      return NextResponse.json(
        { detail: "Public profile record still exists after deletion attempt." },
        { status: 500 },
      );
    }
    logDeleteAccountInfo("public_user_verification_passed", { userTag });

    logDeleteAccountInfo("auth_user_deletion_started", { userTag });
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      logDeleteAccountError("auth_user_deletion_failed", {
        userTag,
        reason: deleteAuthError.message || "unknown error",
      });
      return NextResponse.json(
        { detail: deleteAuthError.message || "Failed to delete auth account." },
        { status: 500 },
      );
    }

    logDeleteAccountInfo("auth_user_deletion_completed", { userTag });
    logDeleteAccountInfo("auth_user_verification_started", { userTag });
    const authUserDeleted = await isAuthUserDeleted(adminClient, userId);
    if (!authUserDeleted) {
      logDeleteAccountError("auth_user_verification_failed", { userTag });
      return NextResponse.json(
        { detail: "Auth user still exists after deletion attempt." },
        { status: 500 },
      );
    }
    logDeleteAccountInfo("auth_user_verification_passed", { userTag });
    logDeleteAccountInfo("delete_account_completed", { userTag });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to delete account right now.";

    logDeleteAccountError("delete_account_unexpected_error", {
      userTag,
      message,
    });

    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
