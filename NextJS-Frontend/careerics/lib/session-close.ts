"use client";

const CLOSE_STATUS_TIMEOUT_MS = 4000;

export function isActiveSessionStatus(status: string | null | undefined): boolean {
  return (status || "").trim().toLowerCase() === "in_progress";
}

export async function runCloseStatusUpdate(
  label: string,
  updateStatus: () => Promise<void>,
): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      updateStatus(),
      new Promise<void>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} status update timed out.`));
        }, CLOSE_STATUS_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.warn(`We could not update the ${label} session before closing.`, error);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
