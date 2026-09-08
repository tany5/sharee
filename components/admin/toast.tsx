"use client";

/**
 * Reusable toaster for the admin panel.
 *
 * Usage inside any admin client component:
 *
 *   const toast = useToast();
 *   toast.success("Product saved.");
 *   toast.error("Choose a valid product slug");
 *   toast.info("Queue refreshed");
 *
 * One `<ToastProvider />` is mounted by the admin shell, so toasts survive
 * client-side navigations between admin pages and stack top-right on desktop,
 * top-center on mobile.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cx } from "@/lib/utils";

export type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  leaving: boolean;
}

interface ToastApi {
  success: (message: string, opts?: { duration?: number }) => void;
  error: (message: string, opts?: { duration?: number }) => void;
  info: (message: string, opts?: { duration?: number }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ENTER_MS = 200;
/** Auto-dismiss per kind (errors stick around longer). */
const DEFAULT_MS: Record<ToastKind, number> = {
  success: 3500,
  info: 5000,
  error: 8000,
};

const KIND_STYLE: Record<ToastKind, string> = {
  success: "border-[#4c7a4f]/40 bg-[#4c7a4f]/12 text-[#2f5232] dark:text-[#a9d9ad]",
  error: "border-danger/40 bg-danger/12 text-danger",
  info: "border-accent/40 bg-accent/12 text-ink",
};

const KIND_ICON: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    // Play the exit animation, then drop the item.
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
    );
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ENTER_MS);
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, duration?: number) => {
      const id = nextId.current++;
      const item: ToastItem = { id, kind, message, leaving: false };
      setToasts((prev) => [...prev.slice(-3), item]); // keep at most 4 visible
      window.setTimeout(() => dismiss(id), duration ?? DEFAULT_MS[kind]);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, opts) => push("success", message, opts?.duration),
      error: (message, opts) => push("error", message, opts?.duration),
      info: (message, opts) => push("info", message, opts?.duration),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toast viewport */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:top-20 sm:items-end"
      >
        {toasts.map((t) => {
          const Icon = KIND_ICON[t.kind];
          return (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              className={cx(
                "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 shadow-lg backdrop-blur transition-all duration-200",
                "animate-toast-in",
                t.leaving && "translate-y-1 opacity-0",
                KIND_STYLE[t.kind],
              )}
            >
              <Icon size={17} className="mt-0.5 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1 text-sm font-semibold leading-5 break-words">
                {t.message}
              </p>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismiss(t.id)}
                className="-m-1 shrink-0 rounded-full p-1 opacity-60 transition-opacity hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** Access the toaster. Must be called under a `<ToastProvider />`. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
