"use client";

/** Floating action button for the assistant. */
import { Sparkles } from "lucide-react";
import { cx } from "@/lib/utils";

export function ChatButton({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? "Close shopping assistant" : "Open shopping assistant"}
      aria-expanded={open}
      aria-haspopup="dialog"
      className={cx(
        "fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] right-4 z-[59]",
        "flex h-13 w-13 items-center justify-center rounded-pill shadow-lg transition-all duration-300",
        "md:bottom-6 md:right-6 h-12 w-12",
        open
          ? "rotate-90 bg-ink text-bg"
          : "bg-accent text-white hover:scale-105 hover:bg-accent-light",
      )}
    >
      <Sparkles size={21} className={open ? "hidden" : ""} aria-hidden />
      <span
        className={cx("text-xl leading-none", open ? "" : "hidden")}
        aria-hidden
      >
        ×
      </span>
    </button>
  );
}
