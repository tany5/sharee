/**
 * Client-only: subscribe to a localStorage value as reactive state without
 * set-state-in-effect (the React-recommended hydration-safe pattern).
 *
 *  - Server render & hydration read the empty snapshot (no mismatches)
 *  - After hydration the real stored value is applied instantly
 *  - Mutations go through `commitLocalValue`, which persists + notifies this
 *    tab (custom event) and other tabs (storage event)
 *
 * getSnapshot caches parsed values keyed by the raw localStorage string so it
 * returns a stable reference unless the stored value actually changed
 * (useSyncExternalStore requirement).
 */
"use client";

import { useRef, useSyncExternalStore } from "react";

function eventName(key: string): string {
  return `ambika:${key}`;
}

const snapshotCache = new Map<string, { raw: string | null; value: unknown }>();

function readValue<T>(key: string, empty: T): T {
  if (typeof window === "undefined") return empty;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return empty;
  }
  const hit = snapshotCache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = empty;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = empty;
    }
  }
  snapshotCache.set(key, { raw, value });
  return value;
}

export function commitLocalValue<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
  snapshotCache.delete(key);
  window.dispatchEvent(new Event(eventName(key)));
}

export function useLocalValue<T>(key: string, empty: T): T {
  const emptyRef = useRef(empty).current;
  return useSyncExternalStore(
    (onChange) => {
      const onStorage = (e: StorageEvent) => {
        if (e.key === key || e.key === null) onChange();
      };
      const onLocal = () => onChange();
      window.addEventListener("storage", onStorage);
      window.addEventListener(eventName(key), onLocal);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(eventName(key), onLocal);
      };
    },
    () => readValue(key, emptyRef),
    () => emptyRef,
  );
}

/** One-off (non-reactive) read — kept for cases that only need current value. */
export function readLocalValue<T>(key: string, empty: T): T {
  return readValue(key, empty);
}
