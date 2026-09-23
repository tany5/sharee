"use client";

/** Chat composer — auto-growing textarea, Enter to send, Shift+Enter newline. */
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { cx } from "@/lib/utils";

export function ChatInput({
  onSend,
  onStop,
  disabled,
  busy,
}: {
  onSend: (text: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow up to ~4 lines.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [value]);

  const submit = () => {
    const t = value.trim();
    if (!t || disabled || busy) return;
    onSend(t);
    setValue("");
  };

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="flex-1">
        <span className="sr-only">Message the shopping assistant</span>
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Type a message…"
          enterKeyHint="send"
          className="max-h-24 w-full resize-none rounded-panel border border-line bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60"
        />
      </label>
      {busy ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop generating"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-ink text-bg transition-transform hover:scale-105"
        >
          <Square size={14} fill="currentColor" />
        </button>
      ) : (
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          className={cx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-pill transition-all",
            value.trim() && !disabled
              ? "bg-accent text-white hover:bg-accent-light"
              : "bg-line text-muted",
          )}
        >
          <ArrowUp size={17} strokeWidth={2.4} />
        </button>
      )}
    </form>
  );
}
