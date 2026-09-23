"use client";

/**
 * Chatbot root — floating button + window. Dynamically imported from the
 * store layout (client-only, below the fold) so nothing AI-related touches
 * the critical path or server bundles.
 */
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChatButton } from "./chat-button";
import { ChatWindow } from "./chat-window";
import { loadModel } from "@/lib/ai/model/inference";

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Keep the assistant off surfaces with their own sticky flows (checkout,
  // payment result) where an overlay could cover critical controls.
  const hidden =
    pathname === "/checkout" ||
    pathname === "/order-success" ||
    pathname === "/order-failure";

  // Idle pre-warm: start loading the model shortly after first visit so the
  // first open is instant. Never blocks interaction; skipped on data savers.
  useEffect(() => {
    if (hidden) return;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return;
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => setTimeout(loadModel, 4000), { timeout: 15_000 })
      : window.setTimeout(loadModel, 6000);
    return () => {
      if (typeof idle !== "number") window.cancelIdleCallback?.(idle);
      else clearTimeout(idle);
    };
  }, [hidden]);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);

  if (hidden) return null;

  return (
    <>
      <ChatButton open={open} onToggle={toggle} />
      {open && <ChatWindow open={open} onClose={close} loadModel={loadModel} />}
    </>
  );
}
