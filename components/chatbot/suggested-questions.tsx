"use client";

/** Starter chips — grounded in real store facts (flat ₹199, free shipping). */
import { SITE } from "@/lib/site";

const SUGGESTIONS = [
  `Show me sarees under ₹${SITE.price}`,
  "How much is shipping?",
  "What's your return policy?",
  "Show me cotton sarees",
  "How can I track my order?",
];

export function SuggestedQuestions({
  onPick,
  disabled,
}: {
  onPick: (q: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="list" aria-label="Suggested questions">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          type="button"
          role="listitem"
          disabled={disabled}
          onClick={() => onPick(s)}
          className="rounded-pill border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink2 transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
