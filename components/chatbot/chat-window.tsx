"use client";

/**
 * Chat window — the assistant panel. Desktop: anchored card. Mobile:
 * near-full-screen sheet. Handles focus management, Escape-to-close, and the
 * privacy note. It does NOT load the model; Chatbot.tsx decides when.
 */
import { useEffect, useRef } from "react";
import { RotateCcw, Sparkles, X } from "lucide-react";
import { ChatMessageView } from "./chat-message";
import { ChatInput } from "./chat-input";
import { SuggestedQuestions } from "./suggested-questions";
import { ModelFallbackNotice, ModelLoadingState, TypingIndicator } from "./loading-state";
import { useChat } from "@/lib/ai/use-chat";
import { SITE } from "@/lib/site";
import { cx } from "@/lib/utils";

export function ChatWindow({
  open,
  onClose,
  loadModel,
}: {
  open: boolean;
  onClose: () => void;
  loadModel: () => void;
}) {
  const chat = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  /* Escape closes; focus lands on close button when opened. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Minimal focus trap between the panel and the page.
      if (e.key === "Tab") {
        const panel = document.getElementById("tt-chat-panel");
        if (!panel) return;
        const focusables = panel.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /* Lock body scroll on mobile while open. */
  useEffect(() => {
    if (!open) return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* Keep the newest message in view. */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages.length, chat.streamingText, chat.thinking]);

  /* Kick off model load on first open (non-blocking; chat works regardless). */
  useEffect(() => {
    if (open) loadModel();
  }, [open, loadModel]);

  const showSuggestions = chat.messages.length <= 1 && !chat.thinking;

  return (
    <div
      id="tt-chat-panel"
      role="dialog"
      aria-modal="true"
      aria-label={`${SITE.name} shopping assistant`}
      className={cx(
        "fixed z-[60] flex flex-col overflow-hidden border border-line bg-bg shadow-[0_16px_60px_rgba(77,21,38,0.25)]",
        /* Mobile: full sheet with safe-area respect. */
        "inset-x-2 bottom-2 top-16 rounded-panel",
        /* Desktop: anchored card. */
        "md:inset-auto md:bottom-24 md:right-6 md:h-[600px] md:max-h-[calc(100dvh-8rem)] md:w-[400px]",
        "animate-toast-in",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-line bg-surface px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Sparkles size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">TheTanti Assistant</p>
          <p className="text-[10.5px] text-muted">
            {chat.modelState === "ready"
              ? `AI on device · ${chat.modelDevice === "webgpu" ? "WebGPU" : "fast mode"}`
              : chat.modelState === "loading"
                ? "Preparing AI…"
                : "Product & help expert"}
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={chat.clear}
          aria-label="Clear conversation"
          className="flex h-8 w-8 items-center justify-center rounded-pill text-muted transition-colors hover:bg-accent/10 hover:text-ink"
        >
          <RotateCcw size={15} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="flex h-8 w-8 items-center justify-center rounded-pill text-muted transition-colors hover:bg-accent/10 hover:text-ink"
        >
          <X size={17} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-3 py-3"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {chat.messages.map((m, i) => (
          <ChatMessageView
            key={m.id}
            message={m}
            streaming={chat.thinking && m.id === chat.messages[chat.messages.length - 1]?.id && !m.text && chat.streamingText.length > 0}
            isLastAssistant={
              m.role === "assistant" &&
              i === chat.messages.length - 1 &&
              !chat.thinking &&
              m.text.length > 0
            }
            onRegenerate={chat.regenerate}
          />
        ))}

        {chat.thinking && chat.streamingText.length === 0 && <TypingIndicator />}

        {chat.modelState === "loading" && chat.messages.length <= 1 && (
          <ModelLoadingState progress={chat.modelProgress} />
        )}

        {(chat.modelState === "error" || chat.modelState === "unloaded") &&
          chat.messages.length <= 2 && <ModelFallbackNotice onRetry={loadModel} />}

        {showSuggestions && (
          <div className="pt-1">
            <SuggestedQuestions onPick={(q) => void chat.send(q)} disabled={chat.thinking} />
          </div>
        )}
      </div>

      {/* Composer + privacy note */}
      <div className="border-t border-line bg-surface px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <div ref={inputRef}>
          <ChatInput
            onSend={(t) => void chat.send(t)}
            onStop={chat.stop}
            busy={chat.thinking}
          />
        </div>
        <p className="mt-2 text-center text-[10px] leading-4 text-muted">
          AI responses are generated on your device when supported. Answers use TheTanti&apos;s
          own product &amp; policy data.
        </p>
      </div>
    </div>
  );
}
