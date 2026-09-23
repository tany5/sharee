"use client";

/** Model download progress bar (first open of the chat). */
export function ModelLoadingState({ progress }: { progress: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const blocks = 14;
  const filled = Math.round((pct / 100) * blocks);
  return (
    <div
      className="rounded-card border border-line bg-bg p-4"
      role="status"
      aria-label={`Loading AI assistant, ${pct}% complete`}
    >
      <p className="text-sm font-semibold text-ink">Preparing your shopping assistant…</p>
      <p className="mt-1 text-xs text-muted">
        Runs in your browser — one-time download, cached for next visits.
      </p>
      <div className="mt-3 flex items-center gap-2.5" aria-hidden>
        <div className="flex gap-[3px] font-mono text-[10px] leading-none">
          {Array.from({ length: blocks }, (_, i) => (
            <span key={i} className={i < filled ? "text-accent" : "text-line"}>
              █
            </span>
          ))}
        </div>
        <span className="font-mono text-[11px] font-bold text-accent">{pct}%</span>
      </div>
    </div>
  );
}

/** Three-dot typing indicator. */
export function TypingIndicator() {
  return (
    <div className="flex justify-start" role="status" aria-label="Assistant is typing">
      <div className="flex items-center gap-1 rounded-panel rounded-bl-md border border-line bg-surface px-3.5 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60"
            style={{ animationDelay: `${i * 140}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Non-blocking notice when the local model can't run (fallback mode). */
export function ModelFallbackNotice({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="mx-1 rounded-card border border-bronze/30 bg-bronze/5 px-3 py-2.5 text-xs leading-relaxed text-ink2">
      <p>
        AI responses are generated on your device when supported. This device can&apos;t run
        the model right now — I can still help you find products and answer common questions.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1.5 font-semibold text-accent underline underline-offset-2"
        >
          Try loading again
        </button>
      )}
    </div>
  );
}
