"use client";

/**
 * One chat message: bubble + optional rich blocks (product cards, order
 * status, links). Streaming text renders into the last assistant bubble.
 */
import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Package, RefreshCw, Truck } from "lucide-react";
import { ProductResult } from "./product-result";
import { courierName } from "@/lib/tracking";
import { formatDate, formatINR } from "@/lib/format";
import { cx } from "@/lib/utils";
import type { ChatMessage, MessageBlock } from "@/lib/ai/types/chat";

function Blocks({ blocks }: { blocks?: MessageBlock[] }) {
  if (!blocks?.length) return null;
  return (
    <div className="mt-2.5 space-y-2.5">
      {blocks.map((block, i) => {
        if (block.kind === "product-cards") {
          return (
            <div key={i} className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                {block.queryLabel}
              </p>
              <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {block.products.map((p) => (
                  <ProductResult key={p.slug} product={p} />
                ))}
              </div>
            </div>
          );
        }
        if (block.kind === "order-status") {
          const o = block.order;
          return (
            <div key={i} className="rounded-card border border-line bg-bg p-3">
              <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
                <Package size={15} className="text-accent" />
                {o.number}
              </div>
              <p className="mt-1 text-xs text-ink2">
                {o.fulfilment === "completed"
                  ? "Delivered"
                  : o.fulfilment === "dispatched"
                    ? "Shipped — on its way"
                    : o.fulfilment === "cancelled"
                      ? "Cancelled"
                      : "Confirmed — being prepared"}
                {" · "}
                est. {formatDate(o.estimatedDelivery)}
              </p>
              {o.tracking?.awb && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-ink2">
                  <Truck size={13} />
                  {courierName(o.tracking.courier) || "Courier"} · {o.tracking.awb}
                </p>
              )}
              <ul className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-ink2">
                {o.items.map((it, j) => (
                  <li key={j} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{it.name} ×{it.qty}</span>
                    <span className="shrink-0 font-semibold text-ink">
                      {formatINR(it.price * it.qty)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex justify-between border-t border-line pt-2 text-xs font-bold text-ink">
                <span>Total</span>
                <span>{formatINR(o.total)}</span>
              </p>
            </div>
          );
        }
        // links
        return (
          <div key={i} className="flex flex-wrap gap-2">
            {block.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-pill border border-accent/30 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/10"
              >
                {l.label}
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function ChatMessageView({
  message,
  streaming,
  isLastAssistant,
  onRegenerate,
}: {
  message: ChatMessage;
  streaming?: boolean;
  isLastAssistant?: boolean;
  onRegenerate?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className={cx("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cx("max-w-[85%]", isUser && "items-end")}>
        <div
          className={cx(
            "rounded-panel px-3.5 py-2.5 text-sm leading-relaxed",
            isUser
              ? "rounded-br-md bg-accent text-white"
              : message.error
                ? "rounded-bl-md border border-danger/30 bg-danger/5 text-danger"
                : "rounded-bl-md border border-line bg-surface text-ink",
          )}
        >
          <span className="whitespace-pre-wrap">{message.text}</span>
          {streaming && (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-current align-middle"
            />
          )}
          <Blocks blocks={message.blocks} />
        </div>
        {!isUser && !streaming && message.text && (
          <div className="mt-1 flex items-center gap-1 pl-1">
            <button
              type="button"
              onClick={copy}
              aria-label="Copy response"
              className="flex h-6 w-6 items-center justify-center rounded-pill text-muted transition-colors hover:bg-accent/10 hover:text-ink"
            >
              {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
            </button>
            {isLastAssistant && onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                aria-label="Regenerate response"
                className="flex h-6 w-6 items-center justify-center rounded-pill text-muted transition-colors hover:bg-accent/10 hover:text-ink"
              >
                <RefreshCw size={12} />
              </button>
            )}
            {message.origin === "local" && (
              <span className="text-[10px] text-muted/80">on-device</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
