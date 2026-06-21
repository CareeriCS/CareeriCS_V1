"use client";

import { useEffect, useState } from "react";

const NAVIGATION_LOCK_OWNERS_STORAGE_KEY = "careerics:navigation-lock:owners";
export const NAVIGATION_LOCK_UPDATED_EVENT = "careerics:navigation-lock-updated";

type NavigationLockState = {
  locked: boolean;
  owners: string[];
};

function getNormalizedOwners(rawValue: string | null): string[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return Array.from(
      new Set(
        parsed
          .map((owner) => String(owner || "").trim())
          .filter(Boolean),
      ),
    );
  } catch {
    return [];
  }
}

function readOwners(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  return getNormalizedOwners(
    window.sessionStorage.getItem(NAVIGATION_LOCK_OWNERS_STORAGE_KEY),
  );
}

function notifyNavigationLockUpdated(owners: string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(NAVIGATION_LOCK_UPDATED_EVENT, {
      detail: {
        owners,
        locked: owners.length > 0,
      },
    }),
  );
}

function persistOwners(owners: string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  if (owners.length) {
    window.sessionStorage.setItem(
      NAVIGATION_LOCK_OWNERS_STORAGE_KEY,
      JSON.stringify(owners),
    );
  } else {
    window.sessionStorage.removeItem(NAVIGATION_LOCK_OWNERS_STORAGE_KEY);
  }

  notifyNavigationLockUpdated(owners);
}

export function getNavigationLockState(): NavigationLockState {
  const owners = readOwners();
  return {
    locked: owners.length > 0,
    owners,
  };
}

export function acquireNavigationLock(ownerId: string): void {
  const normalizedOwnerId = ownerId.trim();
  if (!normalizedOwnerId || typeof window === "undefined") {
    return;
  }

  const owners = readOwners();
  if (owners.includes(normalizedOwnerId)) {
    return;
  }

  persistOwners([...owners, normalizedOwnerId]);
}

export function releaseNavigationLock(ownerId: string): void {
  const normalizedOwnerId = ownerId.trim();
  if (!normalizedOwnerId || typeof window === "undefined") {
    return;
  }

  const owners = readOwners();
  if (!owners.includes(normalizedOwnerId)) {
    return;
  }

  persistOwners(owners.filter((owner) => owner !== normalizedOwnerId));
}

export function useNavigationLock(ownerId: string, enabled: boolean): void {
  useEffect(() => {
    const normalizedOwnerId = ownerId.trim();
    if (!normalizedOwnerId) {
      return;
    }

    if (enabled) {
      acquireNavigationLock(normalizedOwnerId);
      return () => {
        releaseNavigationLock(normalizedOwnerId);
      };
    }

    releaseNavigationLock(normalizedOwnerId);
    return () => {
      releaseNavigationLock(normalizedOwnerId);
    };
  }, [enabled, ownerId]);
}

export function useNavigationLockState(): NavigationLockState {
  const [state, setState] = useState<NavigationLockState>(getNavigationLockState);

  useEffect(() => {
    const handleLockUpdated = () => {
      setState(getNavigationLockState());
    };

    window.addEventListener(NAVIGATION_LOCK_UPDATED_EVENT, handleLockUpdated);
    return () => {
      window.removeEventListener(NAVIGATION_LOCK_UPDATED_EVENT, handleLockUpdated);
    };
  }, []);

  return state;
}
