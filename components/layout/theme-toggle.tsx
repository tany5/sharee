"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_KEY } from "@/lib/client-store";
import { cx } from "@/lib/utils";

function subscribeTheme(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY || e.key === null) onChange();
  };
  const onLocal = () => onChange();
  window.addEventListener("storage", onStorage);
  document.addEventListener("ambika:theme", onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    document.removeEventListener("ambika:theme", onLocal);
  };
}

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function ThemeToggle({ className }: { className?: string }) {
  // Server snapshot: light. After hydration the real class is applied without
  // a visible flash (useSyncExternalStore re-renders before paint).
  const dark = useSyncExternalStore(
    subscribeTheme,
    () => isDark(),
    () => false,
  );

  const toggle = useCallback(() => {
    const next = !isDark();
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      /* ignore */
    }
    document.dispatchEvent(new Event("ambika:theme"));
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={cx(
        "flex h-10 w-10 items-center justify-center rounded-full text-ink2 transition-colors hover:bg-accent/15 hover:text-ink",
        className,
      )}
    >
      {dark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}
