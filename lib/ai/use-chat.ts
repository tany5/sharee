"use client";

/**
 * useChat — React state layer for the chatbot UI.
 * Owns: message list, streaming, model status/progress, persistence.
 * Delegates ALL routing/tool logic to lib/ai/controller.ts.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getWorkerClient } from "@/lib/ai/model/client";
import { generate as runGeneration } from "@/lib/ai/model/inference";
import { handleQuestion } from "@/lib/ai/controller";
import { useAuth } from "@/components/auth/auth-provider";
import {
  getOrCreateSessionId,
  loadHistory,
  persistHistory,
  clearHistory,
} from "@/lib/ai/storage/chat-history";
import type { ChatMessage } from "@/lib/ai/types/chat";

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

const GREETING: ChatMessage = {
  id: "greeting",
  role: "assistant",
  text: "Hi! I'm the TheTanti Assistant. Ask me about sarees, prices, shipping, returns or your order.",
  origin: "local",
  createdAt: 0,
};

export interface UseChat {
  messages: ChatMessage[];
  /** True while the assistant turn is being produced. */
  thinking: boolean;
  /** Text currently streaming into the last assistant bubble. */
  streamingText: string;
  modelState: "unloaded" | "loading" | "ready" | "error";
  modelProgress: number;
  modelDevice?: string;
  send: (text: string) => Promise<void>;
  stop: () => void;
  regenerate: () => Promise<void>;
  clear: () => void;
}

export function useChat(): UseChat {
  const { user } = useAuth();
  const isAuthenticated = user !== null;
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [thinking, setThinking] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [modelState, setModelState] = useState<"unloaded" | "loading" | "ready" | "error">("unloaded");
  const [modelProgress, setModelProgress] = useState(0);
  const [modelDevice, setModelDevice] = useState<string | undefined>(undefined);
  const sessionIdRef = useRef<string | null>(null);
  const knownSlugsRef = useRef<string[]>([]);
  const lastQuestionRef = useRef<string | null>(null);
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });

  /* Model status + progress subscription. */
  useEffect(() => {
    const client = getWorkerClient();
    // Sync once from the current state, then follow worker events. Deferred
    // so the effect never sets state synchronously during mount (React 19
    // cascading-render lint rule) — a microtask is enough.
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const { state } = client.getState();
      setModelState(state);
    });
    const unsubState = client.subscribe({
      onState: (state, device) => {
        setModelState(state);
        if (device) setModelDevice(device);
      },
      onProgress: (p) => setModelProgress(p),
    });
    return () => {
      active = false;
      unsubState();
    };
  }, []);

  /* Restore history + session id on first client render. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const sessionId = await getOrCreateSessionId();
      if (cancelled) return;
      sessionIdRef.current = sessionId;
      const history = await loadHistory(sessionId);
      if (!cancelled && history.length > 0) {
        // History rows never include the greeting (filtered at persist time),
        // but an old DB may still hold one — dedupe defensively so the fixed
        // "greeting" key can never collide (React duplicate-key warning).
        const real = history.filter((m) => m.id !== GREETING.id);
        setMessages([GREETING, ...real]);
        knownSlugsRef.current = [
          ...new Set(
            history.flatMap((m) =>
              m.blocks?.flatMap((b) => (b.kind === "product-cards" ? b.products.map((p) => p.slug) : [])) ?? [],
            ),
          ),
        ];
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: ChatMessage[]) => {
    if (!sessionIdRef.current) return;
    // The greeting is a UI constant, not conversation data — exclude it so a
    // reload can't produce two messages with the same key.
    void persistHistory(
      sessionIdRef.current,
      next.filter((m) => m.id !== GREETING.id && (m.text || m.blocks?.length)),
    );
  }, []);

  const runTurn = useCallback(
    async (question: string) => {
      setThinking(true);
      setStreamingText("");
      abortRef.current = { aborted: false };

      const assistantId = uid();
      // Optimistically insert an empty assistant bubble to stream into.
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", text: "", createdAt: Date.now() },
      ]);

      try {
        const result = await handleQuestion(
          question,
          {
            modelReady: modelState === "ready",
            isAuthenticated,
            knownProductSlugs: knownSlugsRef.current,
            generate: async (prompt, onToken) => {
              abortRef.current = { aborted: false };
              return runGeneration(prompt, {
                onToken,
                signal: abortRef.current,
              });
            },
          },
          (t) => setStreamingText((prev) => prev + t),
        );

        const finalText = result.turn.text;
        setMessages((prev) => {
          const next = prev.map((m) =>
            m.id === assistantId
              ? {
                  id: assistantId,
                  role: "assistant" as const,
                  text: finalText,
                  blocks: result.turn.blocks,
                  origin: result.turn.origin,
                  createdAt: Date.now(),
                }
              : m,
          );
          persist(next);
          return next;
        });
        knownSlugsRef.current = [
          ...new Set([...knownSlugsRef.current, ...result.productSlugs]),
        ];
      } catch {
        setMessages((prev) => {
          const next = prev.map((m) =>
            m.id === assistantId
              ? {
                  id: assistantId,
                  role: "assistant" as const,
                  text: "Something went wrong on my side. Please try again in a moment.",
                  error: true,
                  createdAt: Date.now(),
                }
              : m,
          );
          persist(next);
          return next;
        });
      } finally {
        setStreamingText("");
        setThinking(false);
      }
    },
    [isAuthenticated, modelState, persist],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || thinking) return;
      lastQuestionRef.current = trimmed;
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        text: trimmed,
        createdAt: Date.now(),
      };
      setMessages((prev) => {
        const next = [...prev, userMsg];
        persist(next);
        return next;
      });
      await runTurn(trimmed);
    },
    [persist, runTurn, thinking],
  );

  const stop = useCallback(() => {
    abortRef.current.aborted = true;
    getWorkerClient().interrupt();
    setThinking(false);
    setStreamingText("");
  }, []);

  const regenerate = useCallback(async () => {
    if (!lastQuestionRef.current || thinking) return;
    // Drop the last assistant message and answer again.
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant") {
        const next = prev.slice(0, -1);
        persist(next);
        return next;
      }
      return prev;
    });
    await runTurn(lastQuestionRef.current);
  }, [persist, runTurn, thinking]);

  const clear = useCallback(() => {
    stop();
    setMessages([GREETING]);
    knownSlugsRef.current = [];
    if (sessionIdRef.current) void clearHistory(sessionIdRef.current);
  }, [stop]);

  return {
    messages,
    thinking,
    streamingText,
    modelState,
    modelProgress,
    modelDevice,
    send,
    stop,
    regenerate,
    clear,
  };
}
